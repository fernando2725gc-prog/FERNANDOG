// N.A.R.V.I.S.: interfaz HUD, cerebro holográfico, voz y conexión con el cerebro,
// la memoria, los proyectos de la cuenta y Canva.
// Las órdenes simples se resuelven aquí (commands.js); lo demás lo piensa Claude (brain.js).
import { respond, stripWakeWord } from "./commands.js";
import { createBrain, quadrant, MAX_HISTORY } from "./brain.js";
import { createStore } from "./store.js";
import { createCanvaTools, CANVA_RULES } from "./canva.js";
import { createProjectTools, watchProjects, PROJECT_RULES } from "./projects.js";
import { createVoice, voiceQuality } from "./voice.js";
import { createHologram } from "./hologram.js";

const SETTINGS_KEY = "narvis.settings";

const STARTERS = [
  ["Proyectos", "¿Cómo van mis proyectos? Dame un diagnóstico crítico y el siguiente paso de cada uno."],
  ["OEE", "Mi línea trabajó 450 de 480 min, produjo 820 piezas con ciclo ideal de 30 s y 40 defectuosas. Calcula el OEE y dime dónde atacar."],
  ["SMED", "El cambio de molde en mi prensa tarda 65 minutos. Arma un plan SMED para bajarlo a menos de 10."],
  ["Causa raíz", "Tenemos muchas piezas con rebaba en inyección. Hagamos un análisis de causa raíz con 5 porqués e Ishikawa."],
  ["Takt time", "La demanda es de 1,200 piezas por día en dos turnos de 8 h con 30 min de descanso. ¿Cuál es el takt time y cuántas estaciones necesito?"],
  ["Canva", "Busca mis presentaciones recientes en Canva."]
];

// ---------- Utilidades ----------
const el = (tag, props = {}, ...children) => {
  const { dataset, ...rest } = props;
  const node = Object.assign(document.createElement(tag), rest);
  if (dataset) Object.assign(node.dataset, dataset);
  for (const child of children) if (child != null) node.append(child);
  return node;
};

function loadSettings() {
  try {
    return { voice: true, rate: 1, pitch: 1, voiceURI: "", ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return { voice: true, rate: 1, pitch: 1, voiceURI: "" };
  }
}
function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* sin persistencia */
  }
}

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

// Cómo dictar en cada sistema (en la app de Claude el micrófono directo está bloqueado).
function dictationHint() {
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad/i.test(ua)) return el("span", {}, "Para hablar, toca el micrófono de tu teclado");
  if (/Mac/i.test(ua)) return el("span", {}, "Para hablar, pulsa ", el("kbd", {}, "Fn"), " dos veces");
  return el("span", {}, "Para hablar, pulsa ", el("kbd", {}, "Windows"), " + ", el("kbd", {}, "H"));
}

// Convierte texto con párrafos y listas con guion en nodos (nunca HTML del modelo).
function renderText(text) {
  const frag = document.createDocumentFragment();
  for (const block of text.split(/\n{2,}/)) {
    const lines = block.split("\n").filter((l) => l.trim());
    if (!lines.length) continue;
    const bullet = /^\s*[-•*]\s+/;
    const numbered = /^\s*\d+[.)]\s+/;
    if (lines.every((l) => bullet.test(l)) || lines.every((l) => numbered.test(l))) {
      const isNum = numbered.test(lines[0]);
      const list = el(isNum ? "ol" : "ul");
      for (const l of lines) list.append(el("li", { textContent: l.replace(isNum ? numbered : bullet, "") }));
      frag.append(list);
    } else {
      frag.append(el("p", { textContent: lines.join("\n"), style: "white-space: pre-line" }));
    }
  }
  return frag;
}

// ---------- Interfaz ----------
const root = document.querySelector("#narvis");
const ui = {};
let settings = loadSettings();

function panel(title, ...content) {
  const count = el("small");
  return { node: el("section", { className: "panel" }, el("header", {}, el("h2", { className: "hud-label", textContent: title }), count), ...content), count };
}

