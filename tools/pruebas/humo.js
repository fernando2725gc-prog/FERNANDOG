/* Prueba de humo del andamiaje: que el almacén simulado funciona y que las
   dos aplicaciones arrancan contra él. Si esto falla, lo que está roto es
   el banco de pruebas, no la aplicación — y conviene saberlo antes de pasar
   una hora buscando en el sitio equivocado. */
const E = require("./entorno.js");
const falsoDB = require("./falsodb.js");

(async () => {
  const s = E.suite("humo");
  const b = await E.navegador();
  const ctx = await b.newContext(E.ESCRITORIO);
  await ctx.addInitScript(falsoDB);

  s.bloque("[1] El almacén simulado se comporta como el de verdad");

  const p = s.vigilar(await ctx.newPage(), "planta");
  await p.goto(E.BASE + "/interno/", { waitUntil: "networkidle" });

  await s.paso("la aplicación lo encuentra y se conecta", async () => {
    await p.waitForSelector(".conexion-ok", { timeout: 25000 });
    const o = await p.evaluate(() => DB.origen());
    if (o !== "artefacto") throw new Error("origen: " + o);
  });

  await s.paso("entrega los documentos congelados", async () => {
    const r = await p.evaluate(async () => {
      const a = await window.claude.use("db");
      const snap = await a.collection("lotes").get();
      if (!snap.docs.length) return "sin lotes";
      try {
        snap.docs[0].data().codigoLote = "MUTADO";
        return Object.isFrozen(snap.docs[0].data()) ? "congelado pero silencioso" : "mutable";
      } catch (e) { return "congelado"; }
    });
    if (r !== "congelado" && r !== "congelado pero silencioso") {
      throw new Error("los documentos salen " + r);
    }
  });

  await s.paso("sembró la demostración", async () => {
    const n = await p.evaluate(() => DB.all("lotes").length);
    if (n < 20) throw new Error("solo " + n + " lotes");
  });

  s.bloque("[2] Las dos aplicaciones comparten el mismo almacén");

  const q = s.vigilar(await ctx.newPage(), "portal");
  await q.goto(E.BASE + "/proveedor/", { waitUntil: "networkidle" });

  await s.paso("el portal ve lo que sembró la planta", async () => {
    await q.waitForSelector(".conexion-ok", { timeout: 25000 });
    const n = await q.evaluate(() => DB.all("lotes").length);
    const m = await p.evaluate(() => DB.all("lotes").length);
    if (n !== m) throw new Error("portal " + n + " vs planta " + m);
  });

  await s.paso("un cambio en una pantalla llega a la otra sin recargar", async () => {
    await p.evaluate(() => {
      const l = DB.all("lotes")[0];
      DB.update("lotes", l.id, { observacionesRecepcion: "marca-de-humo" });
    });
    await q.waitForFunction(
      () => DB.all("lotes").some((l) => l.observacionesRecepcion === "marca-de-humo"),
      null, { timeout: 15000 });
  });

  await b.close();
  s.fin();
})();
