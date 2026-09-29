/* =========================================================================
   db.js — Capa de datos del Sistema FLP
   Repositorio único de información para el control de pérdidas y la
   economía circular en las tres líneas de producto.

   Unidad de flujo estándar: caja de 11 kg (definida en el alcance del TIC).

   Cada parámetro numérico de catálogo lleva su ORIGEN declarado, según el
   estándar de rigor del proyecto:
     M = medido en planta   E = estimado   S = fuente secundaria
   ========================================================================= */

const DB = (function () {
  "use strict";

  const KEY = "flp.db.v5";
  const ESQUEMA = 5;

  /* ---------------------------------------------------------------- utils */

  function uid(prefix) {
    return prefix + "_" + Math.random().toString(36).slice(2, 10);
  }

  function hoy() { return new Date().toISOString().slice(0, 10); }

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

  /* Semilla fija: la demo trae siempre los mismos números, para que las
     capturas del documento de tesis sean reproducibles. */
  function rng(seed) {
    let s = seed;
    return function () {
      s = (s * 1103515245 + 12345) % 2147483648;
      return s / 2147483648;
    };
  }

  /* ------------------------------------------------------------ constantes */

  const EMPRESA = {
    nombre: "FLP Ecuador",
    razonSocial: "F.L.P. Latinoamerican Perishables del Ecuador S.A.",
    sistema: "Sistema FLP",
    descripcion: "Trazabilidad, pérdidas y economía circular",
    confidencial: true
  };

  const PESO_CAJA_KG = 11;

  /* Origen del dato — el estándar de rigor exige declararlo en todo número
     que no venga de un registro del propio sistema. */
  const ORIGENES = [
    { id: "M", nombre: "Medido", ayuda: "Tomado en planta durante el estudio de campo." },
    { id: "E", nombre: "Estimado", ayuda: "Valor de trabajo; debe confirmarse con la empresa." },
    { id: "S", nombre: "Fuente secundaria", ayuda: "Tomado de literatura o de un referente del sector." }
  ];

  const ESTADOS = [
    { id: "Anunciado", nombre: "Anunciado", rol: "proveedor", orden: 1,
      ayuda: "El proveedor avisó que envía la fruta. Falta que llegue a planta." },
    { id: "Recibido", nombre: "Recibido", rol: "recepcion", orden: 2,
      ayuda: "Recepción contó las cajas y pesó el lote. Listo para procesar." },
    { id: "Procesado", nombre: "Procesado", rol: "produccion", orden: 3,
      ayuda: "Producción registró lo exportable y las mermas con su causa raíz." },
    { id: "Cerrado", nombre: "Cerrado", rol: "supervisor", orden: 4,
      ayuda: "Supervisión cerró el lote. Ya no admite cambios." },
    { id: "Rechazado", nombre: "Rechazado", rol: "recepcion", orden: 0,
      ayuda: "La fruta no cumplió los mínimos y no ingresó a planta." }
  ];

  const CALIDADES = [
    { id: "A", nombre: "Exportación (A)", factor: 1.0 },
    { id: "B", nombre: "Segunda (B)", factor: 0.88 },
    { id: "C", nombre: "Nacional (C)", factor: 0.74 }
  ];

  const ROLES = [
    { id: "proveedor", nombre: "Proveedor", icono: "🚜",
      lema: "Anuncias los envíos de fruta y recibes el reporte de cada lote." },
    { id: "recepcion", nombre: "Recepción", icono: "⚖️",
      lema: "Cuentas las cajas y pesas la fruta que llega a planta." },
    { id: "produccion", nombre: "Producción", icono: "🏭",
      lema: "Registras lo procesado, lo exportable y las mermas con su causa." },
    { id: "supervisor", nombre: "Supervisor", icono: "📋",
      lema: "Planificas el día, cierras lotes, envías reportes y ves los indicadores." }
  ];

  const TURNOS = ["Matutino", "Vespertino", "Nocturno"];

  /* ------------------------------------------------------------ catálogos */

  /* Los catálogos son EDITABLES desde la app: los valores marcados con
     origen "E" son de trabajo y deben confirmarse con la empresa antes de
     usarlos en el documento. */

  function lineasBase() {
    return [
      { id: "ln_pitahaya", codigo: "PIT", nombre: "Pitahaya roja",
        tiempoEstandarMin: 24.28, origenTiempo: "M",
        pesoCajaKg: PESO_CAJA_KG, origenPeso: "M",
        metaExportable: 0.82, origenMeta: "E",
        precioCaja: 18.50, origenPrecio: "E",
        color: "#c0246b", activa: true },
      { id: "ln_tomate", codigo: "TOM", nombre: "Tomate de árbol",
        tiempoEstandarMin: 26.93, origenTiempo: "M",
        pesoCajaKg: PESO_CAJA_KG, origenPeso: "M",
        metaExportable: 0.78, origenMeta: "E",
        precioCaja: 12.80, origenPrecio: "E",
        color: "#c85a1e", activa: true },
      { id: "ln_granadilla", codigo: "GRA", nombre: "Granadilla",
        tiempoEstandarMin: 29.76, origenTiempo: "M",
        pesoCajaKg: PESO_CAJA_KG, origenPeso: "M",
        metaExportable: 0.75, origenMeta: "E",
        precioCaja: 15.40, origenPrecio: "E",
        color: "#b8860b", activa: true }
    ];
  }

  /* Las ocho causas raíz del diagnóstico. Solo CR5-CR8 están nombradas en el
     documento del TIC; las demás quedan por definir y se editan desde la app
     en vez de inventarlas aquí. */
  function causasBase() {
    return [
      { id: "CR1", codigo: "CR1", nombre: "Por definir", origen: "Por clasificar",
        definida: false, principal: false, descripcion: "" },
      { id: "CR2", codigo: "CR2", nombre: "Por definir", origen: "Por clasificar",
        definida: false, principal: false, descripcion: "" },
      { id: "CR3", codigo: "CR3", nombre: "Por definir", origen: "Por clasificar",
        definida: false, principal: false, descripcion: "" },
      { id: "CR4", codigo: "CR4", nombre: "Por definir", origen: "Por clasificar",
        definida: false, principal: false,
        descripcion: "El documento registra que su cronometraje fue corregido." },
      { id: "CR5", codigo: "CR5", nombre: "Mermas sin segregar", origen: "Proceso",
        definida: true, principal: true,
        descripcion: "El descarte sale mezclado, así que no puede valorizarse." },
      { id: "CR6", codigo: "CR6", nombre: "Variabilidad de proveedor", origen: "Campo",
        definida: true, principal: true,
        descripcion: "Calidad y peso de entrega dispares entre proveedores y entre envíos." },
      { id: "CR7", codigo: "CR7", nombre: "Layout de planta", origen: "Proceso",
        definida: true, principal: true,
        descripcion: "Recorridos y transportes innecesarios entre estaciones." },
      { id: "CR8", codigo: "CR8", nombre: "Subutilización del área de sopleteado",
        origen: "Proceso", definida: true, principal: true,
        descripcion: "La estación de sopleteado opera por debajo de su capacidad." }
    ];
  }

  /* Destinos del descarte, en orden de valor recuperado. Es la jerarquía que
     sostiene el indicador de valorización: todo lo que no termina en relleno
     sanitario se considera aprovechado. */
  function destinosBase() {
    return [
      { id: "ds_segunda", nombre: "Segunda calidad — mercado nacional", nivel: 1,
        valoriza: true, valorKg: 0.45, origenValor: "E" },
      { id: "ds_subproducto", nombre: "Subproducto (pulpa, deshidratado, harina)", nivel: 2,
        valoriza: true, valorKg: 0.30, origenValor: "E" },
      { id: "ds_animal", nombre: "Alimentación animal", nivel: 3,
        valoriza: true, valorKg: 0.08, origenValor: "E" },
      { id: "ds_compost", nombre: "Compostaje", nivel: 4,
        valoriza: true, valorKg: 0.03, origenValor: "E" },
      { id: "ds_relleno", nombre: "Relleno sanitario", nivel: 5,
        valoriza: false, valorKg: -0.02, origenValor: "E" }
    ];
  }

  function proveedoresBase() {
    return [
      { id: "pv_01", codigo: "PRV-001", nombre: "Finca La Esperanza", documento: "0991234567001", contacto: "Marta Cedeño", telefono: "0985551201", email: "laesperanza@correo.com", zona: "Pichincha", activo: true, fechaAlta: diasAtras(400) },
      { id: "pv_02", codigo: "PRV-002", nombre: "Agrícola El Progreso", documento: "0992345678001", contacto: "Luis Vera", telefono: "0985551202", email: "elprogreso@correo.com", zona: "Tungurahua", activo: true, fechaAlta: diasAtras(370) },
      { id: "pv_03", codigo: "PRV-003", nombre: "Hacienda San Miguel", documento: "0993456789001", contacto: "Ana Rueda", telefono: "0985551203", email: "sanmiguel@correo.com", zona: "Santo Domingo", activo: true, fechaAlta: diasAtras(310) },
      { id: "pv_04", codigo: "PRV-004", nombre: "Cooperativa Frutos del Sur", documento: "0994567890001", contacto: "Jorge Loor", telefono: "0985551204", email: "frutosdelsur@correo.com", zona: "Imbabura", activo: true, fechaAlta: diasAtras(240) },
      { id: "pv_05", codigo: "PRV-005", nombre: "Predio Santa Rosa", documento: "0995678901001", contacto: "Elena Bravo", telefono: "0985551205", email: "santarosa@correo.com", zona: "Cotopaxi", activo: true, fechaAlta: diasAtras(180) },
      { id: "pv_06", codigo: "PRV-006", nombre: "Agroexport Valle Verde", documento: "0996789012001", contacto: "Pedro Zambrano", telefono: "0985551206", email: "valleverde@correo.com", zona: "Pichincha", activo: false, fechaAlta: diasAtras(520) }
    ];
  }

  /* Cuentas de la demostración. La credencial se calcula al sembrar, no se
     guarda escrita: ver sembrarCredenciales(). */
  const CLAVES_DEMO = {
    us_01: "pitahaya2026", us_02: "granadilla2026",
    us_03: "4521", us_04: "7734", us_05: "8890",
    us_06: "supervision2026"
  };

  function usuariosBase() {
    return [
      { id: "us_01", nombre: "Marta Cedeño", usuario: "PRV-001", rol: "proveedor", proveedorId: "pv_01", activo: true, debeCambiar: false },
      { id: "us_02", nombre: "Luis Vera", usuario: "PRV-002", rol: "proveedor", proveedorId: "pv_02", activo: true, debeCambiar: false },
      { id: "us_03", nombre: "Diego Andrade", usuario: "dandrade", rol: "recepcion", proveedorId: null, activo: true, debeCambiar: false },
      { id: "us_04", nombre: "Carlos Mendoza", usuario: "cmendoza", rol: "produccion", proveedorId: null, activo: true, debeCambiar: false },
      { id: "us_05", nombre: "Sofía Palma", usuario: "spalma", rol: "produccion", proveedorId: null, activo: true, debeCambiar: false },
      { id: "us_06", nombre: "Ing. Andrea Quiroz", usuario: "aquiroz", rol: "supervisor", proveedorId: null, activo: true, debeCambiar: false }
    ];
  }

  /* Deriva las credenciales de la demostración al arrancar. Es asíncrono, así
     que hasta que termina esos usuarios no pueden entrar: la interfaz lo
     refleja con el estado de conexión. */
  async function sembrarCredenciales() {
    const db = load();
    const pendientes = db.usuarios.filter(function (u) {
      return CLAVES_DEMO[u.id] && !u.credencial;
    });
    if (!pendientes.length) return;
    await Promise.all(pendientes.map(async function (u) {
      u.credencial = await Auth.crearCredencial(CLAVES_DEMO[u.id]);
    }));
    save();
    if (esCompartido()) pendientes.forEach(function (u) { empujar("usuarios", u); });
  }

  /* Busca por nombre de acceso o por código de proveedor, sin distinguir
     mayúsculas: en el campo se escribe como venga. */
  function buscarPorAcceso(texto) {
    const t = String(texto || "").trim().toLowerCase();
    if (!t) return null;
    return all("usuarios").find(function (u) {
      return String(u.usuario || "").toLowerCase() === t;
    }) || null;
  }

  function accesoLibre(usuario, exceptoId) {
    const t = String(usuario || "").trim().toLowerCase();
    return !all("usuarios").some(function (u) {
      return u.id !== exceptoId && String(u.usuario || "").toLowerCase() === t;
    });
  }

  /* Parámetros de planta que alimentan el planificador diario. */
  function parametrosBase() {
    return {
      horasTurno: 8, origenHorasTurno: "E",
      operariosDisponibles: 12, origenOperarios: "E",
      eficienciaPlanta: 0.85, origenEficiencia: "E",
      suplementosOIT: 0.13, origenSuplementos: "S",
      costoHoraHombre: 3.20, origenCostoHora: "E"
    };
  }

  /* ---------------------------------------------------------------- semilla */

  function semilla(dias) {
    const r = rng(20260922);
    const historial = dias || 70;

    const lineas = lineasBase();
    const causas = causasBase();
    const destinos = destinosBase();
    const proveedores = proveedoresBase();
    const usuarios = usuariosBase();

    /* Cada proveedor declara con su propio sesgo: es lo que hace visible la
       CR6 (variabilidad de proveedor) en los indicadores. */
    const sesgo = { pv_01: 0.995, pv_02: 0.972, pv_03: 0.999, pv_04: 0.962, pv_05: 0.988 };

    const lotes = [];
    let folio = 0;

    for (let d = historial; d >= 0; d -= 1) {
      const fecha = diasAtras(d);
      if (new Date(fecha + "T12:00:00").getDay() === 0) continue;

      const envios = 1 + Math.floor(r() * 3);
      for (let i = 0; i < envios; i += 1) {
        const pv = proveedores[Math.floor(r() * 5)];
        const linea = lineas[Math.floor(r() * lineas.length)];
        const calidad = r() < 0.66 ? "A" : r() < 0.87 ? "B" : "C";
        const cajas = 40 + Math.floor(r() * 180);
        folio += 1;

        const lote = {
          id: uid("lt"),
          folio: "LOT-" + String(folio).padStart(4, "0"),
          codigoLote: linea.codigo + fecha.replace(/-/g, "").slice(2) + "-" + String(folio).padStart(3, "0"),
          fecha: fecha,
          proveedorId: pv.id,
          lineaId: linea.id,
          cajasAnunciadas: cajas,
          /* El proveedor declara cuánto pesa su caja: no todas vienen al
             peso nominal, y esa diferencia es parte de la CR6. */
          pesoCajaDeclarado: Number((linea.pesoCajaKg * (0.97 + r() * 0.06)).toFixed(2)),
          kgAnunciados: 0,
          calidadDeclarada: calidad,
          precioCaja: Number((linea.precioCaja * (0.92 + r() * 0.18)).toFixed(2)),
          transporte: r() < 0.5 ? "Propio" : "Contratado",
          observacionesProveedor: "",
          anunciadoPor: "us_01",
          creadoEn: fecha + "T07:30:00",

          fechaRecepcion: null,
          cajasRecibidas: null,
          kgRecibidos: null,
          calidadVerificada: null,
          observacionesRecepcion: "",
          recibidoPor: null,

          estado: "Anunciado",
          fechaCierre: null,
          cerradoPor: null,
          reporteEnviado: false,
          fechaReporte: null
        };

        lote.kgAnunciados = Math.round(cajas * lote.pesoCajaDeclarado);

        if (d > 1) {
          if (r() < 0.03) {
            lote.estado = "Rechazado";
            lote.fechaRecepcion = fecha;
            lote.recibidoPor = "us_03";
            lote.cajasRecibidas = 0;
            lote.kgRecibidos = 0;
            lote.calidadVerificada = "C";
            lote.observacionesRecepcion = "Lote rechazado: fruta fuera de los mínimos de exportación.";
          } else {
            const s = sesgo[pv.id] || 0.99;
            lote.fechaRecepcion = r() < 0.85 ? fecha : sumarDias(fecha, 1);
            lote.recibidoPor = "us_03";
            lote.cajasRecibidas = Math.max(1, Math.round(cajas * (s + (r() - 0.5) * 0.02)));
            /* El peso por caja también varía: no todas vienen completas. */
            lote.kgRecibidos = Math.round(lote.cajasRecibidas * linea.pesoCajaKg * (0.97 + r() * 0.05));
            lote.calidadVerificada = r() < 0.18
              ? (calidad === "A" ? "B" : "C") : calidad;
            lote.estado = "Recibido";
          }
        }

        lotes.push(lote);
      }
    }

    /* ---------------------- producción ---------------------- */

    const producciones = [];
    let folioP = 0;

    lotes.forEach(function (lote) {
      if (lote.estado !== "Recibido") return;
      if (r() < 0.14) return;

      const linea = lineas.find(function (l) { return l.id === lote.lineaId; });
      const cal = CALIDADES.find(function (c) { return c.id === lote.calidadVerificada; });

      const cajasProcesadas = lote.cajasRecibidas;
      const kgProcesados = lote.kgRecibidos;
      const tasa = linea.metaExportable * cal.factor * (0.92 + r() * 0.15);
      const cajasExportables = Math.round(cajasProcesadas * Math.min(tasa, 0.95));
      const kgExportable = Math.round(cajasExportables * linea.pesoCajaKg);
      const kgMerma = kgProcesados - kgExportable;

      /* Reparto entre causas raíz. CR5-CR8 concentran la mayor parte, como
         indica el diagnóstico; las causas aún sin definir reciben poco. */
      const pesos = {
        CR5: 0.24,
        CR6: lote.calidadVerificada === "A" ? 0.14 : 0.28,
        CR7: 0.16,
        CR8: 0.20,
        CR1: 0.05, CR2: 0.04, CR3: 0.04, CR4: 0.03
      };
      const suma = Object.keys(pesos).reduce(function (a, k) { return a + pesos[k]; }, 0);

      /* Antes de segregar (CR5), casi todo el descarte va a relleno. En los
         lotes recientes ya se aplica la segregación propuesta. */
      const segrega = d3Reciente(lote.fechaRecepcion);
      const mermas = [];
      let repartido = 0;
      const claves = Object.keys(pesos);

      claves.forEach(function (k, idx) {
        let kg;
        if (idx === claves.length - 1) kg = kgMerma - repartido;
        else { kg = Math.round((kgMerma * pesos[k]) / suma); repartido += kg; }
        if (kg <= 0) return;

        let destinoId;
        if (!segrega) {
          destinoId = r() < 0.82 ? "ds_relleno" : "ds_animal";
        } else if (k === "CR6" || k === "CR5") {
          destinoId = r() < 0.5 ? "ds_segunda" : "ds_subproducto";
        } else {
          const opciones = ["ds_subproducto", "ds_animal", "ds_compost", "ds_relleno"];
          destinoId = opciones[Math.floor(r() * (r() < 0.75 ? 3 : 4))];
        }
        mermas.push({ causaId: k, kg: kg, destinoId: destinoId });
      });

      folioP += 1;
      const fechaProc = r() < 0.72 ? lote.fechaRecepcion : sumarDias(lote.fechaRecepcion, 1);

      /* Tiempo real contra el estándar: la brecha alimenta el indicador de
         eficiencia y el análisis de balanceo de línea. */
      const operarios = 3 + Math.floor(r() * 4);
      const tiempoEstandar = cajasProcesadas * linea.tiempoEstandarMin;
      const tiempoReal = Math.round(tiempoEstandar * (0.95 + r() * 0.28));

      producciones.push({
        id: uid("pr"),
        folio: "PRD-" + String(folioP).padStart(4, "0"),
        fecha: fechaProc,
        loteId: lote.id,
        codigoLote: lote.codigoLote,
        lineaId: lote.lineaId,
        turno: r() < 0.55 ? "Matutino" : "Vespertino",
        cajasProcesadas: cajasProcesadas,
        kgProcesados: kgProcesados,
        cajasExportables: cajasExportables,
        kgExportable: kgExportable,
        mermas: mermas,
        operarios: operarios,
        tiempoRealMin: tiempoReal,
        operador: r() < 0.5 ? "Carlos Mendoza" : "Sofía Palma",
        observaciones: "",
        registradoPor: "us_04",
        creadoEn: fechaProc + "T14:00:00"
      });

      lote.estado = "Procesado";

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
      esquema: ESQUEMA,
      creadoEn: new Date().toISOString(),
      lineas: lineas,
      causas: causas,
      destinos: destinos,
      proveedores: proveedores,
      usuarios: usuarios,
      lotes: lotes,
      producciones: producciones,
      planes: [],
      parametros: parametrosBase(),
      bitacora: []
    };
  }

  /* Los lotes de las últimas tres semanas ya aplican la segregación. */
  function d3Reciente(fecha) {
    if (!fecha) return false;
    return Math.round((new Date(hoy()) - new Date(fecha)) / 86400000) <= 21;
  }

  /* ------------------------------------------------- almacén compartido */

  const COLECCIONES = ["proveedores", "usuarios", "lotes", "producciones", "planes"];
  /* Catálogos y parámetros: pocos y pequeños, viajan en un solo documento. */
  const CONFIG = ["lineas", "causas", "destinos", "parametros"];

  let remoto = null;
  let modo = "local";
  const suscripciones = [];

  function esCompartido() { return modo === "compartido"; }
  function modoActual() { return modo; }

  async function conectar(alCambiar) {
    if (typeof window === "undefined" || !window.claude ||
        typeof window.claude.use !== "function") return modo;

    let almacen;
    try { almacen = await window.claude.use("db"); }
    catch (e) { return modo; }
    if (!almacen) return modo;

    remoto = almacen;

    try {
      const meta = await remoto.doc("sistema/meta").get();
      const esquemaRemoto = meta.exists ? (meta.data().esquema || 0) : 0;

      if (esquemaRemoto !== ESQUEMA) {
        /* El modelo cambió: se descarta lo anterior y se vuelve a sembrar,
           porque los registros viejos no tienen cajas ni causas raíz. */
        await limpiarRemoto();
        await sembrarRemoto();
      } else {
        const paginas = await Promise.all(
          COLECCIONES.map(function (c) { return remoto.collection(c).get(); })
        );
        const cfg = await remoto.doc("sistema/config").get();
        const bit = await remoto.doc("sistema/bitacora").get();

        const db = load();
        COLECCIONES.forEach(function (c, i) {
          db[c] = paginas[i].docs.map(function (d) { return d.data(); });
        });
        if (cfg.exists) {
          const datos = cfg.data();
          CONFIG.forEach(function (k) { if (datos[k]) db[k] = datos[k]; });
        }
        db.bitacora = bit.exists ? (bit.data().entradas || []) : [];
      }

      modo = "compartido";
      escuchar(alCambiar);
    } catch (e) {
      remoto = null;
      console.warn("No se pudo conectar el almacén compartido:", e);
    }
    return modo;
  }

  async function limpiarRemoto() {
    const paginas = await Promise.all(
      COLECCIONES.map(function (c) { return remoto.collection(c).get(); })
    );
    await Promise.all(paginas.reduce(function (acc, pagina, i) {
      pagina.docs.forEach(function (d) {
        acc.push(remoto.collection(COLECCIONES[i]).doc(d.id).delete());
      });
      return acc;
    }, []));
  }

  async function sembrarRemoto() {
    const datos = semilla(16);
    cache = datos;

    const escrituras = [];
    COLECCIONES.forEach(function (c) {
      (datos[c] || []).forEach(function (reg) {
        escrituras.push(remoto.collection(c).doc(reg.id).set(reg));
      });
    });
    escrituras.push(remoto.doc("sistema/config").set(configActual()));
    escrituras.push(remoto.doc("sistema/bitacora").set({ entradas: [] }));
    escrituras.push(remoto.doc("sistema/meta").set({ esquema: ESQUEMA, sembradoEn: new Date().toISOString() }));
    await Promise.all(escrituras);
  }

  function configActual() {
    const db = load();
    const out = {};
    CONFIG.forEach(function (k) { out[k] = db[k]; });
    return out;
  }

  function escuchar(alCambiar) {
    COLECCIONES.forEach(function (c) {
      suscripciones.push(remoto.collection(c).onSnapshot(function (snap) {
        load()[c] = snap.docs.map(function (d) { return d.data(); });
        if (alCambiar) alCambiar(c);
      }, function (err) { console.warn("Suscripción interrumpida en " + c + ":", err.code); }));
    });

    suscripciones.push(remoto.doc("sistema/config").onSnapshot(function (snap) {
      if (!snap.exists) return;
      const datos = snap.data();
      const db = load();
      CONFIG.forEach(function (k) { if (datos[k]) db[k] = datos[k]; });
      if (alCambiar) alCambiar("config");
    }, function (err) { console.warn("Suscripción interrumpida en config:", err.code); }));

    suscripciones.push(remoto.doc("sistema/bitacora").onSnapshot(function (snap) {
      load().bitacora = snap.exists ? (snap.data().entradas || []) : [];
      if (alCambiar) alCambiar("bitacora");
    }, function (err) { console.warn("Suscripción interrumpida en bitácora:", err.code); }));
  }

  function empujar(coleccion, registro) {
    if (!remoto) return;
    if (CONFIG.indexOf(coleccion) !== -1) { empujarConfig(); return; }
    remoto.collection(coleccion).doc(registro.id).set(registro).catch(avisarFallo);
  }

  function empujarBorrado(coleccion, id) {
    if (!remoto) return;
    remoto.collection(coleccion).doc(id).delete().catch(avisarFallo);
  }

  function empujarConfig() {
    if (!remoto) return;
    remoto.doc("sistema/config").set(configActual()).catch(avisarFallo);
  }

  function empujarBitacora(entradas) {
    if (!remoto) return;
    remoto.doc("sistema/bitacora").set({ entradas: entradas }).catch(avisarFallo);
  }

  let alFallar = null;
  function alFallarEscritura(fn) { alFallar = fn; }
  function avisarFallo(e) {
    const codigo = e && e.code ? e.code : "desconocido";
    console.warn("Escritura rechazada por el almacén:", codigo, e);
    if (alFallar) alFallar(codigo);
  }

  /* ------------------------------------------------------- persistencia */

  let cache = null;

  function load() {
    if (cache) return cache;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const datos = JSON.parse(raw);
        if (datos && datos.esquema === ESQUEMA) { cache = datos; return cache; }
      }
    } catch (e) {
      console.warn("No se pudo leer el almacenamiento local:", e);
    }
    cache = semilla();
    save();
    return cache;
  }

  function save() {
    if (esCompartido()) return;
    try { localStorage.setItem(KEY, JSON.stringify(cache)); }
    catch (e) { console.warn("No se pudo guardar en el almacenamiento local:", e); }
  }

  function reset() {
    if (esCompartido()) {
      return limpiarRemoto().then(sembrarRemoto).then(function () { return cache; });
    }
    cache = semilla();
    save();
    return Promise.resolve(cache);
  }

  function importar(json) {
    const datos = typeof json === "string" ? JSON.parse(json) : json;
    if (!datos || !Array.isArray(datos.lotes)) {
      throw new Error("El archivo no tiene la estructura esperada.");
    }
    cache = datos;
    save();
    if (esCompartido()) { empujarConfig(); }
    return cache;
  }

  function exportar() { return JSON.stringify(load(), null, 2); }

  /* --------------------------------------------------------------- CRUD */

  function all(coleccion) { return load()[coleccion] || []; }

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

  function parametros() { return load().parametros; }

  function guardarParametros(cambios) {
    const db = load();
    db.parametros = Object.assign({}, db.parametros, cambios);
    save();
    empujarConfig();
    return db.parametros;
  }

  function siguienteFolio(coleccion, prefijo) {
    const nums = all(coleccion)
      .map(function (x) { return parseInt(String(x.folio || "").split("-")[1], 10); })
      .filter(function (n) { return !isNaN(n); });
    const max = nums.length ? Math.max.apply(null, nums) : 0;
    return prefijo + "-" + String(max + 1).padStart(4, "0");
  }

  function causa(id) { return get("causas", id); }
  function destino(id) { return get("destinos", id); }
  function linea(id) { return get("lineas", id); }

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
    EMPRESA: EMPRESA,
    PESO_CAJA_KG: PESO_CAJA_KG,
    ORIGENES: ORIGENES,
    ESTADOS: ESTADOS,
    CALIDADES: CALIDADES,
    ROLES: ROLES,
    TURNOS: TURNOS,
    ESQUEMA: ESQUEMA,
    hoy: hoy,
    diasAtras: diasAtras,
    sumarDias: sumarDias,
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
    parametros: parametros,
    guardarParametros: guardarParametros,
    siguienteFolio: siguienteFolio,
    causa: causa,
    destino: destino,
    linea: linea,
    sembrarCredenciales: sembrarCredenciales,
    buscarPorAcceso: buscarPorAcceso,
    accesoLibre: accesoLibre,
    registrarBitacora: registrarBitacora,
    conectar: conectar,
    esCompartido: esCompartido,
    modoActual: modoActual,
    alFallarEscritura: alFallarEscritura
  };
})();
