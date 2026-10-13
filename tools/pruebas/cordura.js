/* =========================================================================
   cordura.js — Que ningún número imposible llegue a la pantalla

   Esta es la suite que más errores reales ha encontrado, y la razón es que
   comprueba algo que ninguna prueba de funcionamiento mira: no si la
   aplicación hace lo que se le pide, sino si lo que enseña puede ser verdad.

   Encontró tres sitios donde se dividían minutos-persona entre minutos de
   reloj —eficiencias del 997%— y uno donde se dividían cajas entre gavetas.
   Ninguno rompía nada: la pantalla seguía funcionando, solo mentía.

   Un número imposible es lo menos intuitivo que hay. Quien lo ve deja de
   confiar en todo lo demás, y con razón.

   Detalle de método que costó aprender: hay que mirar los elementos HOJA,
   no el texto de un contenedor. Concatenar las celdas de una fila fabrica
   números que nadie escribió —«5.470» seguido de «94,1%» se lee como
   «394,1%»— y la prueba empieza a dar falsos positivos.
   ========================================================================= */
const E = require("./entorno.js");
const falsoDB = require("./falsodb.js");

/* Los porcentajes que la aplicación puede enseñar legítimamente fuera de
   0–100: las variaciones contra lo anunciado, que son firmadas y pueden
   pasarse de largo si un proveedor declara mal. */
const RECOGER_PORCENTAJES = () => {
  const malos = [];
  const hojas = [...document.querySelectorAll("body *")].filter((e) => !e.children.length);
  hojas.forEach((e) => {
    const t = (e.textContent || "").trim();
    /* Un porcentaje y nada más: así no se mezclan dos celdas vecinas. */
    const m = /^([+-]?[\d.]+,?\d*)\s*%$/.exec(t);
    if (!m) return;
    const v = Math.abs(parseFloat(m[1].replace(/\./g, "").replace(",", ".")));
    /* Lo firmado (+/-) es una variación: puede superar el 100 de verdad. */
    if (/^[+-]/.test(m[1])) return;
    /* El techo no es 100. La eficiencia contra el estándar PUEDE pasarse
       —significa que se trabajó más rápido de lo previsto, y es un dato
       útil— y lo mismo el cumplimiento de una meta. Lo que no puede pasar
       es un 391% ni un 997%, que es lo que de verdad apareció cuando se
       dividían minutos-persona entre minutos de reloj. 200 deja pasar lo
       posible y sigue atrapando lo imposible. */
    if (v > 200) malos.push({ texto: t, donde: e.className || e.tagName });
  });
  return malos;
};

