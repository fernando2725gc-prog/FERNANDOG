/* =========================================================================
   novedades.js — "¿Qué pasó desde la última vez que entré?"

   Sin esto, saber si algo cambió obliga a entrar a mirar: el proveedor
   revisa si ya pesaron su fruta, Recepción revisa si llegó un anuncio,
   Supervisión revisa si quedó algo sin cerrar. Esta campana lo dice sola.

   No se guarda una lista de avisos en ningún lado: se DEDUCEN del estado
   actual de los lotes cada vez que hace falta. Lo único que se guarda, y
   solo en el propio equipo, es qué avisos ya vio esta persona. Así no hay
   nada que sincronizar, nada que se desfase y nada que limpiar.
   ========================================================================= */

const Novedades = (function () {
  "use strict";

  const TOPE = 40;          // lo que se muestra; más abajo está el historial
  const TOPE_VISTOS = 400;  // claves recordadas antes de empezar a podar

  function clave(usuarioId) { return "flp.visto." + usuarioId; }

  function leerVistos(usuarioId) {
    try {
      const raw = localStorage.getItem(clave(usuarioId));
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function guardarVistos(usuarioId, lista) {
    try {
      localStorage.setItem(clave(usuarioId), JSON.stringify(lista.slice(-TOPE_VISTOS)));
    } catch (e) { /* sin espacio: se vuelve a avisar, que es el lado seguro */ }
  }

  function fechaDe(l) {
    return l.fechaCierre || l.fechaRecepcion || l.fecha;
  }

  /* ---------------------------------------------------- qué le importa */

  /* El proveedor se entera de lo que le pasó a SU fruta. Nada del interior
     de la planta: ni causas, ni mermas, ni lo de otros proveedores. */
  function paraProveedor(proveedorId) {
    const out = [];
    DB.all("lotes").forEach(function (l) {
      if (l.proveedorId !== proveedorId) return;

      if (l.estado === "Rechazado") {
        out.push({
          id: "rech:" + l.id, tipo: "alerta", icono: "⛔",
          titulo: "Rechazaron el lote " + l.codigoLote,
          detalle: l.observacionesRecepcion || "Sin motivo anotado.",
          fecha: fechaDe(l), ir: "lotes", lote: l.id
        });
        return;
      }
      if (l.cajasRecibidas !== null) {
        const dif = l.cajasRecibidas - l.cajasAnunciadas;
        out.push({
          id: "pesado:" + l.id, tipo: dif < 0 ? "alerta" : "info", icono: "⚖️",
          titulo: "Pesaron tu lote " + l.codigoLote,
          detalle: "Anunciaste " + l.cajasAnunciadas + " cajas y se recibieron " +
            l.cajasRecibidas + (dif === 0 ? "." : dif > 0 ? ", " + dif + " más." : ", " + Math.abs(dif) + " menos."),
          fecha: l.fechaRecepcion || fechaDe(l), ir: "lotes", lote: l.id
        });
      }
      if (l.estado === "Cerrado" && l.reporteEnviado) {
        out.push({
          id: "reporte:" + l.id, tipo: "bueno", icono: "📄",
          titulo: "Ya tienes el reporte del lote " + l.codigoLote,
          detalle: "La planta cerró el lote. Puedes ver el resultado completo.",
          fecha: l.fechaReporte || l.fechaCierre, ir: "lotes", lote: l.id
        });
      }
    });
    return out;
  }

  /* Cada rol de planta ve el trabajo que le está esperando a ÉL. */
  function paraPlanta(rol) {
    const out = [];
    const lotes = DB.all("lotes");

    if (rol === "recepcion" || rol === "supervisor") {
      lotes.filter(function (l) { return l.estado === "Anunciado"; }).forEach(function (l) {
        out.push({
          id: "anuncio:" + l.id, tipo: "info", icono: "🚚",
          titulo: "Envío anunciado: " + l.codigoLote,
          detalle: Indicadores.nombreProveedor(l.proveedorId) + " · " +
            l.cajasAnunciadas + " cajas de " + Indicadores.nombreLinea(l.lineaId) +
            ". Esperando pesaje.",
          fecha: l.fecha, ir: "recepcion", lote: l.id
        });
      });
    }

    if (rol === "produccion" || rol === "supervisor") {
      lotes.filter(function (l) { return l.estado === "Recibido"; }).forEach(function (l) {
        out.push({
          id: "porprocesar:" + l.id, tipo: "info", icono: "🏭",
          titulo: "Listo para procesar: " + l.codigoLote,
          detalle: l.cajasRecibidas + " cajas en cámara · " +
            Indicadores.nombreLinea(l.lineaId) + ".",
          fecha: l.fechaRecepcion || l.fecha, ir: "produccion", lote: l.id
        });
      });
    }

    if (rol === "supervisor") {
      lotes.filter(function (l) { return l.estado === "Procesado"; }).forEach(function (l) {
        const dias = Math.round((new Date(DB.hoy()) - new Date(l.fecha)) / 86400000);
        out.push({
          id: "porcerrar:" + l.id, tipo: dias > 7 ? "alerta" : "info", icono: "✅",
          titulo: "Esperando tu cierre: " + l.codigoLote,
          detalle: Indicadores.nombreProveedor(l.proveedorId) +
            (dias > 7 ? " · lleva " + dias + " días abierto." : " · terminado en planta."),
          fecha: l.fecha, ir: "lotes", lote: l.id
        });
      });

      /* Una cuenta entregada y nunca usada suele ser un acceso que se
         perdió por el camino: conviene saberlo, no descubrirlo tarde. */
      DB.all("usuarios").filter(function (u) {
        return u.activo && u.debeCambiar && !u.ultimoAcceso;
      }).forEach(function (u) {
        out.push({
          id: "sinusar:" + u.id, tipo: "alerta", icono: "🔑",
          titulo: "Acceso sin estrenar: " + u.nombre,
          detalle: "Se le entregó una clave temporal y todavía no ha entrado.",
          fecha: DB.hoy(), ir: "usuarios"
        });
      });
    }

    return out;
  }

  /* ------------------------------------------------------------ lista */

  function listar(usuario) {
    if (!usuario) return [];
    const lista = usuario.rol === "proveedor"
      ? paraProveedor(usuario.proveedorId)
      : paraPlanta(usuario.rol);

    const vistos = leerVistos(usuario.id);
    lista.forEach(function (n) { n.nuevo = vistos.indexOf(n.id) === -1; });

    /* Lo nuevo primero y, dentro de cada grupo, lo más reciente arriba:
       quien abre la campana quiere ver antes lo que no sabía. */
    lista.sort(function (a, b) {
      if (a.nuevo !== b.nuevo) return a.nuevo ? -1 : 1;
      return a.fecha < b.fecha ? 1 : -1;
    });
    return lista.slice(0, TOPE);
  }

  function sinVer(usuario) {
    return listar(usuario).filter(function (n) { return n.nuevo; }).length;
  }

  /* Se marcan como vistos los que de verdad se le mostraron. */
  function marcarVistos(usuario, lista) {
    if (!usuario) return;
    const vistos = leerVistos(usuario.id);
    lista.forEach(function (n) {
      if (vistos.indexOf(n.id) === -1) vistos.push(n.id);
    });
    guardarVistos(usuario.id, vistos);
  }

  function olvidar(usuario) {
    if (!usuario) return;
    try { localStorage.removeItem(clave(usuario.id)); } catch (e) { /* noop */ }
  }

  return {
    listar: listar, sinVer: sinVer, marcarVistos: marcarVistos, olvidar: olvidar
  };
})();