function buildShell() {
  ui.canvas = el("canvas", { ariaHidden: "true" });
  ui.readout = el("div", { className: "readout", role: "status" });
  ui.state = el("strong", { textContent: "Iniciando" });
  ui.detail = el("small", { textContent: "—" });
  ui.readout.append(el("span", { className: "dot" }), ui.state, ui.detail);

  ui.projects = el("ul", { className: "items" });
  const projects = panel("Proyectos", ui.projects);
  ui.projectCount = projects.count;

  ui.facts = el("ul", { className: "items" });
  const memory = panel("Lo que sé de ti", ui.facts);
  ui.factCount = memory.count;

  ui.notes = el("ul", { className: "items" });
  const notes = panel("Notas", ui.notes);

  ui.voiceToggle = el("button", { className: "btn", type: "button" });
  ui.voiceTest = el("button", { className: "btn", type: "button", textContent: "Probar" });
  ui.voiceSelect = el("select", { id: "voice-select" });
  ui.voiceQuality = el("span", { className: "tag" });
  ui.rate = el("input", { id: "voice-rate", type: "range", min: "0.8", max: "1.3", step: "0.05" });
  const voicePanel = panel(
    "Voz",
    el("label", { className: "field", htmlFor: "voice-select" }, el("span", {}, "Voz ", ui.voiceQuality), ui.voiceSelect),
    el("label", { className: "field", htmlFor: "voice-rate" }, "Velocidad", ui.rate),
    el("div", { className: "row" }, ui.voiceToggle, ui.voiceTest)
  );

  ui.canvaState = el("b", { textContent: "—" });
  ui.projectState = el("b", { textContent: "—" });
  ui.memoryState = el("b", { textContent: "—" });
  ui.newChat = el("button", { className: "btn", type: "button", textContent: "Nueva conversación" });
  const conn = panel(
    "Conexiones",
    el("div", { className: "conn" }, el("span", {}, "Proyectos de Claude Code"), ui.projectState),
    el("div", { className: "conn" }, el("span", {}, "Canva"), ui.canvaState),
    el("div", { className: "conn" }, el("span", {}, "Memoria"), ui.memoryState),
    el("div", { className: "row" }, ui.newChat)
  );

  const core = el(
    "aside",
    { className: "core" },
    el("div", { className: "brand" }, el("h1", {}, "N.A.R.V.I.S."), el("span", {}, "ingeniería de producción")),
    el("div", { className: "holo" }, ui.canvas),
    ui.readout,
    projects.node,
    memory.node,
    notes.node,
    voicePanel.node,
    conn.node
  );

  ui.thread = el("div", { className: "thread", ariaLive: "polite" });
  ui.timers = el("ul", { className: "timers" });
  ui.input = el("textarea", { id: "ask", rows: 1, placeholder: "Habla o escribe a Narvis…", enterKeyHint: "send" });
  ui.send = el("button", { className: "send", type: "submit", textContent: "Enviar" });
  ui.form = el(
    "form",
    { className: "composer" },
    ui.timers,
    el("label", { className: "visually-hidden", htmlFor: "ask", textContent: "Pregunta" }),
    el("div", { className: "composer-box" }, ui.input, ui.send),
    el(
      "p",
      { className: "composer-hint" },
      dictationHint(),
      el("span", {}, el("kbd", {}, "Enter"), " envía · ", el("kbd", {}, "Shift"), " + ", el("kbd", {}, "Enter"), " nueva línea")
    )
  );

  root.replaceChildren(core, el("main", { className: "conversation" }, ui.thread, ui.form));
}

let hologram = null;
const STATE_LABELS = { ready: "En línea", thinking: "Analizando", speaking: "Hablando", error: "Falla" };
function setStatus(state, detail) {
  ui.readout.dataset.state = state;
  ui.state.textContent = STATE_LABELS[state];
  ui.detail.textContent = detail;
  hologram?.setState(state === "ready" ? "idle" : state);
}

// ---------- Estado ----------
let brain = null;
let store = null;
let busy = false;
let controller = null;

