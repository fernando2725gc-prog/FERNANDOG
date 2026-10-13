/* =========================================================================
   bascula.js — El momento del pesaje

   Es el único punto del sistema donde una persona, de pie en el patio y con
   guantes, teclea un número que luego vale dinero. Tres cosas lo protegen y
   las tres se comprueban aquí, en una pantalla de 390 px, que es la que esa
   persona tiene en la mano.

   Encontró dos errores reales: que «10,5» acababa siendo «5» —un
   input[type=number] no admite el estado intermedio «10.» y vaciaba el
   campo— y que el aviso de desviación saltaba nada más abrir el formulario,
   porque el peso todavía vacío valía cero y se leía como un −100%.
   ========================================================================= */
const E = require("./entorno.js");
const falsoDB = require("./falsodb.js");

(async () => {
  const s = E.suite("bascula");
  const b = await E.navegador();
  const ctx = await b.newContext(E.MOVIL);
  await ctx.addInitScript(falsoDB);
  const p = s.vigilar(await ctx.newPage(), "planta");
  await p.goto(E.BASE + "/interno/", { waitUntil: "networkidle" });
  await E.entrar(p, "dandrade", "4521", ".barra");
  await p.click("#btnMenu");
  await p.click('.nav-item[data-ir="recepcion"]');
  await p.waitForTimeout(800);

  const abrirPesaje = async () => {
    const fila = p.locator(".panel-destacado tbody tr").first();
    const cod = (await fila.locator("code").first().textContent()).trim();
    await fila.locator("[data-pesar]").click();
    await p.waitForSelector(".modal", { timeout: 15000 });
    return cod;
  };

  s.bloque("[1] Teclado de báscula");

  let COD = null;
  await s.paso("aparece al tocar un campo de número y dice a cuál apunta", async () => {
    COD = await abrirPesaje();
    const panel = p.locator("[data-teclado-panel]");
    if (await panel.isVisible()) throw new Error("se muestra antes de tocar nada");
    await p.locator("#campo_gavetasRecibidas").tap();
    await p.waitForTimeout(250);
    if (!await panel.isVisible()) throw new Error("no apareció");
    const destino = (await p.locator(".teclado-destino").textContent()).trim();
    if (!/Gavetas/i.test(destino)) throw new Error("apunta a: " + destino);
  });

  await s.paso("las teclas miden al menos 48 px: se pulsan con guantes", async () => {
    const caja = await p.locator(".tecla").first().boundingBox();
    if (!caja || caja.height < 48) throw new Error("alto de tecla: " + (caja && caja.height));
  });

  await s.paso("escribe y borra en el campo apuntado", async () => {
    const campo = p.locator("#campo_gavetasRecibidas");
    await campo.fill("");
    for (const t of ["1", "2", "0"]) await p.click('[data-tecla="' + t + '"]');
    if (await campo.inputValue() !== "120") throw new Error("quedó: " + await campo.inputValue());
    await p.click('[data-tecla="⌫"]');
    if (await campo.inputValue() !== "12") throw new Error("al borrar quedó: " + await campo.inputValue());
  });

  await s.paso("la coma decimal funciona, y hay un solo teclado", async () => {
    await p.locator("#campo_kgRecibidos").tap();
    await p.waitForTimeout(250);
    const destino = (await p.locator(".teclado-destino").textContent()).trim();
    if (!/Peso/i.test(destino)) throw new Error("sigue apuntando a: " + destino);
    if (await p.locator("[data-teclado-panel]").count() !== 1) {
      throw new Error("hay más de un teclado en pantalla");
    }
    await p.locator("#campo_kgRecibidos").fill("");
    for (const t of ["1", "0", ",", "5"]) await p.click('[data-tecla="' + t + '"]');
    const v = await p.locator("#campo_kgRecibidos").inputValue();
    if (v !== "10.5") throw new Error("«10,5» quedó como «" + v + "»");
  });

  await s.paso("ni el teclado ni el pie tapan el aviso ni el botón", async () => {
    const choca = await p.evaluate(() => {
      const tec = document.querySelector("[data-teclado-panel]");
      const pie = document.querySelector(".modal-pie");
      if (!tec || !pie) return "falta algo";
      const t = tec.getBoundingClientRect(), q = pie.getBoundingClientRect();
      return (t.bottom > q.top + 2 && t.top < q.bottom - 2) ? "el teclado se come el pie" : null;
    });
    if (choca) throw new Error(choca);
  });

  s.bloque("[2] Aviso de desviación");

  await s.paso("una diferencia pequeña no alarma", async () => {
    const anunciadas = await p.evaluate((c) =>
      DB.all("lotes").find((l) => l.codigoLote === c).gavetasAnunciadas, COD);
    await p.locator("#campo_gavetasRecibidas").fill(String(anunciadas));
    await p.locator("#campo_kgRecibidos").fill("");
    await p.waitForTimeout(400);
    if (await p.locator(".desvio").count()) throw new Error("avisa sin motivo");
  });

  await s.paso("una diferencia grande avisa en el momento y pide explicarla", async () => {
    const anunciadas = await p.evaluate((c) =>
      DB.all("lotes").find((l) => l.codigoLote === c).gavetasAnunciadas, COD);
    await p.locator("#campo_gavetasRecibidas").fill(String(Math.round(anunciadas * 0.8)));
    await p.waitForTimeout(400);
    const av = p.locator(".desvio");
    if (!await av.count()) throw new Error("no avisó de un 20% de diferencia");
    if (!/Observaciones/i.test(await av.textContent())) throw new Error("no dice qué hacer");
  });

  await s.paso("no deja confirmar sin explicar qué pasó", async () => {
    await p.locator("#campo_kgRecibidos").fill("500");
    await p.click(".modal button[type=submit]");
    await p.waitForTimeout(600);
    const err = p.locator("#formError");
    if (await err.isHidden()) throw new Error("guardó una desviación grave sin explicación");
    if (!/Observaciones/i.test(await err.textContent())) throw new Error("el error no dice qué hacer");
  });

  await s.paso("con la explicación escrita, sí guarda, y la desviación queda registrada", async () => {
    await p.fill("#campo_observacionesRecepcion", "Gavetas a medio llenar, se avisó al proveedor.");
    await p.click(".modal button[type=submit]");
    await p.waitForSelector(".modal", { state: "detached", timeout: 15000 });
    const l = await p.evaluate((c) => DB.all("lotes").find((x) => x.codigoLote === c), COD);
    if (l.estado !== "Recibido") throw new Error("quedó en " + l.estado);
    if (!(l.desviacionRecepcion > 0.1)) throw new Error("no guardó la desviación");
  });

  s.bloque("[3] Dos personas pesando el mismo lote");

  await s.paso("si otra persona se adelantó, no se pisa su dato", async () => {
    const cod2 = await abrirPesaje();
    await p.evaluate((c) => {
      const l = DB.all("lotes").find((x) => x.codigoLote === c);
      DB.update("lotes", l.id, {
        estado: "Recibido", gavetasRecibidas: 99, kgRecibidos: 1000,
        recibidoPor: "us_03", fechaRecepcion: DB.hoy()
      });
    }, cod2);
    await p.fill("#campo_kgRecibidos", "777");
    await p.click(".modal button[type=submit]");
    await p.waitForTimeout(700);
    const err = p.locator("#formError");
    if (await err.isHidden()) throw new Error("guardó encima del trabajo de la otra persona");
    const t = await err.textContent();
    if (!/ya pesó/i.test(t)) throw new Error("no explica qué pasó: " + t);
    if (!/Corregir pesaje/i.test(t)) throw new Error("no dice qué hacer en su lugar");
    const l = await p.evaluate((c) => DB.all("lotes").find((x) => x.codigoLote === c), cod2);
    if (l.kgRecibidos !== 1000) throw new Error("el dato ajeno se perdió");
  });

  await b.close();
  s.fin();
})();
