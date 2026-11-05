/* =========================================================================
   coherencia.js — Que la aplicación cuente una sola historia

   `cordura` comprueba que ningún número sea imposible. Esta comprueba algo
   distinto y más silencioso: que dos pantallas que hablan del mismo dato
   digan lo mismo, que el menú prometa lo que la pantalla entrega, y que
   ninguna frase se quede a medias.

   Nace de un error de verdad. En el costeo había dos literales pegados sin
   el `+` que los une:

       "Recupera " + nf(kg) + " kg y"
       " cajas exportables en el período..."

   JavaScript inserta el punto y coma, se queda con el primero y descarta el
   segundo sin avisar. Nada se rompe: la pantalla se abre, el número está
   bien, y la frase dice «Recupera 1.414 kg y» y ahí se acaba. Ninguna
   comprobación de funcionamiento lo ve, y quien lo lee piensa que la
   aplicación está a medio hacer —y tiene razón, aunque no donde cree.
   ========================================================================= */
const E = require("./entorno.js");
const falsoDB = require("./falsodb.js");

/* Palabras con las que el castellano no termina una frase: si el texto
   visible acaba en una de ellas, falta lo que venía después. Se piden al
   menos dos palabras para no marcar una etiqueta de una sola («Total»,
   «Por»), que es un rótulo, no una frase. */
const FRASES_A_MEDIAS = () => {
  /* La expresión va DENTRO de la función: Playwright la serializa y la
     evalúa en la página, donde nada de este archivo existe. Fuera, daba
     «COLGANDO is not defined» en las veinte comprobaciones. */
  /* Sin la bandera `i`: «73,1% de tu fruta entra como calidad A» acaba en
     una A mayúscula, que es un grado de calidad, no la preposición «a». */
  const COLGANDO = /\s(y|o|u|e|de|del|con|sin|por|para|que|en|al|a|el|la|los|las|un|una|como|entre|sobre|desde|hasta|más|menos)$/;
  const malas = [];
  [...document.querySelectorAll("body *")].forEach((el) => {
    if (el.children.length) return;
    if (el.closest("script, style, select, option")) return;
    const t = (el.textContent || "").replace(/\s+/g, " ").trim();
    /* Una frase es algo con verbo y varias palabras; un rótulo de dos
       palabras no se juzga. */
    if (t.split(" ").length < 4) return;
    if (!COLGANDO.test(t)) return;
    malas.push(t.slice(-60));
  });
  return malas;
};

/* Lo que una pantalla afirma, por etiqueta: «Cajas exportables» → «5.470». */
const AFIRMACIONES = () => {
  const m = {};
  document.querySelectorAll(".kpi").forEach((k) => {
    const et = (k.querySelector(".kpi-etiqueta") || {}).textContent;
    const va = (k.querySelector(".kpi-valor") || {}).textContent;
    if (et && va) m[et.trim()] = va.trim();
  });
  return m;
};

