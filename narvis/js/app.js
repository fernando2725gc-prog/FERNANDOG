// Narvis: interfaz, micrófono (SpeechRecognition), voz (speechSynthesis) y el
// "contexto" que usan los comandos. Los comandos rápidos viven en commands.js y
// las preguntas abiertas las contesta el cerebro (brain.js).
import { respond, stripWakeWord, COMMANDS } from "./commands.js";
import { createBrain, createServerBrain, headlinesText, TOPICS } from "./brain.js";
import { createStore } from "./store.js";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const ATTENTION_MS = 8000; // tras decir solo "Narvis", escucha sin palabra clave durante este tiempo
const SETTINGS_KEY = "narvis.settings";
const IN_CLAUDE = Boolean(window.claude?.use);

// ¿Corre junto al servidor local (npm run server)? Responde en /api/status.
async function detectServer() {
  if (IN_CLAUDE || location.protocol === "file:") return null;
  try {
    const res = await fetch("/api/status");
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// ---------- Interfaz ----------
const root = document.querySelector("#narvis");
root.innerHTML = `
  <header class="top">
    <div>
      <h1>N.A.R.V.I.S.</h1>
      <p class="tagline">Asistente por voz enfocado en lo que importa</p>
    </div>
    <p id="brain-pill" class="pill" data-state="loading">Conectando cerebro…</p>
  </header>

  <div class="layout">
    <section class="console" aria-label="Consola de voz">
      <div class="hud">
        <div id="core" class="core" data-state="idle" aria-hidden="true">
          <span class="ring ring-1"></span><span class="ring ring-2"></span>
          <span class="ring ring-3"></span><span class="heart"></span>
        </div>
        <p id="status" class="status" aria-live="polite">Micrófono apagado</p>
        <p id="interim" class="interim"></p>
        <div class="controls">
          <button id="toggle" class="btn btn-primary" type="button" aria-pressed="false">Activar micrófono</button>
          <button id="voice" class="btn" type="button" aria-pressed="true">Voz: activada</button>
          <button id="stop" class="btn" type="button" hidden>Detener</button>
        </div>
        <p id="mic-note" class="note" hidden></p>
        <ul id="timers" class="timers"></ul>
      </div>

      <div class="chat">
        <ol id="log" class="log" aria-label="Conversación" aria-live="polite"></ol>
        <form id="text-form" class="text-form">
          <label class="visually-hidden" for="text-input">Escribe o dicta una orden</label>
          <input id="text-input" type="text" autocomplete="off" enterkeyhint="send"
            placeholder="Pregunta o dicta: ¿qué está pasando en el mundo?">
          <button class="btn btn-primary" type="submit">Enviar</button>
        </form>
      </div>
    </section>

    <aside class="radar" aria-label="Radar de noticias">
      <div class="radar-head">
        <div>
          <h2>Radar mundial</h2>
          <p id="news-updated" class="meta">Cargando noticias…</p>
        </div>
        <div class="controls">
          <button id="refresh-news" class="btn" type="button" hidden>Actualizar</button>
          <button id="briefing" class="btn btn-primary" type="button">Resumen del día</button>
        </div>
      </div>
      <div id="topics" class="chips" role="group" aria-label="Filtrar por tema"></div>
      <ul id="news" class="news"></ul>
    </aside>
  </div>

  <footer class="foot">
    <label class="switch">
      <input id="wake-mode" type="checkbox" checked>
      <span>Requerir la palabra «Narvis» al hablar</span>
    </label>
    <label for="lang">Idioma
      <select id="lang">
        <option value="es-MX">Español (México)</option>
        <option value="es-ES">Español (España)</option>
        <option value="es-US">Español (EE. UU.)</option>
        <option value="es-AR">Español (Argentina)</option>
        <option value="es-CO">Español (Colombia)</option>
      </select>
    </label>
    <details class="help">
      <summary>¿Qué puedo decir?</summary>
      <ul id="help-list"></ul>
      <p>Y cualquier pregunta abierta: «¿Por qué sube el petróleo?», «Explícame la elección en Israel».</p>
    </details>
  </footer>
`;

const $ = (sel) => root.querySelector(sel);
const ui = {
  pill: $("#brain-pill"), core: $("#core"), status: $("#status"), interim: $("#interim"),
  toggle: $("#toggle"), voice: $("#voice"), stop: $("#stop"), micNote: $("#mic-note"),
  timers: $("#timers"), log: $("#log"), form: $("#text-form"), input: $("#text-input"),
  updated: $("#news-updated"), briefing: $("#briefing"), refreshNews: $("#refresh-news"), topics: $("#topics"), news: $("#news"),
  wakeMode: $("#wake-mode"), lang: $("#lang"), help: $("#help-list")
};

// ---------- Ajustes (comodidad por navegador) ----------
function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) ?? {};
  } catch {
    return {};
  }
}
function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* sin persistencia */
  }
}
const settings = { wakeWord: true, lang: "es-MX", voice: true, ...loadSettings() };

