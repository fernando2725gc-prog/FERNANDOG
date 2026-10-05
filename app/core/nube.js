/* =========================================================================
   nube.js — Almacén compartido propio, sobre Supabase

   Por qué existe:

   El almacén del artefacto de Claude sincroniza de maravilla, pero vive
   dentro del visor de Claude: no se puede instalar en la pantalla de inicio
   del celular, no abre sin señal y solo entra quien tenga cuenta. En una
   planta eso descarta justo a las dos personas que más lo necesitan —el
   proveedor en la finca y quien pesa en el patio—.

   Este módulo es el mismo almacén, pero en una dirección propia. Expone
   EXACTAMENTE la misma interfaz que `window.claude.use("db")`:

       almacen.doc("sistema/config").get() / .set(o) / .onSnapshot(fn, err)
       almacen.collection("lotes").get()
       almacen.collection("lotes").doc(id).set(o) / .delete()
       almacen.collection("lotes").onSnapshot(fn, err)

   De ese modo db.js no sabe —ni tiene por qué saber— con cuál de los dos
   está hablando. Un solo seam, dos implementaciones.

   Todo es `fetch` contra la API REST de Supabase (PostgREST). Ni una
   librería: el proyecto no tiene dependencias y conectarlo a una base de
   datos no es motivo para empezar a tenerlas.

   Sobre los avisos de cambio: Supabase tiene WebSockets, pero en una planta
   la señal se cae y vuelve cada rato, y un socket roto deja de avisar sin
   decirlo. Aquí se pregunta cada pocos segundos por un RESUMEN —cuántos
   documentos hay en cada colección y cuál es el más reciente—, que son siete
   filas. Si el resumen no cambió, no se descarga nada. Es más tosco que un
   socket y mucho más difícil de romper, que es lo que hace falta aquí.
   ========================================================================= */

