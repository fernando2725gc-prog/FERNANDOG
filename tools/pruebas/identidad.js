/* =========================================================================
   identidad.js — El guardián del acuerdo de confidencialidad

   La empresa del caso de estudio está bajo acuerdo de confidencialidad.
   Eso no se resuelve recordando no mencionarla: se resuelve con una prueba
   que falle si alguien la vuelve a escribir, antes de que se publique.

   Recorre el código, el paquete publicado y las pantallas de las dos
   aplicaciones ya pintadas. Si el nombre, la razón social o las iniciales
   aparecen en cualquiera de los tres, esto se pone rojo.
   ========================================================================= */
const E = require("./entorno.js");
const falsoDB = require("./falsodb.js");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..", "..");

const VETADOS = [
  { nombre: "las iniciales de la empresa", re: /\bF\.?\s?L\.?\s?P\.?\b/i },
  { nombre: "«Latinoamerican»", re: /latinoamerican/i },
  { nombre: "«Perishables»", re: /perishables/i }
];

function revisar(etiqueta, texto) {
  const malas = [];
  texto.split("\n").forEach(function (linea, i) {
    VETADOS.forEach(function (v) {
      const m = linea.match(v.re);
      if (m) malas.push(etiqueta + ":" + (i + 1) + " " + v.nombre + " («" + m[0] + "»)");
    });
  });
  if (malas.length) throw new Error(malas.slice(0, 4).join(" | "));
}