// ---------- Estado ----------
let brain = null;
let store = { notes: null };
let server = null; // estado del servidor local, si hay
let news = null;
let topicFilter = null;
let recognition = null;
let listening = false;
let speaking = false;
let busy = false;
let attentiveUntil = 0;
let controller = null;

function setState(state, text) {
  ui.core.dataset.state = state; // idle | listening | attentive | thinking | speaking
  ui.status.textContent = text;
}

function refreshIdleState() {
  ui.stop.hidden = !(busy || speaking);
  if (busy || speaking) return;
  if (!listening) setState("idle", recognition ? "Micrófono apagado" : "Listo para tus preguntas");
  else if (Date.now() < attentiveUntil) setState("attentive", "Te escucho…");
  else if (settings.wakeWord) setState("listening", "Di «Narvis» seguido de tu orden");
  else setState("attentive", "Escuchando…");
}

// ---------- Conversación ----------
function addMessage(who, text, link) {
  const item = document.createElement("li");
  item.className = `msg msg-${who}`;
  const p = document.createElement("p");
  p.textContent = text;
  item.append(p);
  if (link) addLink(item, link);
  ui.log.append(item);
  ui.log.scrollTop = ui.log.scrollHeight;
  return { item, p };
}

function addLink(item, link) {
  const a = document.createElement("a");
  a.href = link.url;
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = `Abrir ${link.label} ↗`;
  item.append(a);
}

// ---------- Voz ----------
let voice = null;
function pickVoice() {
  const voices = speechSynthesis.getVoices();
  const base = settings.lang.slice(0, 2);
  voice = voices.find((v) => v.lang === settings.lang) ?? voices.find((v) => v.lang.startsWith(base)) ?? null;
}

function speak(text) {
  return new Promise((resolve) => {
    if (!settings.voice || !text || !("speechSynthesis" in window)) return resolve();
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = settings.lang;
    if (voice) utterance.voice = voice;
    utterance.rate = 1.03;
    utterance.pitch = 0.9;
    speaking = true;
    setState("speaking", "Hablando…");
    ui.stop.hidden = false;
    recognition?.abort(); // que Narvis no se escuche a sí mismo
    const done = () => {
      speaking = false;
      refreshIdleState();
      startRecognition();
      resolve();
    };
    utterance.onend = done;
    utterance.onerror = done;
    speechSynthesis.speak(utterance);
  });
}

// ---------- Contexto para los comandos ----------
const ctx = {
  now: () => new Date(),
  canFetch: !IN_CLAUDE, // dentro de Claude la página no puede llamar a otros sitios
  pendingLink: null,
  openUrl(url, label) {
    // Las ventanas abiertas sin clic suelen bloquearse: dejamos también un enlace.
    ctx.pendingLink = { url, label };
    try {
      window.open(url, "_blank", "noopener");
    } catch {
      /* el enlace queda en la conversación */
    }
  },
  get notes() {
    return store.notes;
  },
  startTimer(seconds, label) {
    const end = Date.now() + seconds * 1000;
    const row = document.createElement("li");
    ui.timers.append(row);
    const tick = () => {
      const left = Math.max(0, Math.round((end - Date.now()) / 1000));
      const m = String(Math.floor(left / 60)).padStart(2, "0");
      const s = String(left % 60).padStart(2, "0");
      row.textContent = `${label} · ${m}:${s}`;
      if (left === 0) {
        clearInterval(id);
        row.remove();
        addMessage("narvis", `Tu temporizador de ${label} terminó.`);
        speak(`Atención. Tu temporizador de ${label} ha terminado.`);
      }
    };
    const id = setInterval(tick, 1000);
    tick();
  },
  async fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  briefing: (phrase) => (brain ? ask(phrase, "briefing") : headlinesText(news)),
  stop: () => stopListening()
};

// Pregunta al cerebro mostrando la respuesta mientras se escribe.
let currentBubble = null;
async function ask(question, mode) {
  currentBubble = addMessage("narvis", "Pensando…");
  currentBubble.item.classList.add("thinking");
  controller = new AbortController();
  const answer = await brain.ask(question, {
    mode,
    news,
    signal: controller.signal,
    onText: (text) => {
      currentBubble.item.classList.remove("thinking");
      currentBubble.p.textContent = text;
      ui.log.scrollTop = ui.log.scrollHeight;
    }
  });
  controller = null;
  return answer;
}

