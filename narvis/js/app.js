// Narvis: interfaz, voz (speechSynthesis) y conexión con el cerebro, la memoria y Canva.
// Las órdenes simples se resuelven aquí (commands.js); lo demás lo piensa Claude (brain.js).
import { respond, stripWakeWord } from "./commands.js";
import { createBrain, quadrant, MAX_HISTORY } from "./brain.js";
import { createStore } from "./store.js";
import { createCanvaTools } from "./canva.js";

const SETTINGS_KEY = "narvis.settings";

const STARTERS = [
  ["OEE", "Mi línea trabajó 450 de 480 min, produjo 820 piezas con ciclo ideal de 30 s y 40 defectuosas. Calcula el OEE y dime dónde atacar."],
  ["SMED", "El cambio de molde en mi prensa tarda 65 minutos. Arma un plan SMED para bajarlo a menos de 10."],
  ["5 porqués", "Tenemos muchas piezas con rebaba en inyección. Hagamos un análisis de causa raíz con 5 porqués e Ishikawa."],
  ["Takt time", "La demanda es de 1,200 piezas por día en dos turnos de 8 h con 30 min de descanso. ¿Cuál es el takt time y cuántas estaciones necesito?"],
  ["Cpk", "Un diámetro de 25 ± 0.05 mm tiene media 25.012 y desviación 0.011. Calcula Cp y Cpk e interpreta."],
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
    return { voice: true, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return { voice: true };
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

function buildShell() {
  ui.andon = el("div", { className: "andon", ariaHidden: "true" }, el("i", { className: "lamp-stop" }), el("i", { className: "lamp-wait" }), el("i", { className: "lamp-go" }));
  ui.status = el("span", { className: "status-text", role: "status" }, "Conectando…");
  ui.voice = el("button", { className: "icon-btn", type: "button" });
  const topbar = el(
    "header",
    { className: "topbar" },
    el("div", { className: "brand" }, el("h1", {}, "Narvis"), el("span", {}, "Ingeniería de producción")),
    el("div", { className: "status" }, ui.status, ui.andon, ui.voice)
  );

  ui.thread = el("div", { className: "thread", ariaLive: "polite" });
  ui.timers = el("ul", { className: "timers" });
  ui.input = el("textarea", { id: "ask", rows: 1, placeholder: "Pregúntale a Narvis…", enterKeyHint: "send" });
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

  ui.facts = el("ul", { className: "facts" });
  ui.factCount = el("small");
  ui.notes = el("ul", { className: "facts" });
  ui.canvaState = el("b", { textContent: "—" });
  ui.memoryState = el("b", { textContent: "—" });
  ui.newChat = el("button", { className: "ghost", type: "button", textContent: "Nueva conversación" });
  const side = el(
    "aside",
    { className: "side" },
    el("section", { className: "panel" }, el("h3", {}, "Lo que sé de ti", ui.factCount), ui.facts),
    el("section", { className: "panel" }, el("h3", {}, "Notas"), ui.notes),
    el(
      "section",
      { className: "panel" },
      el("h3", {}, "Conexiones"),
      el(
        "div",
        { className: "links-row" },
        el("div", { className: "conn" }, el("span", {}, "Canva"), ui.canvaState),
        el("div", { className: "conn" }, el("span", {}, "Memoria"), ui.memoryState)
      ),
      ui.newChat
    )
  );

  root.replaceChildren(topbar, el("div", { className: "layout" }, el("main", { className: "conversation" }, ui.thread, ui.form), side));
}

function setStatus(state, text) {
  ui.andon.dataset.state = state; // ready | thinking | speaking | error
  ui.status.textContent = text;
}

function renderVoiceButton() {
  ui.voice.setAttribute("aria-pressed", String(settings.voice));
  ui.voice.textContent = settings.voice ? "Voz activada" : "Voz silenciada";
}

// ---------- Estado ----------
let brain = null;
let store = null;
let busy = false;
let controller = null;

// ---------- Voz ----------
let voice = null;
function pickVoice() {
  const voices = speechSynthesis.getVoices();
  voice = voices.find((v) => v.lang === "es-MX") ?? voices.find((v) => v.lang.startsWith("es")) ?? null;
}

function speak(text) {
  if (!settings.voice || !text || !("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = voice?.lang ?? "es-MX";
  if (voice) utterance.voice = voice;
  utterance.rate = 1.04;
  utterance.onstart = () => setStatus("speaking", "Hablando…");
  utterance.onend = utterance.onerror = () => {
    if (!busy) setStatus("ready", "Listo");
  };
  speechSynthesis.speak(utterance);
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
      el("h2", {}, `${greeting()}${who}. `, el("em", {}, "¿Qué mejoramos hoy?")),
      el(
        "p",
        {},
        "Analizo problemas de planta con pensamiento crítico, hago los cálculos y te propongo acciones de mejora priorizadas. Escribe o dicta tu pregunta, o empieza con un caso:"
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
  const activity = el("p", { className: "activity", textContent: "Pensando…" });
  const node = el("article", { className: "answer thinking" }, el("div", { className: "answer-head", textContent: "Narvis" }), activity, body);
  ui.thread.append(node);
  node.scrollIntoView({ block: "nearest", behavior: "smooth" });
  return { node, body, activity };
}

// Claves sin acentos para el CSS de cada cuadrante de la matriz.
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
      el("section", { className: "block" }, el("h3", {}, "Pensamiento crítico"), el("ul", { className: "critique" }, ...answer.critica.map((c) => el("li", { textContent: c }))))
    );
  }
  if (answer.acciones?.length) {
    node.append(el("section", { className: "block" }, el("h3", {}, "Acciones de mejora"), actionsTable(answer.acciones)));
  }
  if (answer.enlaces?.length) {
    node.append(el("div", { className: "links" }, ...answer.enlaces.map((l) => el("a", { href: l.url, target: "_blank", rel: "noopener", textContent: `${l.titulo} ↗` }))));
  }
  if (remembered.length) {
    node.append(el("p", { className: "remembered", textContent: `Lo guardé en mi memoria: ${remembered.join(" · ")}` }));
  }
  const listen = el("button", { type: "button", textContent: "Escuchar" });
  listen.addEventListener("click", () => speak(answer.voz || answer.respuesta));
  const copy = el("button", { type: "button", textContent: "Copiar" });
  copy.addEventListener("click", () => {
    const text = [answer.respuesta, ...(answer.acciones ?? []).map((a) => `- ${a.accion} (${a.indicador})`)].join("\n");
    navigator.clipboard?.writeText(text).then(
      () => (copy.textContent = "Copiado"),
      () => (copy.textContent = "No se pudo copiar")
    );
  });
  node.append(el("div", { className: "answer-tools" }, listen, copy));
}

// ---------- Memoria y notas ----------
async function renderMemory() {
  const facts = await store.memory.all();
  ui.factCount.textContent = facts.length ? String(facts.length) : "";
  ui.facts.replaceChildren();
  if (!facts.length) {
    ui.facts.append(el("li", {}, el("span", { textContent: "Todavía nada. Cuéntame dónde trabajas, qué produces o en qué proyecto estás y lo recordaré." })));
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
        speak(`Atención. ${done}`);
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
  window.speechSynthesis?.cancel();
  ui.send.dataset.mode = "stop";
  ui.send.textContent = "Detener";
  addUserTurn(text);
  const shell = answerShell();
  setStatus("thinking", "Pensando…");
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
        shell.activity.textContent = "Escribiendo…";
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
  setStatus(failed ? "error" : "ready", failed ? "Algo falló" : "Listo");
  if (!answer.cancelled) speak(answer.voz);
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

async function init() {
  buildShell();
  renderVoiceButton();
  renderWelcome();
  setStatus("thinking", "Conectando…");

  if ("speechSynthesis" in window) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }

  ui.voice.addEventListener("click", () => {
    settings = { ...settings, voice: !settings.voice };
    saveSettings();
    if (!settings.voice) window.speechSynthesis?.cancel();
    renderVoiceButton();
  });

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
    window.speechSynthesis?.cancel();
    await store.chat.clear();
    renderWelcome();
  });

  store = await createStore();
  ui.memoryState.textContent = store.persistent ? "en tu cuenta" : "en este navegador";
  ui.memoryState.dataset.ok = String(store.persistent);
  await Promise.all([restoreChat(), renderMemory(), renderNotes()]);

  const mcp = window.claude?.use ? await window.claude.use("mcp") : null;
  const tools = mcp
    ? createCanvaTools(mcp, {
        onActivity: (text) => {
          const activity = ui.thread.querySelector(".answer.thinking .activity");
          if (activity) activity.textContent = text;
        }
      })
    : [];
  brain = await createBrain({ tools });
  ui.canvaState.textContent = brain?.hasTools ? "conectado" : "no disponible";
  ui.canvaState.dataset.ok = String(Boolean(brain?.hasTools));
  setStatus(brain ? "ready" : "error", brain ? "Listo" : "Sin cerebro");
}

init();