(async () => {
  const s = E.suite("identidad");

  s.bloque("[1] No está en ningún archivo del proyecto");

  await s.paso("ni en el código, ni en el README, ni en el paquete publicado", async () => {
    const malos = [];
    const saltar = new Set([".git", "node_modules", "pwa", "pgdata"]);
    const andar = (dir) => {
      fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
        /* Este archivo lleva lo vetado dentro de sus propias expresiones:
           es el guardián, no una filtración. Sin esta línea se delata solo
           y la prueba nunca puede pasar. */
        if (saltar.has(e.name) || e.name === "_bt.html") return;
        if (e.name === path.basename(__filename)) return;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return andar(p);
        if (!/\.(js|html|css|json|md|sql|sh)$/.test(e.name)) return;
        const t = fs.readFileSync(p, "utf8");
        VETADOS.forEach((v) => { if (v.re.test(t)) malos.push(path.relative(RAIZ, p)); });
      });
    };
    andar(RAIZ);
    if (malos.length) throw new Error([...new Set(malos)].join(", "));
  });

  await s.paso("el sitio publicado existe y tampoco lo lleva", async () => {
    const sitio = path.join(RAIZ, "docs", "index.html");
    if (!fs.existsSync(sitio)) throw new Error("falta docs/index.html (¿sin empaquetar?)");
    revisar("docs/index.html", fs.readFileSync(sitio, "utf8"));
  });

  s.bloque("[2] No se ve en pantalla en ninguna de las dos aplicaciones");

  const b = await E.navegador();
  const ctx = await b.newContext(E.ESCRITORIO);
  await ctx.addInitScript(falsoDB);

  const planta = s.vigilar(await ctx.newPage(), "planta");
  await planta.goto(E.BASE + "/interno/", { waitUntil: "networkidle" });
  await E.entrar(planta, "aquiroz", "supervision2026", ".lateral");

  const vistas = await planta.locator(".nav-item").evaluateAll(
    (bs) => bs.map((x) => x.dataset.ir).filter(Boolean));
  if (!vistas.length) s.errores.push("no se leyó el menú de planta");

  for (const v of vistas) {
    await s.paso("planta → " + v, async () => {
      await planta.click('.nav-item[data-ir="' + v + '"]');
      await planta.waitForTimeout(350);
      revisar("planta/" + v, await planta.locator("body").innerText());
    });
  }

  const portal = s.vigilar(await ctx.newPage(), "portal");
  await portal.goto(E.BASE + "/proveedor/", { waitUntil: "networkidle" });
  await E.entrar(portal, "PRV-001", "pitahaya2026", ".portal-marca");
  const secs = await portal.locator(".portal-nav-item").evaluateAll(
    (bs) => bs.map((x) => x.dataset.ir).filter(Boolean));
  for (const sec of [...new Set(secs)]) {
    await s.paso("portal → " + sec, async () => {
      await portal.click('.portal-nav-item[data-ir="' + sec + '"]');
      await portal.waitForTimeout(350);
      revisar("portal/" + sec, await portal.locator("body").innerText());
    });
  }

  s.bloque("[3] El modo confidencial hace lo que dice");

  await s.paso("el sistema nace confidencial y sin razón social", async () => {
    const i = await planta.evaluate(() => DB.identidad());
    if (i.confidencial !== true) throw new Error("no nace confidencial");
    if (i.razonSocial) throw new Error("nace con una razón social escrita: " + i.razonSocial);
  });

  await s.paso("una razón social escrita no se filtra a ningún documento", async () => {
    const r = await planta.evaluate(() => {
      DB.guardarIdentidad({ razonSocial: "Secretísima S.A.", nombreCorto: "Secretísima" });
      return { largo: DB.nombreEmpresa(true), corto: DB.nombreEmpresa(), sub: DB.subtitulo() };
    });
    if (/secret/i.test(r.largo + r.corto + r.sub)) throw new Error("se filtró: " + JSON.stringify(r));
    if (r.largo !== "la Empresa") throw new Error("alias inesperado: " + r.largo);
  });

  await s.paso("el reporte impreso cita «la Empresa»", async () => {
    await planta.click('.nav-item[data-ir="reportes"]');
    await planta.waitForTimeout(500);
    const t = await planta.locator("body").innerText();
    if (/secret/i.test(t)) throw new Error("el reporte imprimió el nombre real");
    /* La cabecera va en versalitas por CSS, así que innerText la devuelve
       en mayúsculas: comparar sin distinguir. */
    if (!/la empresa/i.test(t)) throw new Error("el reporte no cita a «la Empresa»");
  });

  await s.paso("al desactivar el modo, y solo entonces, sale el nombre real", async () => {
    const r = await planta.evaluate(() => {
      DB.guardarIdentidad({ confidencial: false });
      return { largo: DB.nombreEmpresa(true), corto: DB.nombreEmpresa(), sub: DB.subtitulo() };
    });
    if (r.largo !== "Secretísima S.A.") throw new Error("razón social: " + r.largo);
    if (r.corto !== "Secretísima") throw new Error("nombre corto: " + r.corto);
  });

  await s.paso("se vuelve a ocultar sin perder lo configurado", async () => {
    const r = await planta.evaluate(() => {
      DB.guardarIdentidad({ confidencial: true });
      return { vis: DB.nombreEmpresa(true), guardada: DB.identidad().razonSocial };
    });
    if (r.vis !== "la Empresa") throw new Error("sigue visible: " + r.vis);
    if (r.guardada !== "Secretísima S.A.") throw new Error("se perdió el dato");
  });

  s.bloque("[4] La interfaz no usa emoji");

  await s.paso("los iconos son SVG del juego compartido", async () => {
    const n = await planta.locator("svg.ico").count();
    if (n < 10) throw new Error("solo " + n + " iconos SVG");
  });

  await s.paso("no queda ningún emoji suelto en pantalla", async () => {
    /* Los símbolos ASME del diagrama de proceso (○ ⇨ □ ▽) son notación
       normalizada de ingeniería de métodos: esos sí deben verse. */
    const sueltos = await planta.evaluate(() => {
      const permitidos = "○⇨□▽▸▾·—±";
      const malos = [];
      document.querySelectorAll("body *").forEach((el) => {
        if (el.children.length) return;
        for (const ch of (el.textContent || "")) {
          if (permitidos.includes(ch)) continue;
          if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(ch)) malos.push(ch + " en " + el.className);
        }
      });
      return [...new Set(malos)];
    });
    if (sueltos.length) throw new Error(sueltos.slice(0, 5).join(", "));
  });

  await b.close();
  s.fin();
})();
