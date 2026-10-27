import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMessages, pickTier, cleanForSpeech, formatNews, headlinesText, errorMessage } from "../js/brain.js";

const NEWS = {
  updatedAt: "2026-10-27T18:00:00Z",
  items: [
    { title: "Sismo de 4.6 en Chiapas", summary: "Sin daños.", topic: "México", importance: 1, source: "Infobae" },
    { title: "Elecciones en Israel", summary: "Netanyahu busca otro mandato.", topic: "Geopolítica", importance: 3, source: "Democracy Now", date: "27 oct" },
    { title: "La Fed se reúne", summary: "Se espera que no cambie tasas.", topic: "Economía", importance: 2, source: "TheStreet" }
  ]
};

test("buildMessages empieza con las reglas y termina con la pregunta", () => {
  const history = [{ role: "user", content: "hola" }, { role: "assistant", content: "Hola." }];
  const msgs = buildMessages({ question: "¿Qué pasa con el petróleo?", history, news: NEWS, now: new Date(2026, 9, 27, 12) });
  assert.equal(msgs[0].role, "user");
  assert.match(msgs[0].content, /Eres Narvis/);
  assert.match(msgs[0].content, /Elecciones en Israel/);
  assert.match(msgs[0].content, /2026/);
  assert.deepEqual(msgs.slice(1, 3), history);
  assert.deepEqual(msgs.at(-1), { role: "user", content: "¿Qué pasa con el petróleo?" });
});

test("buildMessages limita el historial", () => {
  const history = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `t${i}` }));
  const msgs = buildMessages({ question: "x", history, news: null });
  assert.equal(msgs.length, 1 + 8 + 1);
  assert.equal(msgs[1].content, "t12");
});

test("el modo resumen pide el informe del día", () => {
  const msgs = buildMessages({ question: "dame las noticias", mode: "briefing", news: NEWS });
  assert.match(msgs.at(-1).content, /resumen del día/);
  assert.match(msgs.at(-1).content, /dame las noticias/);
});

test("formatNews ordena por importancia y avisa si no hay noticias", () => {
  const text = formatNews(NEWS);
  assert.ok(text.indexOf("Israel") < text.indexOf("Fed"));
  assert.ok(text.indexOf("Fed") < text.indexOf("Chiapas"));
  assert.match(formatNews(null), /no hay noticias/);
});

test("pickTier usa el modelo capaz para análisis", () => {
  assert.equal(pickTier("¿Qué hora es en Tokio?"), "quick");
  assert.equal(pickTier("Explícame por qué sube el dólar"), "default");
  assert.equal(pickTier("Analiza la elección"), "default");
  assert.equal(pickTier("hola", "briefing"), "default");
});

test("cleanForSpeech quita markdown y enlaces", () => {
  assert.equal(cleanForSpeech("**Hola**, mira https://x.com\n\n- uno\n- dos"), "Hola, mira \nuno\ndos");
});

test("headlinesText lee los titulares sin cerebro", () => {
  assert.equal(headlinesText(NEWS, 2),
    "Los titulares más importantes: Elecciones en Israel, según Democracy Now. La Fed se reúne, según TheStreet.");
  assert.equal(headlinesText(null), "Todavía no tengo noticias cargadas.");
});

test("errorMessage explica cada fallo", () => {
  assert.match(errorMessage("not_granted"), /permiso/);
  assert.match(errorMessage("rate_limited"), /momento/);
  assert.match(errorMessage("algo_raro"), /conexión/);
});