// ---------- Procesar una orden ----------
async function handle(text) {
  if (busy) return;
  busy = true;
  window.speechSynthesis?.cancel();
  addMessage("user", text);
  setState("thinking", "Procesando…");
  ui.stop.hidden = false;
  ctx.pendingLink = null;
  currentBubble = null;

  let answer = await respond(text, ctx);
  if (answer === null) {
    const question = (stripWakeWord(text) ?? text).trim();
    answer = !question
      ? "¿Sí? Dime qué necesitas."
      : brain
      ? await ask(question)
      : "Esa pregunta necesita mi cerebro. Abre Narvis con el servidor local (npm run server) o desde la app de Claude. Aquí puedo darte la hora, hacer cuentas, poner temporizadores, guardar notas y abrir páginas.";
  }

  // Si el cerebro respondió, su burbuja ya existe: solo se actualiza.
  if (currentBubble) {
    currentBubble.item.classList.remove("thinking");
    currentBubble.p.textContent = answer || "Detenido.";
    if (ctx.pendingLink) addLink(currentBubble.item, ctx.pendingLink);
  } else {
    addMessage("narvis", answer, ctx.pendingLink);
  }
  busy = false;
  attentiveUntil = 0;
  refreshIdleState();
  await speak(answer);
}

function onHeard(transcript) {
  if (speaking || busy) return;
  if (!settings.wakeWord || Date.now() < attentiveUntil) {
    if (transcript.trim()) handle(transcript.trim());
    return;
  }
  const order = stripWakeWord(transcript);
  if (order === null) return; // no iba dirigido a Narvis
  if (order) {
    handle(transcript.trim());
  } else {
    speak("¿Sí?").then(() => {
      attentiveUntil = Date.now() + ATTENTION_MS;
      refreshIdleState();
      setTimeout(refreshIdleState, ATTENTION_MS + 50);
    });
  }
}

// ---------- Reconocimiento de voz ----------
function showMicProblem() {
  ui.micNote.hidden = false;
  ui.micNote.textContent = IN_CLAUDE
    ? "Aquí el navegador no deja usar el micrófono directamente. Toca la caja de texto y usa el micrófono de tu teclado para dictar; Narvis te responde en voz alta."
    : "No tengo permiso para usar el micrófono. Habilítalo en la configuración del navegador.";
}

function createRecognition() {
  const rec = new SpeechRecognition();
  rec.lang = settings.lang;
  rec.continuous = true;
  rec.interimResults = true;

  rec.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        ui.interim.textContent = "";
        onHeard(result[0].transcript);
      } else {
        interim += result[0].transcript;
      }
    }
    if (interim) ui.interim.textContent = interim;
  };

  rec.onerror = (event) => {
    if (["not-allowed", "service-not-allowed", "audio-capture"].includes(event.error)) {
      stopListening();
      showMicProblem();
    }
    // "no-speech", "aborted" y "network" se recuperan solos en onend.
  };

  rec.onend = () => {
    if (listening && !speaking) setTimeout(startRecognition, 250);
  };
  return rec;
}

function startRecognition() {
  if (!recognition || !listening || speaking) return;
  try {
    recognition.start();
  } catch {
    /* ya estaba iniciado */
  }
}

function startListening() {
  listening = true;
  ui.toggle.setAttribute("aria-pressed", "true");
  ui.toggle.textContent = "Desactivar micrófono";
  startRecognition();
  refreshIdleState();
}

function stopListening() {
  listening = false;
  attentiveUntil = 0;
  recognition?.abort();
  ui.toggle.setAttribute("aria-pressed", "false");
  ui.toggle.textContent = "Activar micrófono";
  ui.interim.textContent = "";
  refreshIdleState();
}

// ---------- Radar de noticias ----------
const IMPORTANCE = { 3: "Alta", 2: "Media", 1: "Baja" };

function timeAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "";
  const hours = Math.round(ms / 3600000);
  if (hours < 1) return "hace menos de una hora";
  if (hours < 48) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} días`;
}

function renderTopics() {
  ui.topics.replaceChildren();
  for (const topic of [null, ...TOPICS]) {
    const count = topic ? (news?.items ?? []).filter((n) => n.topic === topic).length : news?.items?.length ?? 0;
    if (topic && count === 0) continue;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = topic ?? "Todo";
    chip.setAttribute("aria-pressed", String(topicFilter === topic));
    chip.addEventListener("click", () => {
      topicFilter = topic;
      renderNews();
    });
    ui.topics.append(chip);
  }
}

function renderNews() {
  renderTopics();
  ui.news.replaceChildren();
  if (!news?.items?.length) {
    const hasSource = IN_CLAUDE || server;
    ui.updated.textContent = hasSource ? "Sin noticias todavía" : "Sin fuente de noticias";
    const empty = document.createElement("li");
    empty.className = "news-empty";
    empty.textContent = server
      ? "Estoy buscando las noticias más importantes del día. Tarda uno o dos minutos."
      : IN_CLAUDE
      ? "El radar se llena solo varias veces al día con lo más importante del mundo."
      : "Inicia el servidor local (npm run server) para tener el radar actualizado.";
    ui.news.append(empty);
    return;
  }
  ui.updated.textContent = `Actualizado ${timeAgo(news.updatedAt)} · ${news.items.length} noticias`;
  const items = [...news.items]
    .filter((n) => !topicFilter || n.topic === topicFilter)
    .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0));
  for (const n of items) {
    const li = document.createElement("li");
    li.className = "news-item";
    li.dataset.importance = n.importance ?? 1;

    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = `${n.topic} · ${IMPORTANCE[n.importance] ?? "Baja"}`;

    const title = document.createElement("button");
    title.type = "button";
    title.className = "news-title";
    title.textContent = n.title;
    title.title = "Pedir a Narvis que lo explique";
    title.addEventListener("click", () => handle(`Explícame esta noticia y por qué importa: ${n.title}`));

    const summary = document.createElement("p");
    summary.className = "summary";
    summary.textContent = n.summary ?? "";

    const source = document.createElement("p");
    source.className = "meta";
    if (n.url) {
      const a = document.createElement("a");
      a.href = n.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = `${n.source} ↗`;
      source.append(a);
    } else {
      source.textContent = n.source;
    }
    if (n.date) source.append(` · ${n.date}`);

    li.append(meta, title, summary, source);
    ui.news.append(li);
  }
}

// ---------- Arranque ----------
function init() {
  ui.wakeMode.checked = settings.wakeWord;
  ui.lang.value = settings.lang;
  ui.voice.setAttribute("aria-pressed", String(settings.voice));
  ui.voice.textContent = settings.voice ? "Voz: activada" : "Voz: silenciada";

  for (const command of COMMANDS) {
    if (command.network && IN_CLAUDE) continue;
    const li = document.createElement("li");
    li.textContent = `«${command.help}»`;
    ui.help.append(li);
  }

  if ("speechSynthesis" in window) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }

  if (SpeechRecognition) {
    recognition = createRecognition();
  } else {
    ui.toggle.hidden = true;
    showMicProblem();
    ui.micNote.textContent =
      "Este navegador no reconoce voz. Usa el micrófono de tu teclado para dictar en la caja de texto, o abre Narvis en Chrome o Edge.";
  }

  ui.toggle.addEventListener("click", () => (listening ? stopListening() : startListening()));

  ui.voice.addEventListener("click", () => {
    settings.voice = !settings.voice;
    saveSettings();
    if (!settings.voice) window.speechSynthesis?.cancel();
    ui.voice.setAttribute("aria-pressed", String(settings.voice));
    ui.voice.textContent = settings.voice ? "Voz: activada" : "Voz: silenciada";
  });

  ui.stop.addEventListener("click", () => {
    controller?.abort();
    window.speechSynthesis?.cancel();
  });

  ui.briefing.addEventListener("click", () => handle("Dame el resumen del día"));

  ui.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = ui.input.value.trim();
    if (!text || busy) return;
    ui.input.value = "";
    handle(text);
  });

  ui.wakeMode.addEventListener("change", () => {
    settings.wakeWord = ui.wakeMode.checked;
    saveSettings();
    refreshIdleState();
  });

  ui.lang.addEventListener("change", () => {
    settings.lang = ui.lang.value;
    saveSettings();
    if ("speechSynthesis" in window) pickVoice();
    if (recognition) {
      recognition.lang = settings.lang;
      recognition.abort(); // onend la reinicia con el nuevo idioma
    }
  });

  refreshIdleState();
  renderNews();

  ui.refreshNews.addEventListener("click", async () => {
    ui.refreshNews.disabled = true;
    ui.updated.textContent = "Buscando noticias nuevas… (uno o dos minutos)";
    await store.refreshNews?.();
    ui.refreshNews.disabled = false;
    renderNews();
  });

  connect();
}

async function connect() {
  server = await detectServer();
  brain = IN_CLAUDE ? await createBrain() : await createServerBrain(server);
  ui.pill.dataset.state = brain ? "on" : "off";
  ui.pill.textContent = !brain
    ? "Sin cerebro (inicia el servidor local)"
    : server
    ? `Cerebro conectado · ${server.obsidian ? `Obsidian: ${server.obsidian}` : "sin Obsidian"}`
    : "Cerebro conectado";
  renderNews();

  store = await createStore({
    serverStatus: server,
    onNews: (data) => {
      news = data;
      renderNews();
    }
  });
  ui.refreshNews.hidden = !store.refreshNews;
}

init();
