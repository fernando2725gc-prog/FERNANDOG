/* =========================================================================
   db.js — Capa de datos
   Repositorio único de información. Persiste en localStorage del navegador.
   Para migrar a un backend real, sustituir load()/save() por llamadas fetch
   a la API (ver app/README.md, sección "Migrar a backend").
   ========================================================================= */

const DB = (function () {
  "use strict";

  const KEY = "agroreg.db.v1";

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

  const CALIDADES = [
    { id: "A", nombre: "Primera (A)", factor: 1.0 },
    { id: "B", nombre: "Segunda (B)", factor: 0.85 },
    { id: "C", nombre: "Tercera (C)", factor: 0.7 }
  ];

  const ROLES = [
    { id: "admin", nombre: "Administrador" },
    { id: "proveedor", nombre: "Proveedor" },
    { id: "produccion", nombre: "Salón de producción" }
  ];

  /* ---------------------------------------------------------------- semilla */

  function semilla() {
    const r = rng(20260907);

    const frutas = [
      { id: "fr_mango", nombre: "Mango Tommy", unidad: "kg", rendimientoMeta: 0.62, precioRef: 0.85 },
      { id: "fr_pina", nombre: "Piña MD2", unidad: "kg", rendimientoMeta: 0.55, precioRef: 0.7 },
      { id: "fr_banano", nombre: "Banano", unidad: "kg", rendimientoMeta: 0.68, precioRef: 0.55 },
      { id: "fr_maracuya", nombre: "Maracuyá", unidad: "kg", rendimientoMeta: 0.45, precioRef: 1.2 },
      { id: "fr_papaya", nombre: "Papaya", unidad: "kg", rendimientoMeta: 0.6, precioRef: 0.65 },
      { id: "fr_aguacate", nombre: "Aguacate Hass", unidad: "kg", rendimientoMeta: 0.72, precioRef: 2.1 }
    ];

    const productos = [
      { id: "pd_pulpa", nombre: "Pulpa congelada" },
      { id: "pd_deshid", nombre: "Fruta deshidratada" },
      { id: "pd_iqf", nombre: "Trozo IQF" },
      { id: "pd_fresco", nombre: "Empaque en fresco" }
    ];

    const proveedores = [
      { id: "pv_01", codigo: "PRV-001", nombre: "Finca La Esperanza", documento: "0991234567001", contacto: "Marta Cedeño", telefono: "0985551201", email: "laesperanza@correo.com", zona: "Manabí", activo: true, fechaAlta: diasAtras(400) },
      { id: "pv_02", codigo: "PRV-002", nombre: "Agrícola El Progreso", documento: "0992345678001", contacto: "Luis Vera", telefono: "0985551202", email: "elprogreso@correo.com", zona: "Los Ríos", activo: true, fechaAlta: diasAtras(370) },
      { id: "pv_03", codigo: "PRV-003", nombre: "Hacienda San Miguel", documento: "0993456789001", contacto: "Ana Rueda", telefono: "0985551203", email: "sanmiguel@correo.com", zona: "Guayas", activo: true, fechaAlta: diasAtras(310) },
      { id: "pv_04", codigo: "PRV-004", nombre: "Cooperativa Frutos del Sur", documento: "0994567890001", contacto: "Jorge Loor", telefono: "0985551204", email: "frutosdelsur@correo.com", zona: "El Oro", activo: true, fechaAlta: diasAtras(240) },
      { id: "pv_05", codigo: "PRV-005", nombre: "Predio Santa Rosa", documento: "0995678901001", contacto: "Elena Bravo", telefono: "0985551205", email: "santarosa@correo.com", zona: "Santo Domingo", activo: true, fechaAlta: diasAtras(180) },
      { id: "pv_06", codigo: "PRV-006", nombre: "Agroexport Valle Verde", documento: "0996789012001", contacto: "Pedro Zambrano", telefono: "0985551206", email: "valleverde@correo.com", zona: "Manabí", activo: false, fechaAlta: diasAtras(520) }
    ];

    const usuarios = [
      { id: "us_01", nombre: "Administrador General", usuario: "admin", clave: "admin123", rol: "admin", proveedorId: null, activo: true },
      { id: "us_02", nombre: "Marta Cedeño", usuario: "proveedor", clave: "prov123", rol: "proveedor", proveedorId: "pv_01", activo: true },
      { id: "us_03", nombre: "Luis Vera", usuario: "lvera", clave: "prov123", rol: "proveedor", proveedorId: "pv_02", activo: true },
      { id: "us_04", nombre: "Carlos Mendoza", usuario: "produccion", clave: "prod123", rol: "produccion", proveedorId: null, activo: true },
      { id: "us_05", nombre: "Sofía Palma", usuario: "spalma", clave: "prod123", rol: "produccion", proveedorId: null, activo: true }
    ];

    /* --- Recepciones: lo que cada proveedor declara que envió --- */
    const recepciones = [];
    let folioR = 0;
    for (let d = 75; d >= 0; d -= 1) {
      const fecha = diasAtras(d);
      const dow = new Date(fecha + "T12:00:00").getDay();
      if (dow === 0) continue;                      // no se recibe domingo
      const envios = 1 + Math.floor(r() * 3);       // 1 a 3 envíos por día
      for (let i = 0; i < envios; i += 1) {
        const pv = proveedores[Math.floor(r() * 5)]; // pv_06 está inactivo
        const fruta = frutas[Math.floor(r() * frutas.length)];
        const calidad = r() < 0.62 ? "A" : r() < 0.85 ? "B" : "C";
        const cantidad = Math.round((400 + r() * 2600) / 5) * 5;
        folioR += 1;
        recepciones.push({
          id: uid("rc"),
          folio: "REC-" + String(folioR).padStart(4, "0"),
          fecha: fecha,
          proveedorId: pv.id,
          frutaId: fruta.id,
          lote: "L" + fecha.replace(/-/g, "").slice(2) + "-" + String(folioR).padStart(3, "0"),
          cantidadKg: cantidad,
          calidad: calidad,
          precioUnitario: Number((fruta.precioRef * (0.9 + r() * 0.25)).toFixed(2)),
          transporte: r() < 0.5 ? "Propio" : "Contratado",
          estado: d > 2 ? "Recibido" : r() < 0.5 ? "Pendiente" : "Recibido",
          observaciones: "",
          registradoPor: "us_02",
          creadoEn: fecha + "T08:00:00"
        });
      }
    }

    /* --- Producción: lo que el salón procesa a partir de esas recepciones --- */
    const producciones = [];
    let folioP = 0;
    recepciones.forEach(function (rc) {
      if (rc.estado !== "Recibido") return;
      if (r() < 0.16) return;                       // parte aún sin procesar
      const fruta = frutas.find(function (f) { return f.id === rc.frutaId; });
      const cal = CALIDADES.find(function (c) { return c.id === rc.calidad; });
      const kgProcesados = Math.round(rc.cantidadKg * (0.9 + r() * 0.1));
      const rend = fruta.rendimientoMeta * cal.factor * (0.9 + r() * 0.18);
      const kgFinal = Math.round(kgProcesados * Math.min(rend, 0.95));
      folioP += 1;
      const fechaProd = new Date(rc.fecha + "T12:00:00");
      fechaProd.setDate(fechaProd.getDate() + (r() < 0.7 ? 0 : 1));
      producciones.push({
        id: uid("pr"),
        folio: "PRD-" + String(folioP).padStart(4, "0"),
        fecha: fechaProd.toISOString().slice(0, 10),
        recepcionId: rc.id,
        lote: rc.lote,
        frutaId: rc.frutaId,
        productoId: productos[Math.floor(r() * productos.length)].id,
        turno: r() < 0.55 ? "Matutino" : "Vespertino",
        kgProcesados: kgProcesados,
        kgProductoFinal: kgFinal,
        horasHombre: Math.round((kgProcesados / 110) * 10) / 10,
        operador: r() < 0.5 ? "Carlos Mendoza" : "Sofía Palma",
        observaciones: "",
        registradoPor: "us_04",
        creadoEn: rc.fecha + "T14:00:00"
      });
    });

    return {
      version: 1,
      creadoEn: new Date().toISOString(),
      frutas: frutas,
      productos: productos,
      proveedores: proveedores,
      usuarios: usuarios,
      recepciones: recepciones,
      producciones: producciones,
      bitacora: []
    };
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
    try {
      localStorage.setItem(KEY, JSON.stringify(cache));
    } catch (e) {
      console.warn("No se pudo guardar en el almacenamiento local:", e);
    }
  }

  function reset() {
    cache = semilla();
    save();
    return cache;
  }

  function importar(json) {
    const datos = typeof json === "string" ? JSON.parse(json) : json;
    if (!datos || !Array.isArray(datos.recepciones)) {
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
    return registro;
  }

  function update(coleccion, id, cambios) {
    const db = load();
    const i = db[coleccion].findIndex(function (x) { return x.id === id; });
    if (i === -1) return null;
    db[coleccion][i] = Object.assign({}, db[coleccion][i], cambios);
    save();
    return db[coleccion][i];
  }

  function remove(coleccion, id) {
    const db = load();
    const i = db[coleccion].findIndex(function (x) { return x.id === id; });
    if (i === -1) return false;
    db[coleccion].splice(i, 1);
    save();
    return true;
  }

  /* Folio correlativo por prefijo, sobre la colección indicada. */
  function siguienteFolio(coleccion, prefijo) {
    const nums = all(coleccion)
      .map(function (x) { return parseInt(String(x.folio || "").split("-")[1], 10); })
      .filter(function (n) { return !isNaN(n); });
    const max = nums.length ? Math.max.apply(null, nums) : 0;
    return prefijo + "-" + String(max + 1).padStart(4, "0");
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
    db.bitacora = db.bitacora.slice(0, 300);
    save();
  }

  return {
    CALIDADES: CALIDADES,
    ROLES: ROLES,
    hoy: hoy,
    diasAtras: diasAtras,
    uid: uid,
    load: load,
    save: save,
    reset: reset,
    importar: importar,
    exportar: exportar,
    all: all,
    get: get,
    insert: insert,
    update: update,
    remove: remove,
    siguienteFolio: siguienteFolio,
    registrarBitacora: registrarBitacora
  };
})();
