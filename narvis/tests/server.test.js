import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createVault, safeTitle } from "../server/vault.js";
import { buildRequest, createClaudeBrain, MODEL } from "../server/claude.js";

const NOW = new Date(2026, 9, 27, 9, 30);

async function makeVault() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "narvis-vault-"));
  await fs.mkdir(path.join(root, "Proyectos"));
  await fs.mkdir(path.join(root, ".obsidian"));
  await fs.writeFile(path.join(root, "Proyectos", "Casa.md"), "# Casa\n\nPintar la cocina en noviembre.\n");
  await fs.writeFile(path.join(root, "Ideas.md"), "Libro sobre inteligencia artificial y medicina.\n");
  await fs.writeFile(path.join(root, ".obsidian", "config.md"), "cocina oculta\n");
  return { root, vault: createVault({ root, now: () => NOW }) };
}

test("search encuentra notas por contenido e ignora .obsidian", async () => {
  const { vault } = await makeVault();
  const results = await vault.search("cocina");
  assert.equal(results.length, 1);
  assert.equal(results[0].ruta, "Proyectos/Casa.md");
  assert.match(results[0].extracto, /Pintar la cocina/);
});

test("read lee notas y bloquea rutas fuera de la bóveda", async () => {
  const { vault } = await makeVault();
  assert.match(await vault.read("Proyectos/Casa"), /Pintar/);
  await assert.rejects(vault.read("../../etc/passwd"), /sale de la bóveda/);
  await assert.rejects(vault.read("/etc/hosts"), /ENOENT|sale de la bóveda/);
});

test("createNote escribe en la carpeta de Narvis y agrega si ya existe", async () => {
  const { root, vault } = await makeVault();
  assert.deepEqual(await vault.createNote("Ideas de viaje", "- Oaxaca"), { ruta: "Narvis/Ideas de viaje.md", nueva: true });
  assert.deepEqual(await vault.createNote("Ideas de viaje", "- Chiapas"), { ruta: "Narvis/Ideas de viaje.md", nueva: false });
  const text = await fs.readFile(path.join(root, "Narvis", "Ideas de viaje.md"), "utf8");
  assert.match(text, /^- Oaxaca\n/);
  assert.match(text, /## 2026-10-27 .*\n\n- Chiapas/);
  assert.equal(safeTitle("a/../b:c"), "a .. b c");
});

test("appendToNote agrega sin borrar", async () => {
  const { root, vault } = await makeVault();
  await vault.appendToNote("Ideas.md", "- Capítulo 1: diagnóstico");
  assert.equal(await fs.readFile(path.join(root, "Ideas.md"), "utf8"),
    "Libro sobre inteligencia artificial y medicina.\n\n- Capítulo 1: diagnóstico\n");
});

test("notas rápidas en Narvis/Notas.md", async () => {
  const { root, vault } = await makeVault();
  await vault.notes.add("comprar leche");
  await vault.notes.add("llamar a mamá");
  assert.deepEqual(await vault.notes.list(), ["comprar leche", "llamar a mamá"]);
  await vault.notes.clear();
  assert.deepEqual(await vault.notes.list(), []);
  const file = await fs.readFile(path.join(root, "Narvis", "Notas.md"), "utf8");
  assert.match(file, /- \[x\] comprar leche \(2026-10-27\)/); // queda el historial
});

test("saveBriefing y saveNews escriben notas del día", async () => {
  const { root, vault } = await makeVault();
  assert.equal(await vault.saveBriefing("Hoy pasó algo."), "Narvis/Resúmenes/2026-10-27.md");
  await vault.saveNews({ updatedAt: "x", items: [{ topic: "Economía", title: "La Fed", summary: "Sin cambios.", source: "AP", url: "https://a.b" }] });
  const news = await fs.readFile(path.join(root, "Narvis", "Noticias", "2026-10-27.md"), "utf8");
  assert.match(news, /\*\*\[Economía\] La Fed\*\* — Sin cambios\. \(\[AP\]\(https:\/\/a\.b\)\)/);
});

test("buildRequest arma instrucciones fijas, contexto y herramientas", async () => {
  const { vault } = await makeVault();
  const req = buildRequest({
    question: "¿Qué tengo anotado sobre la casa?",
    history: [{ role: "assistant", content: "hola" }, { role: "user", content: "a" }, { role: "assistant", content: "b" }],
    news: null,
    vault,
    now: NOW
  });
  assert.equal(req.model, MODEL);
  assert.equal(req.fallbacks, "default");
  assert.deepEqual(req.betas, ["server-side-fallback-2026-07-01"]);
  assert.match(req.system[0].text, /Eres Narvis/);
  assert.match(req.system[0].text, /Obsidian/);
  assert.equal(req.system[0].cache_control.type, "ephemeral");
  assert.deepEqual(req.messages.map((m) => m.role), ["user", "assistant", "user"]); // el historial empieza en user
  assert.match(req.messages.at(-1).content, /2026/);
  assert.match(req.messages.at(-1).content, /qué tengo anotado/i);
  assert.equal(req.output_config.effort, "low");
  const names = req.tools.map((t) => t.name);
  assert.deepEqual(names, ["web_search", "buscar_en_obsidian", "leer_nota_obsidian", "notas_recientes_obsidian", "crear_nota_obsidian", "agregar_a_nota_obsidian"]);

  const noVault = buildRequest({ question: "Explícame la inflación", news: null });
  assert.deepEqual(noVault.tools.map((t) => t.name), ["web_search"]);
  assert.doesNotMatch(noVault.system[0].text, /Obsidian/);
  assert.equal(noVault.output_config.effort, "medium");
});

// Cliente falso con la forma del runner de herramientas en modo stream.
function fakeClient(turns) {
  return {
    beta: {
      messages: {
        toolRunner: (params) => ({
          params,
          async *[Symbol.asyncIterator]() {
            for (const turn of turns) {
              yield {
                async *[Symbol.asyncIterator]() {
                  for (const text of turn.texts) yield { type: "content_block_delta", delta: { type: "text_delta", text } };
                },
                finalMessage: async () => ({ stop_reason: turn.stop, content: turn.content ?? [] })
              };
            }
          }
        })
      }
    }
  };
}

test("ask transmite el texto de cada vuelta y separa vueltas", async () => {
  const brain = createClaudeBrain({
    client: fakeClient([
      { texts: ["Déjame ", "revisar."], stop: "tool_use", content: [{ type: "tool_use" }] },
      { texts: ["Tienes una nota: pintar la cocina."], stop: "end_turn" }
    ])
  });
  const chunks = [];
  const text = await brain.ask({ question: "¿qué tengo?", onText: (c) => chunks.push(c) });
  assert.equal(text, "Déjame revisar.\n\nTienes una nota: pintar la cocina.");
  assert.equal(chunks.join(""), text);
});

test("ask avisa cuando hay un rechazo sin texto", async () => {
  const brain = createClaudeBrain({ client: fakeClient([{ texts: [], stop: "refusal" }]) });
  assert.match(await brain.ask({ question: "x" }), /Prefiero no responder/);
});