// ---------- Voz ----------
const voice = createVoice({
  getSettings: () => settings,
  onState: (speaking) => {
    if (busy) return;
    setStatus(speaking ? "speaking" : "ready", speaking ? "Respuesta en voz" : "Esperando instrucciones");
  }
});

function renderVoicePanel() {
  ui.voiceToggle.setAttribute("aria-pressed", String(settings.voice));
  ui.voiceToggle.textContent = settings.voice ? "Voz activada" : "Voz silenciada";
  ui.rate.value = String(settings.rate);
  const voices = voice.list();
  ui.voiceSelect.replaceChildren(
    ...(voices.length
      ? voices.map((v) => el("option", { value: v.voiceURI, textContent: `${v.name} (${v.lang})` }))
      : [el("option", { value: "", textContent: "Sin voces en español en este navegador" })])
  );
  const current = voice.current();
  if (current) ui.voiceSelect.value = current.voiceURI;
  const q = current ? voiceQuality(current) : "básica";
  ui.voiceQuality.dataset.q = q;
  ui.voiceQuality.textContent = `· ${q}`;
  ui.voiceQuality.title =
    q === "natural" ? "Voz neuronal" : "Para una voz más natural abre Narvis en Microsoft Edge (voces «Natural») o instala una voz «Mejorada» en tu sistema.";
}

// ---------- Conversación ----------
function renderWelcome() {
  const who = store?.name ? `, ${store.name}` : "";
  const starters = el("div", { className: "starters" });
  for (const [tag, prompt] of STARTERS) {
    const b = el("button", { className: "starter", type: "button" }, el("b", {}, tag), el("span", {}, prompt));
    b.addEventListener("click", () => ask(prompt));
    starters.append(b);
  }
  ui.thread.replaceChildren(
    el(
      "section",
      { className: "welcome" },
      el("p", { className: "hud-label", textContent: "Sistema en línea" }),
      el("h2", {}, `${greeting()}${who}. `, el("em", {}, "¿Qué mejoramos hoy?")),
      el(
        "p",
        {},
        "Reviso tus proyectos, analizo problemas de planta sin darte la razón por compromiso, hago los cálculos y te propongo acciones de mejora priorizadas."
      ),
      starters
    )
  );
}

function addUserTurn(text) {
  ui.thread.querySelector(".welcome")?.remove();
  ui.thread.append(el("div", { className: "turn-user", textContent: text }));
}

function answerShell() {
  const body = el("div", { className: "answer-body" });
  const activity = el("p", { className: "activity", textContent: "Analizando…" });
  const node = el("article", { className: "answer thinking" }, el("div", { className: "answer-head" }, el("span", { className: "hud-label", textContent: "Narvis" })), activity, body);
  ui.thread.append(node);
  node.scrollIntoView({ block: "nearest", behavior: "smooth" });
  return { node, body, activity };
}

// Claves sin acentos para el CSS de cada cuadrante de la matriz impacto-esfuerzo.
const QUAD_KEYS = { "Ganancia rápida": "quick", "Proyecto estratégico": "strategic", "Ajuste menor": "minor", Reconsiderar: "reconsider" };

function level(value) {
  return el("span", { className: "level", dataset: { level: value } }, el("span", { className: "meter", ariaHidden: "true" }, el("i"), el("i"), el("i")), value);
}

function actionsTable(actions) {
  const rows = actions.map((a) =>
    el(
      "tr",
      {},
      el("td", { className: "what" }, el("b", { textContent: a.accion }), a.porque ? el("small", { textContent: a.porque }) : null),
      el("td", { dataset: { label: "Impacto" } }, level(a.impacto)),
      el("td", { dataset: { label: "Esfuerzo" } }, level(a.esfuerzo)),
      el("td", { dataset: { label: "Prioridad" } }, el("span", { className: "quad", dataset: { q: QUAD_KEYS[quadrant(a)] }, textContent: quadrant(a) })),
      el("td", { className: "kpi", dataset: { label: "Indicador" }, textContent: a.indicador || "—" })
    )
  );
  const head = el("tr", {}, ...["Acción", "Impacto", "Esfuerzo", "Prioridad", "Indicador"].map((t) => el("th", { scope: "col", textContent: t })));
  return el("div", { className: "table-wrap" }, el("table", { className: "actions" }, el("thead", {}, head), el("tbody", {}, ...rows)));
}

