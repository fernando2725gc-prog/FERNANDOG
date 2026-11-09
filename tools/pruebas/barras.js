/* =========================================================================
   barras.js — Que el código de barras se pueda leer de verdad

   Mirar que el dibujo «parece un código de barras» no comprueba nada: una
   comprobación así da por bueno cualquier conjunto de rayas. Lo que hay que
   saber es si un lector lo descifra, y eso se averigua descifrándolo.

   Esta suite mide el ancho de cada barra y de cada hueco en el SVG, los
   traduce a ancho/estrecho y reconstruye el texto con la tabla de Code 39
   al revés. Si no vuelve el código de lote exacto —con sus asteriscos
   delimitadores— es que el símbolo está mal y ningún lector lo leería.

   El segundo bloque comprueba lo otro que hace falta para que esto sirva:
   un lector se comporta como un teclado, así que el flujo entero es
   escanear y que se abra la ficha. Ahí vivía un fallo real: el filtro de
   fechas seguía puesto y escanear un lote de hace seis semanas devolvía
   cero resultados sin decir por qué.
   ========================================================================= */
const E = require("./entorno.js");
const falsoDB = require("./falsodb.js");

const C39 = {"0":"NNNWWNWNN","1":"WNNWNNNNW","2":"NNWWNNNNW","3":"WNWWNNNNN","4":"NNNWWNNNW",
"5":"WNNWWNNNN","6":"NNWWWNNNN","7":"NNNWNNWNW","8":"WNNWNNWNN","9":"NNWWNNWNN",
"A":"WNNNNWNNW","B":"NNWNNWNNW","C":"WNWNNWNNN","D":"NNNNWWNNW","E":"WNNNWWNNN",
"F":"NNWNWWNNN","G":"NNNNNWWNW","H":"WNNNNWWNN","I":"NNWNNWWNN","J":"NNNNWWWNN",
"K":"WNNNNNNWW","L":"NNWNNNNWW","M":"WNWNNNNWN","N":"NNNNWNNWW","O":"WNNNWNNWN",
"P":"NNWNWNNWN","Q":"NNNNNNWWW","R":"WNNNNNWWN","S":"NNWNNNWWN","T":"NNNNWNWWN",
"U":"WWNNNNNNW","V":"NWWNNNNNW","W":"WWWNNNNNN","X":"NWNNWNNNW","Y":"WWNNWNNNN",
"Z":"NWWNWNNNN","-":"NWNNNNWNW",".":"WWNNNNWNN"," ":"NWWNNNWNN","*":"NWNNWNWNN"};
const INV = Object.fromEntries(Object.entries(C39).map(([k, v]) => [v, k]));

function decodificar(rects, finoEsperado) {
  /* rects = [{x,w}] solo de las barras. Se reconstruye la secuencia
     barra/espacio midiendo el hueco entre una barra y la siguiente. */
  const elems = [];
  for (let i = 0; i < rects.length; i++) {
    elems.push(rects[i].w);
    if (i < rects.length - 1) elems.push(rects[i + 1].x - (rects[i].x + rects[i].w));
  }
  const letra = (w) => (w >= finoEsperado * 2 ? "W" : "N");
  let salida = "", buf = "";
  for (let i = 0; i < elems.length; i++) {
    buf += letra(elems[i]);
    if (buf.length === 9) {
      salida += INV[buf] === undefined ? "?" : INV[buf];
      buf = "";
      i++;              /* el espacio de separación entre caracteres */
    }
  }
  return salida;
}