(async () => {
  const s = E.suite("cordura");
  const b = await E.navegador();
  const ctx = await b.newContext(E.ESCRITORIO);
  await ctx.addInitScript(falsoDB);

  const planta = s.vigilar(await ctx.newPage(), "planta");
  await planta.goto(E.BASE + "/interno/", { waitUntil: "networkidle" });
  await E.entrar(planta, "aquiroz", "supervision2026", ".lateral");

  const ir = async (v) => {
    await planta.click('.nav-item[data-ir="' + v + '"]');
    await planta.waitForTimeout(700);
  };

  s.bloque("[1] Ningún porcentaje imposible en pantalla");

  for (const vista of ["panel", "produccion", "lotes", "costeo", "reportes", "tiempos", "liquidacion"]) {
    await s.paso("en " + vista, async () => {
      await ir(vista);
      /* Un rango amplio: con 30 días puede no haber ejemplo de todo. */
      const rango = planta.locator("[data-rango='365']");
      if (await rango.count()) { await rango.click(); await planta.waitForTimeout(800); }
      const malos = await planta.evaluate(RECOGER_PORCENTAJES);
      if (malos.length) {
        throw new Error(malos.slice(0, 3).map((m) => m.texto + " (" + m.donde + ")").join(" · "));
      }
    });
  }

  await s.paso("todos los porcentajes usan la coma decimal de es-EC", async () => {
    /* Mezclar formatos en la misma pantalla no rompe nada y se lee fatal:
       en es-EC «58.7%» son quinientos ochenta y siete. Los gráficos lo
       hacían porque formateaban con toFixed en vez de con el formato
       local. Los porcentajes dentro de un `style` no cuentan: CSS quiere
       punto y no los ve nadie. */
    const conPunto = await planta.evaluate(() => {
      return [...document.querySelectorAll("body *")]
        .filter((e) => !e.children.length)
        .map((e) => (e.textContent || "").trim())
        .filter((t) => /^[+-]?\d+\.\d+\s*%$/.test(t))
        .slice(0, 5);
    });
    if (conPunto.length) throw new Error("con punto decimal: " + conPunto.join(", "));
  });

  s.bloque("[2] Las tasas y la eficiencia viven donde pueden vivir");

  await s.paso("ninguna tasa exportable se sale de 0–100%", async () => {
    const malas = await planta.evaluate(() => {
      const f = Indicadores.filtrar({ desde: "2000-01-01", hasta: "2100-01-01" });
      const k = Indicadores.calcular(f);
      const fuera = [];
      if (k.tasaExportable < 0 || k.tasaExportable > 1) fuera.push("global " + k.tasaExportable);
      Indicadores.porLinea({ desde: "2000-01-01", hasta: "2100-01-01" }).forEach((l) => {
        if (l.tasaExportable < 0 || l.tasaExportable > 1) fuera.push(l.nombre + " " + l.tasaExportable);
      });
      Indicadores.porProveedor({ desde: "2000-01-01", hasta: "2100-01-01" }).forEach((p) => {
        if (p.tasaExportable < 0 || p.tasaExportable > 1) fuera.push(p.nombre + " " + p.tasaExportable);
      });
      return fuera;
    });
    if (malas.length) throw new Error(malas.join(" · "));
  });

  await s.paso("la eficiencia vive en un rango creíble", async () => {
    /* Minutos-persona entre minutos-persona. Si alguien vuelve a dividir
       entre minutos de reloj, esto se dispara a varios cientos. */
    const e = await planta.evaluate(() => {
      const f = Indicadores.filtrar({ desde: "2000-01-01", hasta: "2100-01-01" });
      return Indicadores.calcular(f).eficienciaTiempo;
    });
    if (!(e >= 0.2 && e <= 2)) throw new Error("eficiencia de " + (e * 100).toFixed(0) + "%");
  });

  s.bloque("[3] La física no se negocia");

  await s.paso("la merma nunca supera lo que entró a proceso", async () => {
    const malos = await planta.evaluate(() => {
      return DB.all("producciones").filter((p) => {
        const merma = (p.mermas || []).reduce((a, m) => a + (Number(m.kg) || 0), 0);
        return merma > (Number(p.kgProcesados) || 0) + 0.01;
      }).map((p) => p.folio || p.id);
    });
    if (malos.length) throw new Error(malos.slice(0, 3).join(", "));
  });

  await s.paso("el balance de masa cierra en cada lote procesado", async () => {
    const malos = await planta.evaluate(() => {
      const fuera = [];
      DB.all("producciones").forEach((p) => {
        const linea = DB.linea(p.lineaId);
        if (!linea) return;
        const merma = (p.mermas || []).reduce((a, m) => a + (Number(m.kg) || 0), 0);
        const empacado = (Number(p.cajasExportables) || 0) * linea.pesoCajaKg;
        const entrada = Number(p.kgProcesados) || 0;
        if (!entrada) return;
        /* entrada = empacado + merma, con el margen de la deshidratación. */
        const dif = Math.abs(entrada - empacado - merma) / entrada;
        if (dif > 0.02) fuera.push((p.folio || p.id) + " descuadra " + (dif * 100).toFixed(1) + "%");
      });
      return fuera;
    });
    if (malos.length) throw new Error(malos.slice(0, 3).join(" · "));
  });

  await s.paso("el peso real por gaveta se parece al nominal", async () => {
    const malos = await planta.evaluate(() => {
      return DB.all("lotes")
        .filter((l) => l.gavetasRecibidas > 0 && l.kgRecibidos > 0)
        .map((l) => {
          const linea = DB.linea(l.lineaId);
          const real = l.kgRecibidos / l.gavetasRecibidas;
          return { cod: l.codigoLote, real, nominal: linea.pesoGavetaKg };
        })
        .filter((x) => x.real < x.nominal * 0.5 || x.real > x.nominal * 2)
        .map((x) => x.cod + ": " + x.real.toFixed(1) + " kg/gaveta contra " + x.nominal);
    });
    if (malos.length) throw new Error(malos.slice(0, 3).join(" · "));
  });

  await s.paso("las cajas salen de los kilos, no de las gavetas", async () => {
    /* El error de fondo de una versión anterior: dar por hecho que una caja
       pesa lo que una gaveta. Se comprueba que la conversión usa los dos
       pesos y el rendimiento. */
    const mal = await planta.evaluate(() => {
      return DB.all("lineas").filter((l) => {
        const esperado = (l.pesoGavetaKg * l.rendimientoExportable) / l.pesoCajaKg;
        return Math.abs(DB.cajasPorGaveta(l) - esperado) > 0.001;
      }).map((l) => l.nombre);
    });
    if (mal.length) throw new Error(mal.join(", "));
  });

  s.bloque("[4] El portal del proveedor tampoco miente");

  const portal = s.vigilar(await ctx.newPage(), "portal");
  await portal.goto(E.BASE + "/proveedor/", { waitUntil: "networkidle" });
  await E.entrar(portal, "PRV-001", "pitahaya2026", ".portal-marca");

  for (const sec of ["inicio", "lotes", "desempeno", "pagos"]) {
    await s.paso("en " + sec, async () => {
      await portal.click('.portal-nav-item[data-ir="' + sec + '"]');
      await portal.waitForTimeout(700);
      const malos = await portal.evaluate(RECOGER_PORCENTAJES);
      if (malos.length) {
        throw new Error(malos.slice(0, 3).map((m) => m.texto + " (" + m.donde + ")").join(" · "));
      }
    });
  }

  await b.close();
  s.fin();
})();
