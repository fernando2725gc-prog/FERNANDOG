/* El caso que importa antes de publicar: la app configurada contra un
   Supabase que NO responde. Es lo que pasa dentro del artefacto de Claude,
   donde la red de salida está restringida, y lo que pasaría si la base se
   cayera. Tiene que poder entrarse igual, con el acceso local. */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const ctx = await b.newContext();
  await ctx.addInitScript(() => {
    window.ACOPIA_NUBE = { url: "https://no-responde-nunca.invalid", clave: "sb_publishable_x" };
    delete window.claude;
  });
  const p = await ctx.newPage();
  await p.goto("http://localhost:8199/app/interno/", { waitUntil: "networkidle" });
  await p.waitForSelector(".acceso-caja", { timeout: 25000 });
  await p.waitForTimeout(5000);
  console.log(JSON.stringify(await p.evaluate(() => ({
    configurada: Nube.configurada(),
    sesionDisponible: Sesion.disponible(),
    origen: DB.origen(),
    fallo: Nube.diagnostico().fallo && Nube.diagnostico().fallo.codigo,
    botonActivarServidor: !!document.querySelector("#btnActivarInterno"),
    cuentasDemo: document.querySelectorAll(".demo").length
  })), null, 1));
  await p.fill("#acceso", "aquiroz"); await p.fill("#clave", "supervision2026");
  await p.click("#btnEntrar");
  await p.waitForTimeout(4000);
  console.log("entró:", !!(await p.locator(".lateral").count()),
    "| error:", (await p.locator("#accesoError").textContent().catch(()=>"")).slice(0,110));
  await b.close();
})();