(async () => {
  const s = E.suite("barras");
  const b = await E.navegador();
  const ctx = await b.newContext(E.ESCRITORIO);
  await ctx.addInitScript(falsoDB);
  const p = s.vigilar(await ctx.newPage(), "planta");
  await p.goto(E.BASE + "/interno/", { waitUntil: "networkidle" });
  await E.entrar(p, "aquiroz", "supervision2026", ".lateral");

  s.bloque("[1] El símbolo se puede volver a leer");

  const casos = await p.evaluate(() => {
    const codigos = DB.all("lotes").slice(0, 5).map((l) => l.codigoLote);
    const caja = document.createElement("div");
    document.body.appendChild(caja);
    return codigos.map((c) => {
      caja.innerHTML = UI.codigoBarras(c, { fino: 2 });
      const rects = [...caja.querySelectorAll("svg rect")].slice(1)  /* el 1.º es el fondo */
        .map((r) => ({ x: +r.getAttribute("x"), w: +r.getAttribute("width") }));
      return { codigo: c, rects: rects, texto: caja.querySelector(".barras-texto").textContent };
    });
  });

  for (const c of casos) {
    await s.paso("«" + c.codigo + "» vuelve del dibujo", async () => {
      const leido = decodificar(c.rects, 2);
      if (leido !== "*" + c.codigo + "*") {
        throw new Error("se leyó «" + leido + "» en vez de «*" + c.codigo + "*»");
      }
    });
  }

  await s.paso("el código también va en texto, por si el lector falla", async () => {
    if (casos[0].texto !== casos[0].codigo) {
      throw new Error("el texto dice «" + casos[0].texto + "»");
    }
  });

  await s.paso("todo código de lote cabe en el alfabeto de Code 39", async () => {
    const fuera = await p.evaluate(() =>
      DB.all("lotes").map((l) => l.codigoLote)
        .filter((c) => !/^[0-9A-Z\-. ]+$/.test(c)));
    if (fuera.length) throw new Error("no representables: " + fuera.slice(0, 3).join(", "));
  });

  s.bloque("[2] Un lector es un teclado: la búsqueda ya lo aprovecha");

  await s.paso("escanear un código abre la ficha de ESE lote", async () => {
    await p.click('.nav-item[data-ir="lotes"]');
    await p.waitForTimeout(700);
    const codigo = casos[0].codigo;
    /* Un lector teclea el código de golpe y termina con Intro. */
    await p.fill("#buscarLote", codigo);
    await p.press("#buscarLote", "Enter");
    await p.waitForTimeout(700);
    const titulo = (await p.textContent("#panelTitulo").catch(() => "")) || "";
    if (!titulo.includes(codigo)) {
      throw new Error("se abrió «" + titulo.trim() + "» en vez de la ficha de " + codigo);
    }
  });

  await s.paso("un lote fuera del período se abre igual", async () => {
    /* El fallo original: el filtro de fechas de la pantalla escondía el
       lote y el escaneo no devolvía nada. Se busca a propósito el lote más
       antiguo que haya, que es el que cae fuera del filtro por defecto. */
    await p.keyboard.press("Escape");
    await p.waitForTimeout(400);
    const viejo = await p.evaluate(() => {
      const ls = DB.all("lotes").slice().sort((a, b) =>
        String(a.fechaEnvio).localeCompare(String(b.fechaEnvio)));
      return ls.length ? ls[0].codigoLote : null;
    });
    if (!viejo) return;
    await p.fill("#buscarLote", viejo);
    await p.press("#buscarLote", "Enter");
    await p.waitForTimeout(700);
    const titulo = (await p.textContent("#panelTitulo").catch(() => "")) || "";
    if (!titulo.includes(viejo)) {
      throw new Error("el lote más antiguo (" + viejo + ") no se abrió: «" + titulo.trim() + "»");
    }
  });

  await s.paso("un código que no existe lo dice, no se queda callado", async () => {
    await p.keyboard.press("Escape");
    await p.waitForTimeout(400);
    await p.fill("#buscarLote", "PIT999999-999");
    await p.press("#buscarLote", "Enter");
    await p.waitForTimeout(500);
    const avisos = await p.locator(".aviso").count();
    if (!avisos) throw new Error("no apareció ningún aviso");
  });

  await b.close();
  s.fin();
})();