(async () => {
  const s = E.suite("coherencia");
  const b = await E.navegador();
  const ctx = await b.newContext(E.ESCRITORIO);
  await ctx.addInitScript(falsoDB);

  const p = s.vigilar(await ctx.newPage(), "planta");
  await p.goto(E.BASE + "/interno/", { waitUntil: "networkidle" });
  await E.entrar(p, "aquiroz", "supervision2026", ".lateral");

  /* Supervisión ve todo el menú: lo que no recorra esta suite no lo
     recorre nadie. Se lee de la pantalla en vez de escribirlo aquí, para
     que una entrada nueva entre sola en la prueba. */
  const vistas = await p.evaluate(() =>
    [...document.querySelectorAll(".nav-item")].map((n) => ({
      id: n.dataset.ir,
      texto: (n.querySelector("span") || {}).textContent.trim()
    })));

  const ir = async (id) => {
    await p.click('.nav-item[data-ir="' + id + '"]');
    await p.waitForTimeout(700);
  };

  s.bloque("[1] El menú promete lo que la pantalla entrega");

  /* Tres entradas llevan a pantallas cuyo título es, con razón, más
     explícito que el rótulo del menú: el menú tiene 18 caracteres de ancho
     y el título no. Lo que no se tolera es que hablen de cosas distintas. */
  const EQUIVALE = {
    panel: "Indicadores",
    guia: "Guía de uso",
    sistema: "Datos del sistema"
  };

  for (const v of vistas) {
    await s.paso("«" + v.texto + "» abre su pantalla", async () => {
      await ir(v.id);
      const h1 = (await p.textContent(".vista-cab h1") || "").trim();
      if (!h1) throw new Error("la pantalla no tiene título");
      const esperado = EQUIVALE[v.id] || v.texto;
      if (h1.toLowerCase() !== esperado.toLowerCase()) {
        throw new Error("el menú dice «" + v.texto + "» y la pantalla «" + h1 + "»");
      }
    });
  }

  await s.paso("el título no queda tapado por la barra superior", async () => {
    /* `focus()` sobre el contenido —que está ahí para que el teclado siga a
       la navegación— arrastraba la página 65 px, justo el alto de la barra
       fija, y al cambiar de pantalla lo primero que se veía era medio
       encabezado y medio botón. No rompía nada y se veía descuidado. */
    const malas = [];
    for (const v of vistas) {
      await ir(v.id);
      const r = await p.evaluate(() => {
        const h1 = document.querySelector(".vista-cab h1");
        const barra = document.querySelector(".barra-sup, .cabecera, header");
        if (!h1 || !barra) return null;
        return { titulo: h1.getBoundingClientRect().top, barra: barra.getBoundingClientRect().bottom };
      });
      if (r && r.titulo < r.barra) malas.push(v.id);
    }
    if (malas.length) throw new Error("tapado en: " + malas.join(", "));
  });

  s.bloque("[2] Ninguna frase se queda a medias");

  for (const v of vistas) {
    await s.paso("en " + v.id, async () => {
      await ir(v.id);
      /* Los plegables de método guardan la mitad del texto de la
         aplicación: cerrados, esta comprobación no ve nada. */
      await p.evaluate(() => {
        document.querySelectorAll("details.metodo").forEach((d) => { d.open = true; });
      });
      const malas = await p.evaluate(FRASES_A_MEDIAS);
      if (malas.length) throw new Error(malas.slice(0, 2).map((t) => "«…" + t + "»").join(" · "));
    });
  }

  s.bloque("[3] El mismo dato vale lo mismo en dos pantallas");

  await s.paso("los indicadores compartidos coinciden entre pantallas", async () => {
    /* Mismo período en las dos: si una pantalla trae su propio filtro, la
       comparación no significa nada. */
    const recoger = async (id) => {
      await ir(id);
      const r = p.locator("[data-rango='30']");
      if (await r.count()) { await r.click(); await p.waitForTimeout(800); }
      return p.evaluate(AFIRMACIONES);
    };
    const panel = await recoger("panel");
    const reportes = await recoger("reportes");
    const costeo = await recoger("costeo");

    const choques = [];
    [["reportes", reportes], ["costeo", costeo]].forEach(([donde, otra]) => {
      Object.keys(otra).forEach((et) => {
        if (panel[et] !== undefined && panel[et] !== otra[et]) {
          choques.push(et + ": panel «" + panel[et] + "» contra " + donde + " «" + otra[et] + "»");
        }
      });
    });
    if (choques.length) throw new Error(choques.slice(0, 3).join(" · "));
  });

  await s.paso("el contador del menú cuadra con lo que hay que hacer", async () => {
    /* El contador es una promesa: «hay 16 cosas que hacer aquí». Tiene que
       cuadrar con el panel de pendientes, no con la tabla entera: la tabla
       enseña todos los lotes del período, procesados incluidos, y
       compararla con el contador daba 16 contra 52 sin que nada estuviera
       mal. Lo que de verdad importa es que el título del panel, los botones
       que ofrece y el contador digan el mismo número. */
    const cuenta = await p.evaluate(() => {
      const n = document.querySelector('.nav-item[data-ir="produccion"] .nav-contador');
      return n ? Number(n.textContent.trim()) : null;
    });
    if (cuenta === null) return;   // nada pendiente: nada que cuadrar
    await ir("produccion");
    const panel = await p.evaluate(() => {
      const sec = document.querySelector(".panel-destacado");
      if (!sec) return null;
      const m = /\((\d[\d.]*)\)/.exec(sec.querySelector("h2").textContent || "");
      return {
        titulo: m ? Number(m[1].replace(/\./g, "")) : null,
        botones: sec.querySelectorAll("[data-procesar]").length
      };
    });
    if (!panel) throw new Error("no hay panel de pendientes");
    if (panel.titulo !== cuenta || panel.botones !== cuenta) {
      throw new Error("el menú anuncia " + cuenta + ", el título " + panel.titulo +
        " y hay " + panel.botones + " botones");
    }
  });

  s.bloque("[4] El portal del proveedor dice lo mismo que la planta");

  const portal = s.vigilar(await ctx.newPage(), "portal");
  await portal.goto(E.BASE + "/proveedor/", { waitUntil: "networkidle" });
  await E.entrar(portal, "PRV-001", "pitahaya2026", ".portal-marca");

  for (const sec of ["inicio", "lotes", "desempeno", "pagos"]) {
    await s.paso("ninguna frase a medias en " + sec, async () => {
      await portal.click('.portal-nav-item[data-ir="' + sec + '"]');
      await portal.waitForTimeout(700);
      await portal.evaluate(() => {
        document.querySelectorAll("details.metodo").forEach((d) => { d.open = true; });
      });
      const malas = await portal.evaluate(FRASES_A_MEDIAS);
      if (malas.length) throw new Error(malas.slice(0, 2).map((t) => "«…" + t + "»").join(" · "));
    });
  }

  await b.close();
  s.fin();
})();