// Pinta una respuesta completa (del cerebro o de un comando) dentro de su tarjeta.
function fillAnswer(shell, answer, { remembered = [] } = {}) {
  const { node, body, activity } = shell;
  node.classList.remove("thinking");
  node.classList.toggle("failed", answer.ok === false && !answer.cancelled);
  activity.remove();
  body.replaceChildren(renderText(answer.respuesta || ""));

  if (answer.critica?.length) {
    node.append(
      el("section", { className: "block" }, el("h3", { className: "hud-label", textContent: "Pensamiento crítico" }), el("ul", { className: "critique" }, ...answer.critica.map((c) => el("li", { textContent: c }))))
    );
  }
  if (answer.acciones?.length) {
    node.append(el("section", { className: "block" }, el("h3", { className: "hud-label", textContent: "Acciones de mejora" }), actionsTable(answer.acciones)));
  }
  if (answer.enlaces?.length) {
    node.append(el("div", { className: "links" }, ...answer.enlaces.map((l) => el("a", { href: l.url, target: "_blank", rel: "noopener", textContent: `${l.titulo} ↗` }))));
  }
  if (remembered.length) {
    node.append(el("p", { className: "remembered", textContent: `Memoria actualizada: ${remembered.join(" · ")}` }));
  }
  const listen = el("button", { type: "button", textContent: "Escuchar" });
  listen.addEventListener("click", () => voice.speak(answer.voz || answer.respuesta, { force: true }));
  const listenAll = el("button", { type: "button", textContent: "Leer completa" });
  listenAll.addEventListener("click", () => voice.speak(answer.respuesta, { force: true }));
  const copy = el("button", { type: "button", textContent: "Copiar" });
  copy.addEventListener("click", () => {
    const text = [answer.respuesta, ...(answer.acciones ?? []).map((a) => `- ${a.accion} (${a.indicador})`)].join("\n");
    navigator.clipboard?.writeText(text).then(
      () => (copy.textContent = "Copiado"),
      () => (copy.textContent = "No se pudo copiar")
    );
  });
  node.append(el("div", { className: "answer-tools" }, listen, listenAll, copy));
}

// ---------- Paneles ----------
function renderProjects(result) {
  ui.projects.replaceChildren();
  if (!result) {
    ui.projects.append(el("li", {}, el("span", { textContent: "Conectando con tus proyectos…" })));
    return;
  }
  if (!result.ok) {
    ui.projectState.textContent = "sin acceso";
    ui.projectState.dataset.ok = "false";
    ui.projects.append(el("li", {}, el("span", { textContent: result.error })));
    return;
  }
  ui.projectState.textContent = "conectado";
  ui.projectState.dataset.ok = "true";
  ui.projectCount.textContent = String(result.projects.length);
  if (!result.projects.length) ui.projects.append(el("li", {}, el("span", { textContent: "No encontré proyectos en tu cuenta." })));
  for (const p of result.projects.slice(0, 8)) {
    const askBtn = el("button", { type: "button", className: "ask-link", textContent: "Analizar este proyecto →" });
    askBtn.addEventListener("click", () => ask(`Analiza con ojo crítico mi proyecto «${p.titulo}» (id ${p.id}): cómo va, qué riesgos ves y cuál es el siguiente paso.`));
    ui.projects.append(
      el("li", { className: "project" }, el("b", { textContent: p.titulo }), el("em", { dataset: { state: p.estado }, textContent: p.estado }), p.ultimo_avance ? el("small", { textContent: p.ultimo_avance }) : null, askBtn)
    );
  }
}

