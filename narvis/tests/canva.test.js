import { test } from "node:test";
import assert from "node:assert/strict";
import { createCanvaTools, summarizeDesigns } from "../js/canva.js";

test("summarizeDesigns deja solo lo útil", () => {
  const out = summarizeDesigns({
    items: [{ id: "D1", title: "Taller", urls: { edit_url: "https://canva.com/e", view_url: "https://canva.com/v" }, updated_at: 1790000000, page_count: 7, design_types: ["presentation"] }, { id: "D2", urls: { view_url: "https://canva.com/v2" } }]
  });
  assert.deepEqual(out[0], { titulo: "Taller", tipo: "presentation", paginas: 7, modificado: "2026-09-21", url: "https://canva.com/e" });
  assert.equal(out[1].titulo, "Sin título");
  assert.deepEqual(summarizeDesigns(undefined), []);
});

test("buscar llama al conector con la consulta", async () => {
  const calls = [];
  const mcp = { callTool: async (server, tool, input) => (calls.push({ server, tool, input }), { payload: { items: [] } }) };
  const [search] = createCanvaTools(mcp);
  assert.deepEqual(await search.execute({ consulta: "OEE" }, { signal: new AbortController().signal }), []);
  assert.equal(calls[0].server, "Canva");
  assert.equal(calls[0].tool, "search-designs");
  assert.equal(calls[0].input.query, "OEE");
  await search.execute({}, { signal: new AbortController().signal });
  assert.equal(calls[1].input.sort_by, "modified_descending");
});

test("crear espera el trabajo de Canva hasta que termina", async () => {
  const responses = [
    { payload: { job_id: "j1", continuation_token: "c1", polling_policy: { wait_seconds: 0 } } },
    { payload: { continuation_token: "c2", polling_policy: { wait_seconds: 0 }, status: "in_progress" } },
    { payload: { status: "success", design: { url: "https://canva.com/d/new" } } }
  ];
  const calls = [];
  const mcp = { callTool: async (s, tool, input) => (calls.push({ tool, input }), responses.shift()) };
  const [, create] = createCanvaTools(mcp);
  const result = await create.execute({ brief: "Presentación de OEE" }, { signal: new AbortController().signal });
  assert.equal(result.design.url, "https://canva.com/d/new");
  assert.deepEqual(calls.map((c) => c.tool), ["create-design", "get-create-design-async-job", "get-create-design-async-job"]);
  assert.equal(calls[2].input.continuation_token, "c2");
});

test("los errores del conector se explican", async () => {
  const mcp = { callTool: async () => Promise.reject({ code: "server_not_connected" }) };
  const [search] = createCanvaTools(mcp);
  await assert.rejects(search.execute({}, { signal: new AbortController().signal }), /no está conectado/);
});
