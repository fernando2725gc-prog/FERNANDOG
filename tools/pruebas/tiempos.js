/* =========================================================================
   tiempos.js — El estudio de tiempos, por sus invariantes

   Nota sobre qué comprueba y qué no. El contraste de cada cifra contra el
   Excel maestro del TIC se hizo una vez, a mano, con el archivo delante, y
   queda recogido en el documento. Eso no se puede repetir aquí: el archivo
   no vive en el repositorio y copiar sus números a una prueba solo
   comprobaría que se copiaron bien.

   Lo que sí se puede comprobar en cada cambio son las RELACIONES, que es
   donde se cuelan los errores: que TE salga de TO × V × (1 + suplemento),
   que el contenido de trabajo y el tiempo de ciclo no se confundan —son
   dos relojes distintos y confundirlos fue un error real—, que el takt
   salga del tiempo disponible y el ingreso, y que el planificador use el
   contenido y no el ciclo.
   ========================================================================= */
const E = require("./entorno.js");
const falsoDB = require("./falsodb.js");

(async () => {
  const s = E.suite("tiempos");
  const b = await E.navegador();
  const ctx = await b.newContext(E.ESCRITORIO);
  await ctx.addInitScript(falsoDB);
  const p = s.vigilar(await ctx.newPage(), "planta");
  await p.goto(E.BASE + "/interno/", { waitUntil: "networkidle" });
  await E.entrar(p, "aquiroz", "supervision2026", ".lateral");

  s.bloque("[1] El tiempo estándar sale de la norma, no de un número suelto");

  await s.paso("TE = TO × V × (1 + suplemento) en cada actividad", async () => {
    const malas = await p.evaluate(() => {
      return DB.all("actividades").filter((a) => {
        const esperado = a.to * a.v * (1 + a.suplemento);
        return Math.abs(DB.tiempoEstandarAct(a) - esperado) > 1e-9;
      }).map((a) => a.codigo);
    });
    if (malas.length) throw new Error(malas.join(", "));
  });

  await s.paso("cada actividad declara de dónde sale su dato", async () => {
    const sinOrigen = await p.evaluate(() =>
      DB.all("actividades").filter((a) => !["M", "E", "S"].includes(a.origen)).map((a) => a.codigo));
    if (sinOrigen.length) throw new Error("sin origen M/E/S: " + sinOrigen.join(", "));
  });

  s.bloque("[2] Los dos relojes no se confunden");

  await s.paso("el contenido de trabajo suma minutos-persona", async () => {
    const malas = await p.evaluate(() => {
      return DB.all("lineas").filter((l) => {
        const porGaveta = DB.cajasPorGaveta(l);
        /* Una actividad medida por CAJA se repite tantas veces como cajas
           salen de una gaveta. Contarla una sola vez fue el error de fondo
           de una versión anterior. */
        const esperado = DB.actividadesDe(l.id).reduce((a, x) =>
          a + DB.tiempoEstandarAct(x) * (x.unidad === "caja" ? porGaveta : 1) * (x.personas || 1), 0);
        return Math.abs(DB.contenidoGavetaMin(l) - esperado) > 1e-6;
      }).map((l) => l.nombre);
    });
    if (malas.length) throw new Error(malas.join(", "));
  });

  await s.paso("el tiempo de ciclo suma minutos de reloj", async () => {
    const malas = await p.evaluate(() => {
      return DB.all("lineas").filter((l) => {
        const porGaveta = DB.cajasPorGaveta(l);
        const esperado = DB.actividadesDe(l.id).reduce((a, x) =>
          a + DB.tiempoEstandarAct(x) * (x.unidad === "caja" ? porGaveta : 1), 0);
        return Math.abs(DB.cicloGavetaMin(l) - esperado) > 1e-6;
      }).map((l) => l.nombre);
    });
    if (malas.length) throw new Error(malas.join(", "));
  });

  await s.paso("donde hay dos personas, el contenido supera al ciclo", async () => {
    const mal = await p.evaluate(() => {
      return DB.all("lineas").filter((l) => {
        const hayDuplas = DB.actividadesDe(l.id).some((a) => (a.personas || 1) > 1);
        if (!hayDuplas) return false;
        return DB.contenidoGavetaMin(l) <= DB.cicloGavetaMin(l);
      }).map((l) => l.nombre);
    });
    if (mal.length) throw new Error(mal.join(", "));
  });

  s.bloque("[3] Takt, operarios y costo");

  await s.paso("el takt sale del tiempo disponible y el ingreso del día", async () => {
    const malas = await p.evaluate(() => {
      const par = DB.parametros();
      const disponible = par.jornadaMin - par.pausasMin;
      return DB.all("lineas").filter((l) => l.activa).filter((l) => {
        const e = Indicadores.estudioTiempos(l.id);
        const gavetas = l.ingresoDiarioKg / l.pesoGavetaKg;
        return Math.abs(e.taktMin - disponible / gavetas) > 1e-6;
      }).map((l) => l.nombre);
    });
    if (malas.length) throw new Error(malas.join(", "));
  });

  await s.paso("los operarios mínimos salen del contenido entre el takt", async () => {
    const malas = await p.evaluate(() => {
      return DB.all("lineas").filter((l) => l.activa).filter((l) => {
        const e = Indicadores.estudioTiempos(l.id);
        return Math.abs(e.operariosExactos - e.contenidoGavetaMin / e.taktMin) > 1e-6;
      }).map((l) => l.nombre);
    });
    if (malas.length) throw new Error(malas.join(", "));
  });

  await s.paso("las estaciones suman los operarios del total", async () => {
    const malas = await p.evaluate(() => {
      return DB.all("lineas").filter((l) => l.activa).filter((l) => {
        const e = Indicadores.estudioTiempos(l.id);
        if (!e.estaciones || !e.estaciones.length) return false;
        const suma = e.estaciones.reduce((a, x) => a + x.contenido, 0);
        return Math.abs(suma - e.contenidoGavetaMin) > 1e-6;
      }).map((l) => l.nombre);
    });
    if (malas.length) throw new Error(malas.join(", "));
  });

  await s.paso("hay una estación que manda, y es la de más contenido", async () => {
    const malas = await p.evaluate(() => {
      return DB.all("lineas").filter((l) => l.activa).filter((l) => {
        const e = Indicadores.estudioTiempos(l.id);
        if (!e.estaciones || !e.estaciones.length) return true;
        const max = Math.max(...e.estaciones.map((x) => x.contenido));
        return !e.cuello || Math.abs(e.cuello.contenido - max) > 1e-6;
      }).map((l) => l.nombre);
    });
    if (malas.length) throw new Error(malas.join(", "));
  });

  s.bloque("[4] Cambiar una lectura mueve el estándar");

  await s.paso("subir el TO de una actividad sube el contenido y el costo", async () => {
    const r = await p.evaluate(() => {
      const l = DB.all("lineas").find((x) => x.activa);
      const a = DB.actividadesDe(l.id)[0];
      const antes = Indicadores.estudioTiempos(l.id);
      DB.update("actividades", a.id, { to: a.to * 2 });
      const despues = Indicadores.estudioTiempos(l.id);
      DB.update("actividades", a.id, { to: a.to });
      return {
        contenidoAntes: antes.contenidoGavetaMin, contenidoDespues: despues.contenidoGavetaMin,
        costoAntes: antes.costoManoObraGaveta, costoDespues: despues.costoManoObraGaveta
      };
    });
    if (!(r.contenidoDespues > r.contenidoAntes)) throw new Error("el contenido no se movió");
    if (!(r.costoDespues > r.costoAntes)) throw new Error("el costo no se movió");
  });

  s.bloque("[5] El planificador usa el contenido, no el ciclo");

  await s.paso("planificar con duplas pide más horas que el tiempo de reloj", async () => {
    const r = await p.evaluate(() => {
      const l = DB.all("lineas").find((x) => x.activa &&
        DB.actividadesDe(x.id).some((a) => (a.personas || 1) > 1));
      if (!l) return null;
      const plan = Indicadores.planificar({ lineas: [{ lineaId: l.id, gavetas: 100 }] });
      const porLinea = plan.detalle.find((x) => x.lineaId === l.id);
      return {
        minutos: porLinea.minutosRequeridos,
        contenido: DB.contenidoGavetaMin(l) * 100,
        ciclo: DB.cicloGavetaMin(l) * 100
      };
    });
    if (!r) throw new Error("ninguna línea tiene actividades de dos personas");
    if (Math.abs(r.minutos - r.contenido) > 0.01) {
      throw new Error("planificó " + r.minutos.toFixed(1) + " min; el contenido es " +
        r.contenido.toFixed(1) + " y el ciclo " + r.ciclo.toFixed(1));
    }
  });

  await b.close();
  s.fin();
})();