async function renderMemory() {
  const facts = await store.memory.all();
  ui.factCount.textContent = facts.length ? String(facts.length) : "";
  ui.facts.replaceChildren();
  if (!facts.length) {
    ui.facts.append(el("li", {}, el("span", { textContent: "Todavía nada. Cuéntame dónde trabajas, qué produces o en qué estás y lo recordaré." })));
  }
  facts.forEach((fact, i) => {
    const remove = el("button", { type: "button", title: "Olvidar", ariaLabel: `Olvidar: ${fact}`, textContent: "×" });
    remove.addEventListener("click", async () => {
      await store.memory.remove(i);
      renderMemory();
    });
    ui.facts.append(el("li", {}, el("span", { textContent: fact }), remove));
  });
}

async function renderNotes() {
  const notes = await store.notes.list();
  ui.notes.replaceChildren(
    ...(notes.length
      ? notes.map((n) => el("li", {}, el("span", { textContent: n })))
      : [el("li", {}, el("span", { textContent: "Di «anota…» para guardar una nota." }))])
  );
}

async function remember(facts) {
  const known = (await store.memory.all()).map((f) => f.toLowerCase());
  const fresh = facts.filter((f) => !known.includes(f.toLowerCase()));
  if (fresh.length) {
    await store.memory.add(...fresh);
    renderMemory();
  }
  return fresh;
}

async function historyTurns() {
  const chat = await store.chat.all();
  return chat.slice(-MAX_HISTORY / 2).flatMap((x) => [
    { role: "user", content: x.q },
    { role: "assistant", content: x.a.respuesta }
  ]);
}

