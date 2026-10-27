import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeSessions, summarizeRepos, createProjectTools } from "../js/projects.js";
import { rankVoice, bestVoices, voiceQuality, splitSentences } from "../js/voice.js";
import { buildBrain } from "../js/hologram.js";

test("summarizeSessions acepta la lista directa o envuelta", () => {
  const session = { id: "s1", title: "App de tesis", status_bucket: "SESSION_STATUS_BUCKET_WORKING", updated_at: "2026-10-13T04:16:42Z", post_turn_summary: { recent_action: "Pruebas listas" } };
  const expected = [{ id: "s1", titulo: "App de tesis", estado: "en curso", actualizado: "2026-10-13", ultimo_avance: "Pruebas listas" }];
  assert.deepEqual(summarizeSessions({ data: [session] }), expected);
  assert.deepEqual(summarizeSessions({ ccr: { data: [session] } }), expected);
  assert.deepEqual(summarizeSessions(null), []);
  assert.equal(summarizeSessions({ data: [{ id: "x" }] })[0].estado, "inactivo");
});

test("summarizeRepos resume los repositorios", () => {
  assert.deepEqual(summarizeRepos({ repos: [{ full_name: "a/b", url: "https://github.com/a/b", pushed_at: "2026-10-27T16:21:02Z" }] }), [
    { nombre: "a/b", url: "https://github.com/a/b", ultimo_cambio: "2026-10-27" }
  ]);
});

test("las herramientas de proyectos llaman al conector correcto", async () => {
  const calls = [];
  const mcp = { callTool: async (server, tool, input) => (calls.push({ server, tool, input }), { payload: { data: [] } }) };
  const [list, detail] = createProjectTools(mcp);
  await list.execute({}, { signal: undefined });
  await detail.execute({ id: "s9" }, { signal: undefined });
  assert.deepEqual(calls.map((c) => [c.server, c.tool]), [["Claude Code Remote", "list_sessions"], ["Claude Code Remote", "get_session"]]);
  assert.equal(calls[0].input.mine, true);
  assert.equal(calls[1].input.session_id, "s9");
});

test("rankVoice prefiere voces naturales en español de México", () => {
  const voices = [
    { name: "Microsoft Sabina - Spanish (Mexico)", lang: "es-MX", localService: true, voiceURI: "a" },
    { name: "Microsoft Dalia Online (Natural) - Spanish (Mexico)", lang: "es-MX", localService: false, voiceURI: "b" },
    { name: "Google español", lang: "es-ES", localService: false, voiceURI: "c" },
    { name: "Samantha", lang: "en-US", localService: true, voiceURI: "d" }
  ];
  assert.deepEqual(bestVoices(voices).map((v) => v.voiceURI), ["b", "c", "a"]);
  assert.equal(rankVoice(voices[3]), -1);
  assert.equal(voiceQuality(voices[1]), "natural");
  assert.equal(voiceQuality(voices[0]), "básica");
});

test("splitSentences corta en frases sin perder texto", () => {
  const text = "El OEE es 81%. La pérdida mayor es rendimiento; hay microparos. ¿Siguiente paso? Medir.";
  const parts = splitSentences(text, 40);
  assert.ok(parts.every((p) => p.length <= 60));
  assert.equal(parts.join(" ").replace(/\s+/g, " "), text);
  assert.deepEqual(splitSentences("  "), []);
  const long = splitSentences("uno, dos, tres, cuatro, cinco, seis, siete, ocho, nueve, diez, once, doce", 30);
  assert.ok(long.length > 1);
});

test("buildBrain genera siempre la misma red conectada", () => {
  const a = buildBrain({ nodes: 120 });
  const b = buildBrain({ nodes: 120 });
  assert.deepEqual(a.points[5], b.points[5]);
  assert.ok(a.points.length >= 110);
  assert.ok(a.edges.length >= a.points.length);
  assert.ok(a.edges.every(([i, j]) => i !== j && a.points[i] && a.points[j]));
});