const Nube = (function () {
  "use strict";

  /* Cada cuánto se pregunta por novedades. Cuatro segundos es el punto
     donde el pesaje «aparece solo» en el celular del proveedor sin que
     parezca magia, y son 15 consultas por minuto de siete filas. */
  const INTERVALO_MS = 4000;

  /* Si la pestaña está oculta no se consulta: el celular está en el
     bolsillo y cada consulta es batería. Al volver se consulta de una. */
  let temporizador = null;
  let consultando = false;

  function config() {
    const c = (typeof window !== "undefined" && window.ACOPIA_NUBE) || {};
    return {
      url: String(c.url || "").trim().replace(/\/+$/, ""),
      clave: String(c.clave || "").trim()
    };
  }

  function configurada() {
    const c = config();
    return !!(c.url && c.clave);
  }

  /* ------------------------------------------------------------ errores */

  /* db.js lee `e.code` para decidir si reencola y qué avisar. Se le da uno
     con significado en vez del mensaje suelto de fetch. */
  function fallo(codigo, detalle) {
    const e = new Error(detalle || codigo);
    e.code = codigo;
    return e;
  }

  /* ------------------------------------------------------------ llamadas */

  function cabeceras(extra) {
    const c = config();
    const h = {
      apikey: c.clave,
      Authorization: "Bearer " + c.clave,
      "Content-Type": "application/json",
      Accept: "application/json"
    };
    if (extra) Object.keys(extra).forEach(function (k) { h[k] = extra[k]; });
    return h;
  }

  async function pedir(ruta, opciones) {
    const c = config();
    if (!c.url) throw fallo("sin-configurar");

    let res;
    try {
      res = await fetch(c.url + "/rest/v1/" + ruta, opciones);
    } catch (e) {
      /* Sin red. Es el caso normal en el patio, no una excepción. */
      throw fallo("sin-red", e && e.message);
    }

    if (!res.ok) {
      let cuerpo = "";
      try { cuerpo = await res.text(); } catch (e) { cuerpo = ""; }
      if (res.status === 401 || res.status === 403) {
        throw fallo("permiso-denegado", cuerpo);
      }
      if (res.status === 404) throw fallo("tabla-no-encontrada", cuerpo);
      throw fallo("http-" + res.status, cuerpo);
    }

    if (res.status === 204) return null;
    const texto = await res.text();
    return texto ? JSON.parse(texto) : null;
  }

  /* PostgREST escapa con comillas dobles; los identificadores del sistema
     son códigos sin espacios, pero no se da por supuesto. */
  function val(v) { return encodeURIComponent(String(v)); }

  /* -------------------------------------------------------- lectura */

  async function leerDoc(coleccion, id) {
    const filas = await pedir(
      "documentos?coleccion=eq." + val(coleccion) + "&id=eq." + val(id) + "&select=datos",
      { headers: cabeceras() }
    );
    const fila = filas && filas[0];
    return instantaneaDoc(fila ? fila.datos : null);
  }

  async function leerColeccion(coleccion) {
    const filas = await pedir(
      "documentos?coleccion=eq." + val(coleccion) + "&select=id,datos",
      { headers: cabeceras() }
    );
    return instantaneaColeccion(filas || []);
  }

  /* Las instantáneas imitan a las del almacén de Claude: `data()` es una
     función, no una propiedad, y los documentos van congelados para que
     nadie los mute por accidente creyendo que edita una copia. */
  function instantaneaDoc(datos) {
    const congelado = datos ? Object.freeze(datos) : null;
    return { exists: !!congelado, data: function () { return congelado || {}; } };
  }

  function instantaneaColeccion(filas) {
    return {
      docs: filas.map(function (f) {
        const congelado = Object.freeze(f.datos || {});
        return { id: f.id, data: function () { return congelado; } };
      })
    };
  }

  /* -------------------------------------------------------- escritura */

  async function guardar(coleccion, id, datos) {
    await pedir("documentos?on_conflict=coleccion,id", {
      method: "POST",
      headers: cabeceras({
        Prefer: "resolution=merge-duplicates,return=minimal"
      }),
      body: JSON.stringify({ coleccion: coleccion, id: id, datos: datos })
    });
    /* Lo que acaba de escribirse es nuestro: no hace falta esperar al
       siguiente sondeo para enterarnos, pero sí avisar a los demás. */
    pedirResumenPronto();
  }

  async function borrar(coleccion, id) {
    await pedir("documentos?coleccion=eq." + val(coleccion) + "&id=eq." + val(id), {
      method: "DELETE",
      headers: cabeceras({ Prefer: "return=minimal" })
    });
    pedirResumenPronto();
  }

  /* ------------------------------------------------- aviso de cambios */

  /* Quién quiere enterarse de qué. Las colecciones y los documentos de
     `sistema` se vigilan por separado porque cambian a ritmos distintos. */
  const oyentesColeccion = {};      // { lotes: [fn, fn] }
  const oyentesDoc = {};            // { "sistema/config": [fn] }
  let resumenPrevio = null;         // { lotes: "3|2026-10-05T...", ... }

  /* `oyente` es {fn, err}: la pareja que onSnapshot recibe. Se guardan
     juntas para poder avisar del fallo a quien corresponda. */
  function sumar(mapa, llave, oyente) {
    if (!mapa[llave]) mapa[llave] = [];
    mapa[llave].push(oyente);
    arrancarSondeo();
    return function () {
      if (!mapa[llave]) return;
      const i = mapa[llave].indexOf(oyente);
      if (i !== -1) mapa[llave].splice(i, 1);
      if (!mapa[llave].length) delete mapa[llave];
      if (!Object.keys(oyentesColeccion).length && !Object.keys(oyentesDoc).length) {
        pararSondeo();
      }
    };
  }

  /* La huella de una colección: cuántos documentos tiene y cuál se tocó al
     final. Un alta o una baja mueven la cuenta; una edición mueve la fecha.
     Con las dos cosas no se escapa ningún cambio. */
  async function leerResumen() {
    const filas = await pedir("resumen_documentos?select=coleccion,n,ultimo", {
      headers: cabeceras()
    });
    const r = {};
    (filas || []).forEach(function (f) {
      r[f.coleccion] = String(f.n) + "|" + String(f.ultimo || "");
    });
    return r;
  }

  async function sondear() {
    if (consultando) return;
    consultando = true;
    try {
      const ahora = await leerResumen();
      const previo = resumenPrevio || {};
      resumenPrevio = ahora;

      /* Una colección que se vació desaparece del resumen: hay que mirar
         las llaves de los dos lados o no se detecta el último borrado. */
      const llaves = {};
      Object.keys(previo).forEach(function (k) { llaves[k] = true; });
      Object.keys(ahora).forEach(function (k) { llaves[k] = true; });

      const cambiadas = Object.keys(llaves).filter(function (k) {
        return previo[k] !== ahora[k];
      });

      for (const col of cambiadas) {
        if (col === "sistema") { await avisarSistema(); continue; }
        if (!oyentesColeccion[col]) continue;
        try {
          const snap = await leerColeccion(col);
          oyentesColeccion[col].slice().forEach(function (o) { o.fn(snap); });
        } catch (e) {
          oyentesColeccion[col].slice().forEach(function (o) { if (o.err) o.err(e); });
        }
      }
    } catch (e) {
      /* Sin red o permiso revocado: no se avisa a cada oyente en cada
         sondeo —serían quince avisos por minuto—. La cola de db.js y el
         indicador de la barra ya le dicen a la persona lo que pasa. */
      if (e.code !== "sin-red") {
        console.warn("No se pudo consultar el almacén compartido:", e.code);
      }
    } finally {
      consultando = false;
    }
  }

  /* Los tres documentos de sistema viven en la misma colección, así que un
     solo viaje sirve para los tres. */
  async function avisarSistema() {
    const vigilados = Object.keys(oyentesDoc);
    if (!vigilados.length) return;
    try {
      const snap = await leerColeccion("sistema");
      const porId = {};
      snap.docs.forEach(function (d) { porId[d.id] = d; });
      vigilados.forEach(function (ruta) {
        const id = ruta.split("/")[1];
        const d = porId[id];
        const instantanea = instantaneaDoc(d ? d.data() : null);
        (oyentesDoc[ruta] || []).slice().forEach(function (o) { o.fn(instantanea); });
      });
    } catch (e) {
      vigilados.forEach(function (ruta) {
        (oyentesDoc[ruta] || []).slice().forEach(function (o) { if (o.err) o.err(e); });
      });
    }
  }

  function arrancarSondeo() {
    if (temporizador) return;
    temporizador = setInterval(function () {
      if (typeof document !== "undefined" && document.hidden) return;
      sondear();
    }, INTERVALO_MS);
  }

  function pararSondeo() {
    if (!temporizador) return;
    clearInterval(temporizador);
    temporizador = null;
  }

  /* Tras escribir, y al volver la pantalla o la red, se adelanta un sondeo
     en vez de esperar el turno: en un celular los cuatro segundos de espera
     se notan justo cuando la persona está mirando. */
  let adelanto = null;
  function pedirResumenPronto() {
    if (adelanto) return;
    adelanto = setTimeout(function () { adelanto = null; sondear(); }, 400);
  }

  function vigilarDespertar() {
    if (typeof window === "undefined") return;
    window.addEventListener("online", pedirResumenPronto);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) pedirResumenPronto();
      });
    }
  }

  /* ------------------------------------------------------------ interfaz */

  function almacen() {
    return {
      doc: function (ruta) {
        const partes = String(ruta).split("/");
        const coleccion = partes[0];
        const id = partes.slice(1).join("/");
        return {
          get: function () { return leerDoc(coleccion, id); },
          set: function (datos) { return guardar(coleccion, id, datos); },
          delete: function () { return borrar(coleccion, id); },
          onSnapshot: function (fn, err) {
            return sumar(oyentesDoc, coleccion + "/" + id, { fn: fn, err: err });
          }
        };
      },

      collection: function (coleccion) {
        return {
          get: function () { return leerColeccion(coleccion); },
          doc: function (id) {
            return {
              get: function () { return leerDoc(coleccion, id); },
              set: function (datos) { return guardar(coleccion, id, datos); },
              delete: function () { return borrar(coleccion, id); }
            };
          },
          onSnapshot: function (fn, err) {
            return sumar(oyentesColeccion, coleccion, { fn: fn, err: err });
          }
        };
      }
    };
  }

  /* Abre la conexión: comprueba que la tabla existe y que la clave sirve,
     y deja tomada la huella inicial para que el primer sondeo compare
     contra algo real en vez de avisar de todo como si fuera nuevo. */
  async function abrir() {
    if (!configurada()) return null;
    try {
      resumenPrevio = await leerResumen();
    } catch (e) {
      console.warn("El almacén en la nube no respondió:", e.code, e.message);
      return null;
    }
    vigilarDespertar();
    return almacen();
  }

  return {
    configurada: configurada,
    abrir: abrir,
    /* Para las pruebas y para el panel de datos del sistema. */
    INTERVALO_MS: INTERVALO_MS,
    sondearAhora: sondear
  };
})();

if (typeof module !== "undefined" && module.exports) { module.exports = Nube; }
