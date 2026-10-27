// Interfaz y voz de Jarvis: micrófono (SpeechRecognition), voz (speechSynthesis)
// y el "contexto" que usan los comandos de commands.js.
import { respond, stripWakeWord, COMMANDS } from "./commands.js";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const ATTENTION_MS = 8000; // tras decir solo "Jarvis", escucha sin palabra clave durante este tiempo
const NOTES_KEY = "jarvis.notes";
const SETTINGS_KEY = "jarvis.settings";

const $ = (sel) => document.querySelector(sel);
const ui = {
  core: $("#core"),
  status: $("#status"),
  toggle: $("#toggle"),
  log: $("#log"),
  form: $("#text-form"),
  input: $("#text-input"),
  interim: $("#interim"),
  wakeMode: $("#wake-mode"),
  lang: $("#lang"),
  support: $("#support"),
  timers: $("#timers"),
  help: $("#help-list")
};

// ---------- Almacenamiento (puede fallar en modo privado) ----------
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sin persistencia, no pasa nada */
  }
}

const settings = { wakeWord: true, lang: "es-MX", ...load(SETTINGS_KEY, {}) };
let notes = load(NOTES_KEY, []);

// ---------- Estado ----------
let recognition = null;
let listening = false; // el usuario activó el micrófono
let speaking = false;
let attentiveUntil = 0;

function setState(state, text) {
  ui.core.dataset.state = state; // idle | listening | attentive | thinking | speaking
  ui.status.textContent = text;
}

function refreshIdleState() {
  if (speaking) return;
  if (!listening) setState("idle", "Micrófono apagado");
  else if (Date.now() < attentiveUntil) setState("attentive", "Te escucho…");
  else if (settings.wakeWord) setState("listening", "Di «Jarvis» seguido de tu orden");
  else setState("attentive", "Escuchando…");
}

// ---------- Registro de conversación ----------
function addMessage(who, text, link) {
  const item = document.createElement("li");
  item.className = `msg msg-${who}`;
  const p = document.createElement("p");
  p.textContent = text;
  item.append(p);
  if (link) {
    const a = document.createElement("a");
    a.href = link.url;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = `Abrir ${link.label} ↗`;
    item.append(a);
  }
  ui.log.append(item);
  item.scrollIntoView({ behavior: "smooth", block: "end" });
  return item;
}

// ---------- Voz ----------
let voice = null;
function pickVoice() {
  const voices = speechSynthesis.getVoices();
  const base = settings.lang.slice(0, 2);
  voice =
    voices.find((v) => v.lang === settings.lang) ??
    voices.find((v) => v.lang.startsWith(base)) ??
    null;
}

function speak(text) {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) return resolve();
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = settings.lang;
    if (voice) utterance.voice = voice;
    utterance.rate = 1.02;
    utterance.pitch = 0.9;
    speaking = true;
    setState("speaking", "Hablando…");
    // Pausamos el micrófono para que Jarvis no se escuche a sí mismo.
    recognition?.abort();
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
  pendingLink: null,
  openUrl(url, label) {
    // Los navegadores suelen bloquear ventanas abiertas fuera de un clic,
    // así que además dejamos un enlace en la conversación.
    ctx.pendingLink = { url, label };
    window.open(url, "_blank", "noopener");
  },
  notes: {
    add(note) {
      notes.push(note);
      save(NOTES_KEY, notes);
    },
    list: () => [...notes],
    clear() {
      notes = [];
      save(NOTES_KEY, notes);
    }
  },
  startTimer(seconds, label) {
    const end = Date.now() + seconds * 1000;
    const row = document.createElement("li");
    ui.timers.append(row);
    const tick = () => {
      const left = Math.max(0, Math.round((end - Date.now()) / 1000));
      const m = String(Math.floor(left / 60)).padStart(2, "0");
      const s = String(left % 60).padStart(2, "0");
      row.textContent = `⏱ ${label} — ${m}:${s}`;
      if (left === 0) {
        clearInterval(id);
        row.remove();
        addMessage("jarvis", `Tu temporizador de ${label} terminó.`);
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
  stop() {
    stopListening();
  }
};

// ---------- Procesar una orden ----------
async function handle(text) {
  addMessage("user", text);
  setState("thinking", "Procesando…");
  ctx.pendingLink = null;
  const answer = await respond(text, ctx);
  addMessage("jarvis", answer, ctx.pendingLink);
  attentiveUntil = 0;
  await speak(answer);
}

function onHeard(transcript) {
  if (speaking) return;
  if (!settings.wakeWord || Date.now() < attentiveUntil) {
    const order = stripWakeWord(transcript) ?? transcript;
    if (order.trim()) handle(order.trim());
    return;
  }
  const order = stripWakeWord(transcript);
  if (order === null) return; // no iba dirigido a Jarvis
  if (order) {
    handle(order);
  } else {
    attentiveUntil = Date.now() + ATTENTION_MS;
    speak("¿Sí?").then(() => {
      attentiveUntil = Date.now() + ATTENTION_MS;
      refreshIdleState();
      setTimeout(refreshIdleState, ATTENTION_MS + 50);
    });
  }
}

// ---------- Reconocimiento de voz ----------
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
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      listening = false;
      ui.toggle.setAttribute("aria-pressed", "false");
      ui.toggle.textContent = "Activar micrófono";
      addMessage("jarvis", "No tengo permiso para usar el micrófono. Habilítalo en el navegador.");
      refreshIdleState();
    }
    // "no-speech", "aborted" y "network" se recuperan solos en onend.
  };

  // Chrome corta la escucha cada cierto tiempo: la reanudamos.
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
  if (!recognition) return;
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

// ---------- Arranque ----------
function init() {
  ui.wakeMode.checked = settings.wakeWord;
  ui.lang.value = settings.lang;

  for (const command of COMMANDS) {
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
    ui.toggle.disabled = true;
    ui.support.hidden = false;
  }

  ui.toggle.addEventListener("click", () => {
    if (listening) {
      stopListening();
    } else {
      startListening();
      if (!ui.log.children.length) {
        const greeting = "Jarvis en línea. Di Jarvis seguido de tu orden.";
        addMessage("jarvis", greeting);
        speak(greeting);
      }
    }
  });

  ui.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = ui.input.value.trim();
    if (!text) return;
    ui.input.value = "";
    handle(text);
  });

  ui.wakeMode.addEventListener("change", () => {
    settings.wakeWord = ui.wakeMode.checked;
    save(SETTINGS_KEY, settings);
    refreshIdleState();
  });

  ui.lang.addEventListener("change", () => {
    settings.lang = ui.lang.value;
    save(SETTINGS_KEY, settings);
    if ("speechSynthesis" in window) pickVoice();
    if (recognition) {
      recognition.lang = settings.lang;
      recognition.abort(); // onend la reinicia con el nuevo idioma
    }
  });

  refreshIdleState();
}

init();
