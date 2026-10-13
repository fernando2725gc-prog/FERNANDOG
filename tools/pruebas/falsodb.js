/* =========================================================================
   falsodb.js — El almacén del artefacto, simulado

   Dentro de un artefacto de Claude, `window.claude.use("db")` entrega un
   almacén compartido en vivo. Fuera no existe, así que para probar las dos
   aplicaciones consolidándose hay que ponerlo.

   Se inyecta ANTES de que cargue la página (`addInitScript`), porque db.js
   lo busca al arrancar.

   Dos detalles que importan y que son fáciles de pasar por alto:

   · **Los documentos van congelados.** El almacén de verdad los entrega así,
     y db.js hace una copia de todo lo que lee precisamente por eso. Si aquí
     se entregaran mutables, una prueba daría por buena una mutación que en
     producción lanza una excepción.

   · **Se comparte entre pestañas.** Vive en `localStorage`, que es lo que
     comparten dos páginas del mismo contexto del navegador. Ahí está la
     gracia: el portal y la planta se ven el trabajo el uno al otro sin que
     nadie recargue, que es justo lo que hay que comprobar.
   ========================================================================= */

function falsoDB() {
  "use strict";

  const PREFIJO = "falsodb:";
  const CANAL = "falsodb:cambio";

  function clave(coleccion, id) { return PREFIJO + coleccion + "/" + id; }

  function congelar(o) {
    if (o && typeof o === "object") {
      Object.keys(o).forEach(function (k) { congelar(o[k]); });
      Object.freeze(o);
    }
    return o;
  }

  function leer(coleccion, id) {
    try {
      const crudo = localStorage.getItem(clave(coleccion, id));
      return crudo ? congelar(JSON.parse(crudo)) : null;
    } catch (e) { return null; }
  }

  function escribir(coleccion, id, datos) {
    localStorage.setItem(clave(coleccion, id), JSON.stringify(datos));
    avisar(coleccion);
  }

  function borrar(coleccion, id) {
    localStorage.removeItem(clave(coleccion, id));
    avisar(coleccion);
  }

  function listar(coleccion) {
    const fuera = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf(PREFIJO + coleccion + "/") === 0) {
        const id = k.slice((PREFIJO + coleccion + "/").length);
        const d = leer(coleccion, id);
        if (d) fuera.push({ id: id, datos: d });
      }
    }
    return fuera;
  }

  /* --------------------------------------------------------- avisos */

  const oyentes = {};   // coleccion -> [fn]

  function avisar(coleccion) {
    /* En la misma pestaña, `storage` no se dispara: hay que llamar a mano. */
    (oyentes[coleccion] || []).slice().forEach(function (fn) { fn(); });
    try { localStorage.setItem(CANAL, coleccion + "|" + Date.now()); } catch (e) { /* lleno */ }
  }

  window.addEventListener("storage", function (e) {
    if (!e.key) return;
    if (e.key === CANAL) {
      const col = String(e.newValue || "").split("|")[0];
      (oyentes[col] || []).slice().forEach(function (fn) { fn(); });
      return;
    }
    if (e.key.indexOf(PREFIJO) !== 0) return;
    const resto = e.key.slice(PREFIJO.length);
    const col = resto.split("/")[0];
    (oyentes[col] || []).slice().forEach(function (fn) { fn(); });
  });

  function suscribir(coleccion, fn) {
    if (!oyentes[coleccion]) oyentes[coleccion] = [];
    oyentes[coleccion].push(fn);
    /* El almacén de verdad entrega una primera instantánea en cuanto se
       suscribe uno; sin ella, una pantalla recién abierta se queda vacía
       hasta que alguien toque algo. */
    setTimeout(fn, 0);
    return function () {
      const i = oyentes[coleccion].indexOf(fn);
      if (i !== -1) oyentes[coleccion].splice(i, 1);
    };
  }

  /* ------------------------------------------------------- instantáneas */

  function instDoc(datos) {
    return { exists: !!datos, data: function () { return datos || {}; } };
  }

  function instCol(filas) {
    return {
      docs: filas.map(function (f) {
        return { id: f.id, data: function () { return f.datos; } };
      })
    };
  }

  /* ---------------------------------------------------------- interfaz */

  const almacen = {
    doc: function (ruta) {
      const partes = String(ruta).split("/");
      const coleccion = partes[0];
      const id = partes.slice(1).join("/");
      return {
        get: function () { return Promise.resolve(instDoc(leer(coleccion, id))); },
        set: function (d) { escribir(coleccion, id, d); return Promise.resolve(); },
        delete: function () { borrar(coleccion, id); return Promise.resolve(); },
        onSnapshot: function (fn) {
          return suscribir(coleccion, function () { fn(instDoc(leer(coleccion, id))); });
        }
      };
    },

    collection: function (coleccion) {
      return {
        get: function () { return Promise.resolve(instCol(listar(coleccion))); },
        doc: function (id) {
          return {
            get: function () { return Promise.resolve(instDoc(leer(coleccion, id))); },
            set: function (d) { escribir(coleccion, id, d); return Promise.resolve(); },
            delete: function () { borrar(coleccion, id); return Promise.resolve(); }
          };
        },
        onSnapshot: function (fn) {
          return suscribir(coleccion, function () { fn(instCol(listar(coleccion))); });
        }
      };
    }
  };

  window.claude = {
    use: function (que) {
      return que === "db" ? Promise.resolve(almacen) : Promise.resolve(null);
    }
  };
}

module.exports = falsoDB;
