/* =========================================================================
   sin-servidor.js — Cuando la base está configurada pero no responde

   Es el caso que más fácil se olvida y el que más daño hace: dentro del
   artefacto de Claude la red de salida está restringida, y lo mismo pasaría
   en una caída de Supabase. Si la aplicación da por hecho que hay servidor
   solo porque hay configuración, pide una contraseña que nadie va a
   comprobar y no entra nadie.

   Eso llegó a ocurrir. Ahora la aplicación le pregunta a la base si la
   autenticación está instalada —y un 401 cuenta como «sí»: la tabla está,
   lo que falta es la sesión— y si no la alcanza, vuelve al acceso local.
   ========================================================================= */
const E = require("./entorno.js");
const falsoDB = require("./falsodb.js");

(async () => {
  const s = E.suite("sin-servidor");
  const b = await E.navegador();

  s.bloque("[1] Base inalcanzable: se entra igual, por el acceso local");

  const ctx = await b.newContext(E.ESCRITORIO);
  await ctx.addInitScript(() => {
    window.ACOPIA_NUBE = { url: "https://no-responde-nunca.invalid", clave: "sb_publishable_x" };
    delete window.claude;
  });
  const p = s.vigilar(await ctx.newPage(), "planta");
  await p.goto(E.BASE + "/interno/", { waitUntil: "networkidle" });
  await p.waitForSelector(".acceso-caja", { timeout: 25000 });
  await p.waitForTimeout(5000);

  await s.paso("la aplicación sabe que no hay servidor de acceso", async () => {
    const d = await p.evaluate(() => ({
      configurada: Nube.configurada(),
      sesion: Sesion.disponible(),
      fallo: Nube.diagnostico().fallo && Nube.diagnostico().fallo.codigo
    }));
    if (!d.configurada) throw new Error("la prueba no configuró la nube");
    if (d.sesion) throw new Error("cree que hay servidor de acceso y no lo hay");
    if (d.fallo !== "sin-red") throw new Error("diagnóstico: " + d.fallo);
  });

  await s.paso("no ofrece activar cuentas que ningún servidor va a crear", async () => {
    if (await p.locator("#btnActivarInterno").count()) {
      throw new Error("ofrece «Activa tu cuenta» sin servidor detrás");
    }
  });

  await s.paso("y se entra con el acceso local", async () => {
    await E.entrar(p, "aquiroz", "supervision2026");
    await p.waitForSelector(".lateral", { timeout: 25000 });
  });

  await ctx.close();

  s.bloque("[2] Sin configuración: todo se comporta como siempre");

  const ctx2 = await b.newContext(E.ESCRITORIO);
  await ctx2.addInitScript(falsoDB);
  const q = s.vigilar(await ctx2.newPage(), "artefacto");
  await q.goto(E.BASE + "/interno/", { waitUntil: "networkidle" });

  await s.paso("usa el almacén del artefacto y el acceso local", async () => {
    await q.waitForSelector(".conexion-ok", { timeout: 25000 });
    await q.waitForTimeout(1500);
    const d = await q.evaluate(() => ({ origen: DB.origen(), sesion: Sesion.disponible() }));
    if (d.origen !== "artefacto") throw new Error("origen: " + d.origen);
    if (d.sesion) throw new Error("cree que hay servidor de acceso");
  });

  await s.paso("ofrece las cuentas de demostración", async () => {
    if (!await q.locator(".demo").count()) throw new Error("no ofrece ninguna");
  });

  await s.paso("y se entra con ellas", async () => {
    await E.entrar(q, "aquiroz", "supervision2026");
    await q.waitForSelector(".lateral", { timeout: 25000 });
  });

  await b.close();
  s.fin();
})();
