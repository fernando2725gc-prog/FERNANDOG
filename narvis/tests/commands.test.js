// Ejecutar con: npm test (desde narvis/)
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, stripWakeWord, calculate, parseDuration, matchCommand, respond } from "../js/commands.js";

function fakeCtx(overrides = {}) {
  const notes = [];
  const ctx = {
    opened: [],
    timers: [],
    stopped: false,
    now: () => new Date(2026, 9, 27, 9, 5),
    openUrl: (url, label) => ctx.opened.push({ url, label }),
    notes: { add: (n) => notes.push(n), list: () => [...notes], clear: () => notes.splice(0) },
    startTimer: (seconds, label) => ctx.timers.push({ seconds, label }),
    fetchJson: async () => ({}),
    briefing: async (phrase) => `BRIEFING:${phrase}`,
    stop: () => { ctx.stopped = true; },
    ...overrides
  };
  return ctx;
}

test("normalize quita acentos, signos y mayúsculas", () => {
  assert.equal(normalize("¿Qué HORA es?"), "que hora es");
  assert.equal(normalize("  Ábreme   YouTube! "), "abreme youtube");
});

test("stripWakeWord detecta la palabra de activación", () => {
  assert.equal(stripWakeWord("Narvis, ¿qué hora es?"), "que hora es");
  assert.equal(stripWakeWord("Oye Narvis abre YouTube"), "abre youtube");
  assert.equal(stripWakeWord("Marvis dime la hora"), "dime la hora"); // así lo suele oír el reconocedor
  assert.equal(stripWakeWord("Narvis"), "");
  assert.equal(stripWakeWord("qué hora es"), null);
  assert.equal(stripWakeWord("narvisito"), null);
});

test("calculate entiende palabras y precedencia", () => {
  assert.equal(calculate("25 por 4"), 100);
  assert.equal(calculate("2 mas 3 por 4"), 14);
  assert.equal(calculate("10 dividido entre 4"), 2.5);
  assert.equal(calculate("2 elevado a 10"), 1024);
  assert.equal(calculate("cinco menos dos"), 3);
  assert.equal(calculate("7 multiplicado por 6"), 42);
  assert.equal(calculate("1 entre 0"), null);
  assert.equal(calculate("el sentido de la vida"), null);
});

test("parseDuration convierte duraciones habladas a segundos", () => {
  assert.equal(parseDuration("5 minutos"), 300);
  assert.equal(parseDuration("un minuto"), 60);
  assert.equal(parseDuration("30 segundos"), 30);
  assert.equal(parseDuration("media hora"), 1800);
  assert.equal(parseDuration("una hora y media"), 5400);
  assert.equal(parseDuration("mucho rato"), null);
});

test("cada frase va al comando correcto", () => {
  const cases = {
    "Hola": "saludo",
    "¿Qué hora es?": "hora",
    "¿Qué día es hoy?": "fecha",
    "¿Cuánto es 3 más 4?": "calcular",
    "Pon un temporizador de 5 minutos": "temporizador",
    "Anota comprar leche": "anotar",
    "Lee mis notas": "leer notas",
    "Borra mis notas": "borrar notas",
    "Pon música relajante en YouTube": "youtube",
    "¿Qué está pasando en el mundo?": "noticias",
    "Dame las noticias": "noticias",
    "Narvis, dame el resumen del día": "noticias",
    "Abre YouTube": "abrir",
    "Busca recetas de pasta": "buscar",
    "¿Cómo está el clima en Monterrey?": "clima",
    "¿Qué tiempo hace en Madrid?": "clima",
    "¿Quién es Marie Curie?": "wikipedia",
    "Cuéntame un chiste": "chiste",
    "¿Quién eres?": "identidad",
    "¿Qué puedes hacer?": "ayuda",
    "Apágate": "apagar"
  };
  for (const [phrase, expected] of Object.entries(cases)) {
    assert.equal(matchCommand(phrase)?.command.name, expected, phrase);
  }
  assert.equal(matchCommand("blablabla"), null);
  assert.equal(matchCommand("¿Por qué sube el petróleo?"), null); // va al cerebro
});

test("sin acceso a internet, clima y Wikipedia pasan al cerebro", () => {
  assert.equal(matchCommand("¿Quién es Marie Curie?", { canFetch: false }), null);
  assert.equal(matchCommand("clima en Monterrey", { canFetch: false }), null);
});

test("lo que no es un comando devuelve null", async () => {
  assert.equal(await respond("¿Qué opinas de la inflación?", fakeCtx()), null);
});

test("noticias usa el resumen del contexto", async () => {
  assert.equal(await respond("qué está pasando en el mundo", fakeCtx()), "BRIEFING:que esta pasando en el mundo");
});

test("respuestas de hora, cuentas y notas", async () => {
  const ctx = fakeCtx();
  assert.match(await respond("qué hora es", ctx), /^Son las 9:05/);
  assert.equal(await respond("cuánto es 12 por 8", ctx), "El resultado es 96.");
  await respond("anota comprar leche", ctx);
  await respond("apunta llamar a mamá", ctx);
  assert.equal(await respond("lee mis notas", ctx), "Tienes 2 notas. 1: comprar leche. 2: llamar a mamá.");
  await respond("borra mis notas", ctx);
  assert.equal(await respond("lee mis notas", ctx), "No tienes notas guardadas.");
});

test("originalTail conserva acentos y mayúsculas", async () => {
  const ctx = fakeCtx();
  await respond("Narvis, anota revisar la reunión de la Fed.", ctx);
  assert.deepEqual(await ctx.notes.list(), ["revisar la reunión de la Fed"]);
});

test("abrir y buscar generan la URL correcta", async () => {
  const ctx = fakeCtx();
  await respond("abre youtube", ctx);
  await respond("abre wikipedia.org", ctx);
  await respond("busca recetas de pasta", ctx);
  assert.deepEqual(ctx.opened.map((o) => o.url), [
    "https://www.youtube.com",
    "https://wikipedia.org",
    "https://www.google.com/search?q=recetas%20de%20pasta"
  ]);
});

test("temporizador y apagado usan el contexto", async () => {
  const ctx = fakeCtx();
  assert.equal(await respond("pon un temporizador de 2 minutos", ctx),
    "Temporizador de 2 minutos en marcha. Te aviso cuando termine.");
  assert.deepEqual(ctx.timers, [{ seconds: 120, label: "2 minutos" }]);
  await respond("adiós", ctx);
  assert.equal(ctx.stopped, true);
});

test("clima consulta Open-Meteo", async () => {
  const ctx = fakeCtx({
    fetchJson: async (url) =>
      url.includes("geocoding")
        ? { results: [{ name: "Monterrey", latitude: 25.67, longitude: -100.31 }] }
        : { current: { temperature_2m: 28.4, apparent_temperature: 30.1, relative_humidity_2m: 40, weather_code: 0 } }
  });
  assert.equal(await respond("clima en monterrey", ctx),
    "En Monterrey hay 28 grados, despejado, con sensación térmica de 30 y humedad del 40 por ciento.");
});

test("un fallo de red no rompe a Jarvis", async () => {
  const original = console.error;
  console.error = () => {};
  try {
    const ctx = fakeCtx({ fetchJson: async () => { throw new Error("offline"); } });
    assert.match(await respond("quién es Marie Curie", ctx), /Revisa tu conexión/);
  } finally {
    console.error = original;
  }
});
