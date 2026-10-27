import { test } from "node:test";
import assert from "node:assert/strict";
import { CANVA_RULES } from "../js/canva.js";
import { buildMessages, pickTier, normalizeAnswer, quadrant, partialField, formatMemory, errorMessage } from "../js/brain.js";

test("buildMessages incluye reglas, formato, memoria y nombre, y termina en la pregunta", () => {
  const history = [{ role: "user", content: "hola" }, { role: "assistant", content: "Hola." }];
  const msgs = buildMessages({
    question: "¿Cómo bajo el scrap?",
    history,
    memory: ["Trabaja en una planta de inyección de plástico"],
    name: "Fernando",
    toolRules: [CANVA_RULES],
    now: new Date(2026, 9, 27, 12)
  });
  const ctx = msgs[0].content;
  assert.match(ctx, /ingeniero de producción/);
  assert.match(ctx, /Sé crítico de verdad/);
  assert.match(ctx, /"acciones"/);
  assert.match(ctx, /canva_buscar_disenos/);
  assert.match(ctx, /Fernando/);
  assert.match(ctx, /inyección de plástico/);
  assert.match(ctx, /2026/);
  assert.deepEqual(msgs.slice(1, 3), history);
  assert.deepEqual(msgs.at(-1), { role: "user", content: "¿Cómo bajo el scrap?" });
  assert.doesNotMatch(buildMessages({ question: "x" })[0].content, /canva_buscar_disenos/);
});

test("buildMessages limita el historial a 10 turnos", () => {
  const history = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `t${i}` }));
  const msgs = buildMessages({ question: "x", history });
  assert.equal(msgs.length, 12);
  assert.equal(msgs[1].content, "t10");
});

test("formatMemory avisa cuando no hay memoria", () => {
  assert.match(formatMemory([]), /todavía no sabes nada/);
  assert.match(formatMemory(["a", "b"]), /- a\n- b/);
});

test("pickTier usa el modelo rápido solo para cortesías", () => {
  assert.equal(pickTier("Hola"), "quick");
  assert.equal(pickTier("Gracias!"), "quick");
  assert.equal(pickTier("Hola, ayúdame a calcular el OEE de mi línea con estos datos"), "default");
  assert.equal(pickTier("¿Cuál es el takt time?"), "default");
});

test("normalizeAnswer tolera campos faltantes y valores raros", () => {
  const a = normalizeAnswer({
    respuesta: "El OEE es 68%. Ataca disponibilidad.",
    acciones: [{ accion: "Aplicar SMED", impacto: "ALTO", esfuerzo: "x", indicador: "Minutos de cambio" }, { porque: "sin acción" }],
    critica: ["Faltan datos de paros", 3],
    enlaces: [{ titulo: "Mal", url: "javascript:alert(1)" }, { url: "https://canva.com/d/1" }]
  });
  assert.equal(a.voz, "El OEE es 68%. Ataca disponibilidad.");
  assert.deepEqual(a.acciones, [{ accion: "Aplicar SMED", porque: "", impacto: "alto", esfuerzo: "medio", indicador: "Minutos de cambio" }]);
  assert.deepEqual(a.critica, ["Faltan datos de paros"]);
  assert.deepEqual(a.enlaces, [{ titulo: "https://canva.com/d/1", url: "https://canva.com/d/1" }]);
  assert.deepEqual(normalizeAnswer(null).recordar, []);
});

test("quadrant ubica cada acción en la matriz impacto-esfuerzo", () => {
  assert.equal(quadrant({ impacto: "alto", esfuerzo: "bajo" }), "Ganancia rápida");
  assert.equal(quadrant({ impacto: "medio", esfuerzo: "bajo" }), "Ganancia rápida");
  assert.equal(quadrant({ impacto: "alto", esfuerzo: "alto" }), "Proyecto estratégico");
  assert.equal(quadrant({ impacto: "bajo", esfuerzo: "bajo" }), "Ajuste menor");
  assert.equal(quadrant({ impacto: "bajo", esfuerzo: "alto" }), "Reconsiderar");
});

test("partialField lee la respuesta mientras se escribe el JSON", () => {
  assert.equal(partialField('{"voz": "Hola", "respuesta": "El OEE es'), "El OEE es");
  assert.equal(partialField('{"respuesta": "Línea 1\\nLínea \\"2\\" \\u00e9xito", "critica": []}'), 'Línea 1\nLínea "2" éxito');
  assert.equal(partialField('{"voz": "x"'), "");
  assert.equal(partialField('{"respuesta": "a\\'), "a");
});

test("errorMessage explica cada fallo", () => {
  assert.match(errorMessage("not_granted"), /permiso/);
  assert.match(errorMessage("rate_limited"), /límite/);
  assert.match(errorMessage("otro"), /conexión/);
});