// ---------- Comandos locales ----------
const ctx = {
  now: () => new Date(),
  pendingLink: null,
  openUrl(url, label) {
    // Dentro de Claude no se pueden abrir ventanas solas: dejamos el enlace en la respuesta.
    ctx.pendingLink = { titulo: label, url };
  },
  get notes() {
    return {
      add: async (n) => {
        await store.notes.add(n);
        renderNotes();
      },
      list: () => store.notes.list(),
      clear: async () => {
        await store.notes.clear();
        renderNotes();
      }
    };
  },
  startTimer(seconds, label) {
    const end = Date.now() + seconds * 1000;
    const chip = el("li");
    ui.timers.append(chip);
    const tick = () => {
      const left = Math.max(0, Math.round((end - Date.now()) / 1000));
      chip.textContent = `${label} · ${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
      if (left === 0) {
        clearInterval(id);
        chip.remove();
        const done = `Tu temporizador de ${label} terminó.`;
        fillAnswer(answerShell(), { respuesta: done, voz: done, critica: [], acciones: [], enlaces: [] });
        voice.speak(`Atención. ${done}`);
      }
    };
    const id = setInterval(tick, 1000);
    tick();
  }
};

const EMPTY = { critica: [], acciones: [], recordar: [], enlaces: [] };

// ---------- Preguntar ----------
async function ask(text) {
  const question = (stripWakeWord(text) ?? text).trim();
  if (!question || busy || !store) return;
  busy = true;
  voice.stop();
  ui.send.dataset.mode = "stop";
  ui.send.textContent = "Detener";
  addUserTurn(text);
  const shell = answerShell();
  setStatus("thinking", "Procesando la consulta");
  ctx.pendingLink = null;

  let answer;
  const local = await respond(question, ctx);
  if (local !== null) {
    answer = { ...EMPTY, ok: true, voz: local, respuesta: local, enlaces: ctx.pendingLink ? [ctx.pendingLink] : [] };
  } else if (brain) {
    controller = new AbortController();
    answer = await brain.ask(question, {
      history: await historyTurns(),
      memory: await store.memory.all(),
      name: store.name,
      signal: controller.signal,
      onText: (partial) => {
        if (!partial) return;
        shell.activity.textContent = "Redactando…";
        shell.body.replaceChildren(renderText(partial));
      }
    });
    controller = null;
  } else {
    answer = { ...EMPTY, ok: false, voz: "", respuesta: "Mi cerebro solo funciona dentro de la app de Claude. Abre Narvis desde su enlace de claude.ai." };
  }

  const remembered = answer.ok && answer.recordar.length ? await remember(answer.recordar) : [];
  fillAnswer(shell, answer, { remembered });
  if (answer.ok) store.chat.add({ q: question, a: answer, at: new Date().toISOString() });

  busy = false;
  ui.send.dataset.mode = "send";
  ui.send.textContent = "Enviar";
  const failed = answer.ok === false && !answer.cancelled;
  setStatus(failed ? "error" : "ready", failed ? "Revisa el mensaje" : "Esperando instrucciones");
  if (!answer.cancelled) voice.speak(answer.voz);
}

// ---------- Arranque ----------
async function restoreChat() {
  const chat = await store.chat.all();
  if (!chat.length) return renderWelcome();
  ui.thread.replaceChildren();
  for (const x of chat) {
    addUserTurn(x.q);
    fillAnswer(answerShell(), { ...EMPTY, ...x.a, ok: true });
  }
  ui.thread.lastElementChild?.scrollIntoView({ block: "end" });
}

function autoGrow() {
  ui.input.style.height = "auto";
  ui.input.style.height = `${Math.min(ui.input.scrollHeight, 200)}px`;
}

function bindEvents() {
  ui.voiceToggle.addEventListener("click", () => {
    settings = { ...settings, voice: !settings.voice };
    saveSettings();
    if (!settings.voice) voice.stop();
    renderVoicePanel();
  });
  ui.voiceSelect.addEventListener("change", () => {
    settings = { ...settings, voiceURI: ui.voiceSelect.value };
    saveSettings();
    renderVoicePanel();
  });
  ui.rate.addEventListener("change", () => {
    settings = { ...settings, rate: Number(ui.rate.value) };
    saveSettings();
  });
  ui.voiceTest.addEventListener("click", () =>
    voice.speak(`Hola${store?.name ? `, ${store.name}` : ""}. Soy Narvis. Así sueno con esta voz y esta velocidad.`, { force: true })
  );
  window.speechSynthesis?.addEventListener?.("voiceschanged", renderVoicePanel);

  ui.form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (busy) {
      controller?.abort();
      return;
    }
    const text = ui.input.value.trim();
    if (!text) return;
    ui.input.value = "";
    autoGrow();
    ask(text);
  });
  ui.input.addEventListener("input", autoGrow);
  ui.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      ui.form.requestSubmit();
    }
  });

  ui.newChat.addEventListener("click", async () => {
    if (busy || !store) return;
    voice.stop();
    await store.chat.clear();
    renderWelcome();
  });
}

async function init() {
  buildShell();
  hologram = createHologram(ui.canvas);
  renderVoicePanel();
  renderWelcome();
  renderProjects(null);
  bindEvents();
  setStatus("thinking", "Conectando sistemas");

  store = await createStore();
  ui.memoryState.textContent = store.persistent ? "en tu cuenta" : "en este navegador";
  ui.memoryState.dataset.ok = String(store.persistent);
  await Promise.all([restoreChat(), renderMemory(), renderNotes()]);

  const mcp = window.claude?.use ? await window.claude.use("mcp") : null;
  const onActivity = (text) => {
    const activity = ui.thread.querySelector(".answer.thinking .activity");
    if (activity) activity.textContent = text;
  };
  const tools = mcp ? [...createProjectTools(mcp, { onActivity }), ...createCanvaTools(mcp, { onActivity })] : [];
  if (mcp) watchProjects(mcp, renderProjects);
  else renderProjects({ ok: false, error: "Los proyectos solo se ven dentro de la app de Claude." });

  brain = await createBrain({ tools, toolRules: [PROJECT_RULES, CANVA_RULES] });
  ui.canvaState.textContent = brain?.hasTools ? "conectado" : "no disponible";
  ui.canvaState.dataset.ok = String(Boolean(brain?.hasTools));
  setStatus(brain ? "ready" : "error", brain ? "Esperando instrucciones" : "Sin cerebro");
}

init();
