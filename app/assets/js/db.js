/* =========================================================================
   db.js — Capa de datos
   Repositorio único de información. Persiste en localStorage del navegador.
   Para migrar a un backend real, sustituir load()/save() por llamadas fetch
   a la API (ver app/README.md, sección "Migrar a backend").
   ========================================================================= */

const DB = (function () {
  "use strict";

  const KEY = "agroreg.db.v2";

  /* ---------------------------------------------------------------- utils */

  function uid(prefix) {
    return prefix + "_" + Math.random().toString(36).slice(2, 10);
  }

  function hoy() {
    return new Date().toISOString().slice(0, 10);
  }

  function diasAtras(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  function sumarDias(fecha, n) {
    const d = new Date(fecha + "T12:00:00");
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  /* Generador pseudoaleatorio con semilla: la demo siempre trae los mismos
     números, para que las capturas de pantalla de la tesis sean estables. */
  function rng(seed) {
    let s = seed;
    return function () {
      s = (s * 1103515245 + 12345) % 2147483648;
      return s / 2147483648;
    };
  }

  /* ------------------------------------------------------------- catálogos */

  /* Ciclo de vida del lote. Cada estado lo abre un rol distinto: así el
     sistema refleja el recorrido físico de la fruta por la planta. */
  const ESTADOS = [
    { id: "Anunciado", nombre: "Anunciado", rol: "proveedor", orden: 1,
      ayuda: "El proveedor avisó que envía la fruta. Falta que llegue a planta." },
    { id: "Recibido", nombre: "Recibido", rol: "recepcion", orden: 2,
      ayuda: "Recepción pesó y verificó la fruta. Listo para procesar." },
    { id: "Procesado", nombre: "Procesado", rol: "produccion", orden: 3,
      ayuda: "Producción registró lo exportable y las mermas." },
    { id: "Cerrado", nombre: "Cerrado", rol: "supervision", orden: 4,
      ayuda: "Supervisión cerró el lote. Ya no admite cambios." },
    { id: "Rechazado", nombre: "Rechazado", rol: "recepcion", orden: 0,
      ayuda: "La fruta no cumplió los mínimos y no ingresó a planta." }
  ];

  const CALIDADES = [
    { id: "A", nombre: "Primera (A)", factor: 1.0 },
    { id: "B", nombre: "Segunda (B)", factor: 0.88 },
    { id: "C", nombre: "Tercera (C)", factor: 0.74 }
  ];

  const ROLES = [
    { id: "proveedor", nombre: "Proveedor", icono: "🚜",
      lema: "Anuncias los envíos de fruta y recibes el reporte de cada lote." },
    { id: "recepcion", nombre: "Recepción", icono: "⚖️",
      lema: "Confirmas y pesas la fruta que llega a planta." },
    { id: "produccion", nombre: "Producción", icono: "🏭",
      lema: "Registras lo procesado, lo exportable y las mermas con su causa." },
    { id: "supervision", nombre: "Supervisión", icono: "📋",
      lema: "Cierras lotes, envías reportes y ves los indicadores." }
  ];

  /* Causas de merma. Agruparlas por tipo permite saber de quién es el
     problema: del campo, del transporte o de la propia planta. */
  const CAUSAS_MERMA = [
    { id: "cm_madurez", nombre: "Maduración excesiva", tipo: "Campo" },
    { id: "cm_plaga", nombre: "Plaga o enfermedad", tipo: "Campo" },
    { id: "cm_calibre", nombre: "Calibre fuera de norma", tipo: "Campo" },
    { id: "cm_golpe", nombre: "Daño mecánico / golpes", tipo: "Transporte" },
    { id: "cm_transporte", nombre: "Deterioro en transporte", tipo: "Transporte" },
    { id: "cm_pelado", nombre: "Pérdida de pelado y corte", tipo: "Proceso" },
    { id: "cm_deshidra", nombre: "Deshidratación en proceso", tipo: "Proceso" },
    { id: "cm_paro", nombre: "Producto perdido por paro de línea", tipo: "Proceso" },
    { id: "cm_otros", nombre: "Otras causas", tipo: "Proceso" }
  ];

  /* ---------------------------------------------------------------- semilla */

  /* `dias` acota el historial generado. El modo compartido usa una semilla
     corta: la idea es dejar sitio para los datos de prueba reales, no llenar
     la base con ruido. */
  function semilla(dias) {
    const r = rng(20260908);
    const historial = dias || 80;

    const frutas = [
      { id: "fr_mango", nombre: "Mango Tommy", unidad: "kg", metaExportable: 0.62, precioRef: 0.85 },
      { id: "fr_pina", nombre: "Piña MD2", unidad: "kg", metaExportable: 0.55, precioRef: 0.70 },
      { id: "fr_banano", nombre: "Banano", unidad: "kg", metaExportable: 0.68, precioRef: 0.55 },
      { id: "fr_maracuya", nombre: "Maracuyá", unidad: "kg", metaExportable: 0.45, precioRef: 1.20 },
      { id: "fr_papaya", nombre: "Papaya", unidad: "kg", metaExportable: 0.60, precioRef: 0.65 },
      { id: "fr_aguacate", nombre: "Aguacate Hass", unidad: "kg", metaExportable: 0.72, precioRef: 2.10 }
    ];

    const productos = [
      { id: "pd_fresco", nombre: "Empaque en fresco" },
      { id: "pd_pulpa", nombre: "Pulpa congelada" },
      { id: "pd_iqf", nombre: "Trozo IQF" },
      { id: "pd_deshid", nombre: "Fruta deshidratada" }
    ];

    const proveedores = [
      { id: "pv_01", codigo: "PRV-001", nombre: "Finca La Esperanza", documento: "0991234567001", contacto: "Marta Cedeño", telefono: "0985551201", email: "laesperanza@correo.com", zona: "Manabí", activo: true, fechaAlta: diasAtras(400) },
      { id: "pv_02", codigo: "PRV-002", nombre: "Agrícola El Progreso", documento: "0992345678001", contacto: "Luis Vera", telefono: "0985551202", email: "elprogreso@correo.com", zona: "Los Ríos", activo: true, fechaAlta: diasAtras(370) },
      { id: "pv_03", codigo: "PRV-003", nombre: "Hacienda San Miguel", documento: "0993456789001", contacto: "Ana Rueda", telefono: "0985551203", email: "sanmiguel@correo.com", zona: "Guayas", activo: true, fechaAlta: diasAtras(310) },
      { id: "pv_04", codigo: "PRV-004", nombre: "Cooperativa Frutos del Sur", documento: "0994567890001", contacto: "Jorge Loor", telefono: "0985551204", email: "frutosdelsur@correo.com", zona: "El Oro", activo: true, fechaAlta: diasAtras(240) },
      { id: "pv_05", codigo: "PRV-005", nombre: "Predio Santa Rosa", documento: "0995678901001", contacto: "Elena Bravo", telefono: "0985551205", email: "santarosa@correo.com", zona: "Santo Domingo", activo: true, fechaAlta: diasAtras(180) },
      { id: "pv_06", codigo: "PRV-006", nombre: "Agroexport Valle Verde", documento: "0996789012001", contacto: "Pedro Zambrano", telefono: "0985551206", email: "valleverde@correo.com", zona: "Manabí", activo: false, fechaAlta: diasAtras(520) }
    ];

    /* Cada proveedor tiene un sesgo propio al declarar el peso: unos son
       exactos, otros declaran de más. El indicador de diferencia de peso
       existe justamente para hacer visible eso. */
    const sesgoPeso = { pv_01: 0.995, pv_02: 0.972, pv_03: 0.999, pv_04: 0.962, pv_05: 0.988 };

    const usuarios = [
      { id: "us_01", nombre: "Marta Cedeño", rol: "proveedor", proveedorId: "pv_01", activo: true },
      { id: "us_02", nombre: "Luis Vera", rol: "proveedor", proveedorId: "pv_02", activo: true },
      { id: "us_03", nombre: "Diego Andrade", rol: "recepcion", proveedorId: null, activo: true },
      { id: "us_04", nombre: "Carlos Mendoza", rol: "produccion", proveedorId: null, activo: true },
      { id: "us_05", nombre: "Sofía Palma", rol: "produccion", proveedorId: null, activo: true },
      { id: "us_06", nombre: "Ing. Andrea Quiroz", rol: "supervision", proveedorId: null, activo: true }
    ];

    /* --------------------------- lotes --------------------------------- */

    const lotes = [];
    let folio = 0;

    for (let d = historial; d >= 0; d -= 1) {
      const fecha = diasAtras(d);
      if (new Date(fecha + "T12:00:00").getDay() === 0) continue;   // sin envíos el domingo

      const envios = 1 + Math.floor(r() * 3);
      for (let i = 0; i < envios; i += 1) {
        const pv = proveedores[Math.floor(r() * 5)];
        const fruta = frutas[Math.floor(r() * frutas.length)];
        const calidadDeclarada = r() < 0.66 ? "A" : r() < 0.87 ? "B" : "C";
        const anunciado = Math.round((400 + r() * 2600) / 5) * 5;
        folio += 1;

        const lote = {
          id: uid("lt"),
          folio: "LOT-" + String(folio).padStart(4, "0"),
          codigoLote: "L" + fecha.replace(/-/g, "").slice(2) + "-" + String(folio).padStart(3, "0"),
          /* --- anuncio (proveedor) --- */
          fecha: fecha,
          proveedorId: pv.id,
          frutaId: fruta.id,
          cantidadAnunciadaKg: anunciado,
          calidadDeclarada: calidadDeclarada,
          precioUnitario: Number((fruta.precioRef * (0.9 + r() * 0.25)).toFixed(2)),
          transporte: r() < 0.5 ? "Propio" : "Contratado",
          observacionesProveedor: "",
          anunciadoPor: "us_01",
          creadoEn: fecha + "T07:30:00",
          /* --- recepción --- */
          fechaRecepcion: null,
          cantidadRecibidaKg: null,
          calidadVerificada: null,
          observacionesRecepcion: "",
          recibidoPor: null,
          /* --- cierre (supervisión) --- */
          estado: "Anunciado",
          fechaCierre: null,
          cerradoPor: null,
          reporteEnviado: false,
          fechaReporte: null
        };

        /* Los lotes de los últimos dos días siguen en tránsito. */
        if (d > 1) {
          const rechazado = r() < 0.03;
          lote.fechaRecepcion = r() < 0.85 ? fecha : sumarDias(fecha, 1);
          lote.recibidoPor = "us_03";

          if (rechazado) {
            lote.estado = "Rechazado";
            lote.cantidadRecibidaKg = 0;
            lote.calidadVerificada = "C";
            lote.observacionesRecepcion = "Lote rechazado: fruta fuera de los mínimos de calidad.";
          } else {
            const sesgo = sesgoPeso[pv.id] || 0.99;
            lote.cantidadRecibidaKg = Math.round(anunciado * (sesgo + (r() - 0.5) * 0.03));
            /* La calidad verificada en planta a veces baja respecto a la declarada. */
            const baja = r() < 0.18;
            lote.calidadVerificada = baja
              ? (calidadDeclarada === "A" ? "B" : "C")
              : calidadDeclarada;
            lote.estado = "Recibido";
          }
        }

        lotes.push(lote);
      }
    }

    /* ------------------------ producción -------------------------------- */

    const producciones = [];
    let folioP = 0;

    lotes.forEach(function (lote) {
      if (lote.estado !== "Recibido") return;
      if (r() < 0.14) return;                    // aún en cámara, sin procesar

      const fruta = frutas.find(function (f) { return f.id === lote.frutaId; });
      const cal = CALIDADES.find(function (c) { return c.id === lote.calidadVerificada; });

      const kgProcesados = Math.round(lote.cantidadRecibidaKg * (0.93 + r() * 0.07));
      const tasa = fruta.metaExportable * cal.factor * (0.9 + r() * 0.19);
      const kgExportable = Math.round(kgProcesados * Math.min(tasa, 0.93));
      const totalMerma = kgProcesados - kgExportable;

      /* La merma se reparte entre causas: el peso de cada una depende de la
         calidad con que llegó la fruta y del tipo de transporte. */
      const pesos = {
        cm_madurez: cal.id === "A" ? 0.10 : 0.24,
        cm_plaga: cal.id === "C" ? 0.16 : 0.06,
        cm_calibre: 0.12,
        cm_golpe: lote.transporte === "Contratado" ? 0.16 : 0.08,
        cm_transporte: lote.transporte === "Contratado" ? 0.10 : 0.05,
        cm_pelado: 0.24,
        cm_deshidra: 0.08,
        cm_paro: r() < 0.15 ? 0.09 : 0.01,
        cm_otros: 0.04
      };

      const suma = Object.keys(pesos).reduce(function (a, k) { return a + pesos[k]; }, 0);
      const mermas = [];
      let repartido = 0;
      const claves = Object.keys(pesos);

      claves.forEach(function (k, idx) {
        let kg;
        if (idx === claves.length - 1) {
          kg = totalMerma - repartido;           // la última absorbe el redondeo
        } else {
          kg = Math.round((totalMerma * pesos[k]) / suma);
          repartido += kg;
        }
        if (kg > 0) mermas.push({ causaId: k, kg: kg });
      });

      folioP += 1;
      const fechaProc = r() < 0.72 ? lote.fechaRecepcion : sumarDias(lote.fechaRecepcion, 1);

      producciones.push({
        id: uid("pr"),
        folio: "PRD-" + String(folioP).padStart(4, "0"),
        fecha: fechaProc,
        loteId: lote.id,
        codigoLote: lote.codigoLote,
        frutaId: lote.frutaId,
        productoId: productos[Math.floor(r() * productos.length)].id,
        turno: r() < 0.55 ? "Matutino" : "Vespertino",
        kgProcesados: kgProcesados,
        kgExportable: kgExportable,
        mermas: mermas,
        horasHombre: Math.round((kgProcesados / 110) * 10) / 10,
        operador: r() < 0.5 ? "Carlos Mendoza" : "Sofía Palma",
        observaciones: "",
        registradoPor: "us_04",
        creadoEn: fechaProc + "T14:00:00"
      });

      lote.estado = "Procesado";

      /* Supervisión ya cerró los lotes con más de una semana. */
      const diasDesde = Math.round((new Date(hoy()) - new Date(fechaProc)) / 86400000);
      if (diasDesde > 7) {
        lote.estado = "Cerrado";
        lote.fechaCierre = sumarDias(fechaProc, 2);
        lote.cerradoPor = "us_06";
        lote.reporteEnviado = true;
        lote.fechaReporte = lote.fechaCierre;
      }
    });

    return {
      version: 3,
      creadoEn: new Date().toISOString(),
      frutas: frutas,
      productos: productos,
      proveedores: proveedores,
      usuarios: usuarios,
      lotes: lotes,
      producciones: producciones,
      bitacora: []
    };
  }

  /* ------------------------------------------------- almacen compartido */

  /* Colecciones que viajan como un documento por registro. La bitacora no:
     es un flujo que crece sin limite, asi que se guarda agregada en un solo
     documento y se poda, como recomienda el contrato del almacen. */
  const COLECCIONES = ["proveedores", "usuarios", "lotes", "producciones"];

  let remoto = null;                 // namespace del almacen, o null
  let modo = "local";                // "local" | "compartido"
  const suscripciones = [];

  function esCompartido() { return modo === "compartido"; }
  function modoActual() { return modo; }

  /* Conecta con el almacen del visor. Si no esta disponible, la app sigue
     funcionando contra localStorage sin que el resto del codigo se entere. */
  async function conectar(alCambiar) {
    if (typeof window === "undefined" || !window.claude ||
        typeof window.claude.use !== "function") return modo;

    let almacen;
    try {
      almacen = await window.claude.use("db");
    } catch (e) {
      return modo;
    }
    if (!almacen) return modo;

    remoto = almacen;

    try {
      const paginas = await Promise.all(
        COLECCIONES.map(function (c) { return remoto.collection(c).get(); })
      );
      const bitacoraDoc = await remoto.doc("sistema/bitacora").get();

      const vacio = paginas.every(function (p) { return p.empty; });
      if (vacio) {
        await sembrarRemoto();
      } else {
        const db = load();
        COLECCIONES.forEach(function (c, i) {
          db[c] = paginas[i].docs.map(function (d) { return d.data(); });
        });
        db.bitacora = bitacoraDoc.exists ? (bitacoraDoc.data().entradas || []) : [];
      }

      modo = "compartido";
      escuchar(alCambiar);
    } catch (e) {
      remoto = null;                 // se sigue trabajando en local
      console.warn("No se pudo conectar el almacen compartido:", e);
    }
    return modo;
  }

  /* Primera apertura: se carga una semilla corta para que la app no arranque
     vacia y se pueda ver como funciona antes de meter datos propios. */
  async function sembrarRemoto() {
    const datos = semilla(18);
    cache = datos;

    const escrituras = [];
    COLECCIONES.forEach(function (c) {
      datos[c].forEach(function (reg) {
        escrituras.push(remoto.collection(c).doc(reg.id).set(reg));
      });
    });
    escrituras.push(remoto.doc("sistema/bitacora").set({ entradas: [] }));
    await Promise.all(escrituras);
  }

  function escuchar(alCambiar) {
    COLECCIONES.forEach(function (c) {
      suscripciones.push(remoto.collection(c).onSnapshot(function (snap) {
        load()[c] = snap.docs.map(function (d) { return d.data(); });
        if (alCambiar) alCambiar(c);
      }, function (err) {
        console.warn("Suscripcion interrumpida en " + c + ":", err.code);
      }));
    });

    suscripciones.push(remoto.doc("sistema/bitacora").onSnapshot(function (snap) {
      load().bitacora = snap.exists ? (snap.data().entradas || []) : [];
      if (alCambiar) alCambiar("bitacora");
    }, function (err) {
      console.warn("Suscripcion interrumpida en bitacora:", err.code);
    }));
  }

  /* Las escrituras remotas no bloquean la interfaz: la vista ya se actualizo
     con el cache local y la suscripcion confirmara el resultado. */
  function empujar(coleccion, registro) {
    if (!remoto) return;
    remoto.collection(coleccion).doc(registro.id).set(registro)
      .catch(function (e) { avisarFallo(e); });
  }

  function empujarBorrado(coleccion, id) {
    if (!remoto) return;
    remoto.collection(coleccion).doc(id).delete()
      .catch(function (e) { avisarFallo(e); });
  }

  function empujarBitacora(entradas) {
    if (!remoto) return;
    remoto.doc("sistema/bitacora").set({ entradas: entradas })
      .catch(function (e) { avisarFallo(e); });
  }

  let alFallar = null;
  function alFallarEscritura(fn) { alFallar = fn; }
  function avisarFallo(e) {
    const codigo = e && e.code ? e.code : "desconocido";
    console.warn("Escritura rechazada por el almacen:", codigo, e);
    if (alFallar) alFallar(codigo);
  }

  /* ------------------------------------------------------- persistencia */

  let cache = null;

  function load() {
    if (cache) return cache;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        cache = JSON.parse(raw);
        return cache;
      }
    } catch (e) {
      console.warn("No se pudo leer el almacenamiento local:", e);
    }
    cache = semilla();
    save();
    return cache;
  }

  function save() {
    if (esCompartido()) return;      // la fuente de verdad es el almacen
    try {
      localStorage.setItem(KEY, JSON.stringify(cache));
    } catch (e) {
      console.warn("No se pudo guardar en el almacenamiento local:", e);
    }
  }

  function reset() {
    if (esCompartido()) return resetRemoto();
    cache = semilla();
    save();
    return Promise.resolve(cache);
  }

  /* Borra lo que haya en el almacen compartido y vuelve a sembrarlo. */
  async function resetRemoto() {
    const paginas = await Promise.all(
      COLECCIONES.map(function (c) { return remoto.collection(c).get(); })
    );
    await Promise.all(paginas.reduce(function (acc, pagina, i) {
      pagina.docs.forEach(function (d) {
        acc.push(remoto.collection(COLECCIONES[i]).doc(d.id).delete());
      });
      return acc;
    }, []));
    await sembrarRemoto();
    return cache;
  }

  function importar(json) {
    const datos = typeof json === "string" ? JSON.parse(json) : json;
    if (!datos || !Array.isArray(datos.lotes)) {
      throw new Error("El archivo no tiene la estructura esperada.");
    }
    cache = datos;
    save();
    return cache;
  }

  function exportar() {
    return JSON.stringify(load(), null, 2);
  }

  /* --------------------------------------------------------------- CRUD */

  function all(coleccion) {
    return load()[coleccion] || [];
  }

  function get(coleccion, id) {
    return all(coleccion).find(function (x) { return x.id === id; }) || null;
  }

  function insert(coleccion, registro) {
    const db = load();
    if (!registro.id) registro.id = uid(coleccion.slice(0, 2));
    db[coleccion].push(registro);
    save();
    empujar(coleccion, registro);
    return registro;
  }

  function update(coleccion, id, cambios) {
    const db = load();
    const i = db[coleccion].findIndex(function (x) { return x.id === id; });
    if (i === -1) return null;
    db[coleccion][i] = Object.assign({}, db[coleccion][i], cambios);
    save();
    empujar(coleccion, db[coleccion][i]);
    return db[coleccion][i];
  }

  function remove(coleccion, id) {
    const db = load();
    const i = db[coleccion].findIndex(function (x) { return x.id === id; });
    if (i === -1) return false;
    db[coleccion].splice(i, 1);
    save();
    empujarBorrado(coleccion, id);
    return true;
  }

  function siguienteFolio(coleccion, prefijo) {
    const nums = all(coleccion)
      .map(function (x) { return parseInt(String(x.folio || "").split("-")[1], 10); })
      .filter(function (n) { return !isNaN(n); });
    const max = nums.length ? Math.max.apply(null, nums) : 0;
    return prefijo + "-" + String(max + 1).padStart(4, "0");
  }

  function causaMerma(id) {
    return CAUSAS_MERMA.find(function (c) { return c.id === id; }) || null;
  }

  /* Deja constancia de quién hizo qué: trazabilidad para la auditoría. */
  function registrarBitacora(usuarioId, accion, detalle) {
    const db = load();
    db.bitacora.unshift({
      id: uid("bt"),
      fecha: new Date().toISOString(),
      usuarioId: usuarioId,
      accion: accion,
      detalle: detalle
    });
    db.bitacora = db.bitacora.slice(0, 200);
    save();
    empujarBitacora(db.bitacora);
  }

  return {
    ESTADOS: ESTADOS,
    CALIDADES: CALIDADES,
    ROLES: ROLES,
    CAUSAS_MERMA: CAUSAS_MERMA,
    hoy: hoy,
    diasAtras: diasAtras,
    sumarDias: sumarDias,
    uid: uid,
    load: load,
    save: save,
    reset: reset,
    conectar: conectar,
    esCompartido: esCompartido,
    modoActual: modoActual,
    alFallarEscritura: alFallarEscritura,
    importar: importar,
    exportar: exportar,
    all: all,
    get: get,
    insert: insert,
    update: update,
    remove: remove,
    siguienteFolio: siguienteFolio,
    causaMerma: causaMerma,
    registrarBitacora: registrarBitacora
  };
})();
