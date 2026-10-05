/* =========================================================================
   indicadores.js — Motor de cálculo de Acopia
   Tres familias de indicadores:
     · Pérdidas      — cuánto se pierde, dónde y por qué causa raíz
     · Economía circular — cuánto del descarte se aprovecha y con qué valor
     · Proceso       — tiempo real contra estándar, productividad y takt time
   ========================================================================= */

const Indicadores = (function () {
  "use strict";

  /* ------------------------------------------------------------ nombres */

  function nombreLinea(id) { const l = DB.linea(id); return l ? l.nombre : "—"; }
  function nombreProveedor(id) { const p = DB.get("proveedores", id); return p ? p.nombre : "—"; }
  function nombreUsuario(id) { const u = DB.get("usuarios", id); return u ? u.nombre : "—"; }
  function nombreCausa(id) { const c = DB.causa(id); return c ? c.codigo + " · " + c.nombre : id; }
  function nombreDestino(id) { const d = DB.destino(id); return d ? d.nombre : "—"; }

  function colorLinea(id) { const l = DB.linea(id); return l ? l.color : "#6b7280"; }

  function totalMerma(prod) {
    return (prod.mermas || []).reduce(function (a, m) { return a + (Number(m.kg) || 0); }, 0);
  }

  /* Kilogramos de descarte que NO terminan en relleno sanitario. */
  function mermaValorizada(prod) {
    return (prod.mermas || []).reduce(function (a, m) {
      const d = DB.destino(m.destinoId);
      return a + (d && d.valoriza ? (Number(m.kg) || 0) : 0);
    }, 0);
  }

  /* Valor economico recuperado del descarte, segun el destino que se le dio. */
  function valorRecuperado(prod) {
    return (prod.mermas || []).reduce(function (a, m) {
      const d = DB.destino(m.destinoId);
      return a + (d ? (Number(m.kg) || 0) * (Number(d.valorKg) || 0) : 0);
    }, 0);
  }

  /* Tiempo estandar que ese lote deberia haber tomado, segun el estudio de
     tiempos. Es la referencia contra la que se mide la eficiencia. */
  function tiempoEstandar(prod) {
    const l = DB.linea(prod.lineaId);
    /* Minutos-PERSONA que ese lote debió consumir: es contra eso que se
       compara el tiempo que de verdad costó, no contra el reloj. */
    return l ? (Number(prod.gavetasProcesadas) || 0) *
      DB.contenidoGavetaMin(l, DB.all("actividades")) : 0;
  }

  function editable(lote) {
    return lote.estado !== "Cerrado" && lote.estado !== "Rechazado";
  }

  /* --------------------------------------------------------------- filtro */

  /* Texto libre: busca por código de lote, proveedor, línea o estado. Es
     un solo cuadro en vez de tres desplegables, que es como la gente busca
     de verdad —se acuerda del código, o del proveedor, no del filtro. */
  function coincideTexto(l, texto) {
    const t = String(texto).trim().toLowerCase();
    if (!t) return true;
    return [l.codigoLote, l.folio, l.estado, nombreProveedor(l.proveedorId),
            nombreLinea(l.lineaId), l.fecha]
      .some(function (c) { return String(c || "").toLowerCase().indexOf(t) !== -1; });
  }

  function filtrar(filtros) {
    const f = filtros || {};
    const desde = f.desde || "0000-01-01";
    const hasta = f.hasta || "9999-12-31";

    const lotes = DB.all("lotes").filter(function (l) {
      if (f.texto && !coincideTexto(l, f.texto)) return false;
      if (l.fecha < desde || l.fecha > hasta) return false;
      if (f.proveedorId && l.proveedorId !== f.proveedorId) return false;
      if (f.lineaId && l.lineaId !== f.lineaId) return false;
      if (f.calidad && (l.calidadVerificada || l.calidadDeclarada) !== f.calidad) return false;
      if (f.estado && l.estado !== f.estado) return false;
      return true;
    });

    const indice = {};
    lotes.forEach(function (l) { indice[l.id] = l; });

    const producciones = DB.all("producciones").filter(function (p) {
      return !!indice[p.loteId];
    });

    return { lotes: lotes, producciones: producciones, indice: indice };
  }

  function suma(lista, campo) {
    return lista.reduce(function (a, x) { return a + (Number(x[campo]) || 0); }, 0);
  }

  /* --------------------------------------------------------------- KPIs */

  function calcular(filtros) {
    const datos = filtrar(filtros);
    const lotes = datos.lotes;
    const prod = datos.producciones;

    const pesados = lotes.filter(function (l) {
      return l.gavetasRecibidas !== null && l.estado !== "Rechazado";
    });

    const gavetasAnunciadas = suma(lotes, "gavetasAnunciadas");
    const gavetasAnunPesadas = suma(pesados, "gavetasAnunciadas");
    const gavetasRecibidas = suma(pesados, "gavetasRecibidas");
    const kgRecibidos = suma(pesados, "kgRecibidos");
    const kgAnunPesados = suma(pesados, "kgAnunciados");

    const gavetasProcesadas = suma(prod, "gavetasProcesadas");
    const kgProcesados = suma(prod, "kgProcesados");
    const cajasExportables = suma(prod, "cajasExportables");
    const kgExportable = suma(prod, "kgExportable");

    /* Lo retirado al recibir no pasa por producción, así que no está en las
       mermas: hay que sumarlo aparte o el balance no cierra. */
    const kgRetirados = pesados.reduce(function (a, l) {
      return a + (Number(l.kgRetirados) || 0);
    }, 0);
    const kgMerma = prod.reduce(function (a, p) { return a + totalMerma(p); }, 0);
    const kgValorizado = prod.reduce(function (a, p) { return a + mermaValorizada(p); }, 0);
    const valorDescarte = prod.reduce(function (a, p) { return a + valorRecuperado(p); }, 0);

    const minutosReales = suma(prod, "tiempoRealMin");
    const minutosEstandar = prod.reduce(function (a, p) { return a + tiempoEstandar(p); }, 0);
    const horasHombre = prod.reduce(function (a, p) {
      return a + ((Number(p.tiempoRealMin) || 0) * (Number(p.operarios) || 0)) / 60;
    }, 0);

    const valorCompra = pesados.reduce(function (a, l) {
      return a + (Number(l.kgRecibidos) || 0) * (Number(l.precioKg) || 0);
    }, 0);

    /* Meta ponderada por la mezcla realmente procesada: si el periodo tuvo
       mucha granadilla (meta mas baja), la meta del periodo debe bajar. */
    let metaPonderada = 0;
    if (gavetasProcesadas > 0) {
      const acc = prod.reduce(function (a, p) {
        const l = DB.linea(p.lineaId);
        return a + (l ? l.metaRendimiento : 0.98) * (Number(p.kgProcesados) || 0);
      }, 0);
      metaPonderada = kgProcesados > 0 ? acc / kgProcesados : 0;
    }

    /* Rendimiento exportable EN KILOS: de lo que entró a proceso, cuánto
       salió empacado. Antes se dividía cajas entre cajas, con bultos de
       distinto peso a la entrada (gaveta) y a la salida (caja), así que el
       número no significaba nada. */
    const tasaExportable = kgProcesados > 0 ? kgExportable / kgProcesados : 0;
    const diferenciaGavetas = gavetasRecibidas - gavetasAnunPesadas;

    const cerrados = lotes.filter(function (l) { return l.estado === "Cerrado" && l.fechaCierre; });
    const cicloTotal = cerrados.reduce(function (a, l) {
      return a + Math.round((new Date(l.fechaCierre) - new Date(l.fecha)) / 86400000);
    }, 0);

    const porEstado = {};
    DB.ESTADOS.forEach(function (e) {
      porEstado[e.id] = lotes.filter(function (l) { return l.estado === e.id; }).length;
    });

    const rechazados = lotes.filter(function (l) { return l.estado === "Rechazado"; });
    /* Lo perdido se mide en kilos y se valora al precio pagado al
        productor: una «caja perdida» no existe, porque lo que se pierde
        nunca llegó a ser caja. */
    const kgPerdidos = kgProcesados - kgExportable;

    return {
      /* --- volumen --- */
      gavetasAnunciadas: gavetasAnunciadas,
      gavetasRecibidas: gavetasRecibidas,
      kgRecibidos: kgRecibidos,
      diferenciaGavetas: diferenciaGavetas,
      tasaDiferenciaGavetas: gavetasAnunPesadas > 0 ? diferenciaGavetas / gavetasAnunPesadas : 0,
      /* Dos diferencias distintas: pueden llegar todas las gavetas y aun
         así pesar menos, si vienen incompletas. */
      kgAnunciados: kgAnunPesados,
      diferenciaKg: kgRecibidos - kgAnunPesados,
      tasaDiferenciaKg: kgAnunPesados > 0 ? (kgRecibidos - kgAnunPesados) / kgAnunPesados : 0,
      gavetasProcesadas: gavetasProcesadas,
      kgProcesados: kgProcesados,
      cajasExportables: cajasExportables,
      kgExportable: kgExportable,
      kgPerdidos: kgPerdidos,

      /* --- perdidas --- */
      tasaExportable: tasaExportable,
      metaRendimiento: metaPonderada,
      cumplimientoMeta: metaPonderada > 0 ? tasaExportable / metaPonderada : 0,
      kgMerma: kgMerma,
      tasaMerma: kgProcesados > 0 ? kgMerma / kgProcesados : 0,
      kgRetirados: kgRetirados,
      tasaRetiro: kgRecibidos > 0 ? kgRetirados / kgRecibidos : 0,
      /* Pérdida de verdad: desde la báscula hasta la caja, retiro incluido. */
      perdidaTotal: kgRetirados + kgMerma,
      rendimientoGlobal: kgRecibidos > 0 ? kgExportable / kgRecibidos : 0,

      /* --- economia circular --- */
      kgValorizado: kgValorizado,
      tasaValorizacion: kgMerma > 0 ? kgValorizado / kgMerma : 0,
      kgRelleno: kgMerma - kgValorizado,
      valorDescarte: valorDescarte,

      /* --- proceso --- */
      minutosReales: minutosReales,
      minutosEstandar: minutosEstandar,
      /* El estándar está en minutos-PERSONA, así que el real también tiene
         que estarlo: minutos de reloj × operarios. Compararlo contra el
         reloj a secas daba eficiencias del 600%, que es la señal de que se
         estaban mezclando dos unidades. */
      eficienciaTiempo: horasHombre > 0 ? minutosEstandar / (horasHombre * 60) : 0,
      horasHombre: horasHombre,
      productividad: horasHombre > 0 ? gavetasProcesadas / horasHombre : 0,
      minutosPorGaveta: gavetasProcesadas > 0 ? (horasHombre * 60) / gavetasProcesadas : 0,

      /* --- economico --- */
      valorCompra: valorCompra,
      costoPorCajaExportable: cajasExportables > 0 ? valorCompra / cajasExportables : 0,
      perdidaEconomica: kgPerdidos * (kgRecibidos > 0 ? valorCompra / kgRecibidos : 0),

      /* --- flujo --- */
      numLotes: lotes.length,
      numProducciones: prod.length,
      porEstado: porEstado,
      numRechazados: rechazados.length,
      tasaRechazo: lotes.length > 0 ? rechazados.length / lotes.length : 0,
      cajasSinProcesar: Math.max(gavetasRecibidas - gavetasProcesadas, 0),
      tasaProcesamiento: gavetasRecibidas > 0 ? gavetasProcesadas / gavetasRecibidas : 0,
      cicloPromedio: cerrados.length > 0 ? cicloTotal / cerrados.length : 0,
      numCerrados: cerrados.length,
      proveedoresActivos: new Set(lotes.map(function (l) { return l.proveedorId; })).size
    };
  }

  /* ------------------------------------------------------ agrupaciones */

  function porProveedor(filtros) {
    const datos = filtrar(filtros);
    const mapa = {};

    datos.lotes.forEach(function (l) {
      if (!mapa[l.proveedorId]) {
        mapa[l.proveedorId] = {
          proveedorId: l.proveedorId, nombre: nombreProveedor(l.proveedorId),
          lotes: 0, rechazados: 0, gavetasAnunciadas: 0, gavetasAnunPesadas: 0,
          gavetasRecibidas: 0, kgAnunPesados: 0, kgRecibidos: 0, valor: 0, calidadA: 0,
          gavetasProcesadas: 0, cajasExportables: 0,
          kgProcesados: 0, kgExportable: 0, kgMerma: 0
        };
      }
      const m = mapa[l.proveedorId];
      m.lotes += 1;
      m.gavetasAnunciadas += Number(l.gavetasAnunciadas) || 0;
      if (l.estado === "Rechazado") { m.rechazados += 1; return; }
      if (l.gavetasRecibidas === null) return;
      m.gavetasAnunPesadas += Number(l.gavetasAnunciadas) || 0;
      m.gavetasRecibidas += Number(l.gavetasRecibidas) || 0;
      m.kgAnunPesados += Number(l.kgAnunciados) || 0;
      m.kgRecibidos += Number(l.kgRecibidos) || 0;
      m.valor += (Number(l.kgRecibidos) || 0) * (Number(l.precioKg) || 0);
      if (l.calidadVerificada === "A") m.calidadA += Number(l.gavetasRecibidas) || 0;
    });

    datos.producciones.forEach(function (p) {
      const lote = datos.indice[p.loteId];
      if (!lote || !mapa[lote.proveedorId]) return;
      const m = mapa[lote.proveedorId];
      m.gavetasProcesadas += Number(p.gavetasProcesadas) || 0;
      m.cajasExportables += Number(p.cajasExportables) || 0;
      m.kgProcesados += Number(p.kgProcesados) || 0;
      m.kgExportable += Number(p.kgExportable) || 0;
      m.kgMerma += totalMerma(p);
    });

    return Object.keys(mapa).map(function (k) {
      const m = mapa[k];
      m.tasaExportable = m.kgProcesados > 0 ? m.kgExportable / m.kgProcesados : 0;
      m.pctCalidadA = m.gavetasRecibidas > 0 ? m.calidadA / m.gavetasRecibidas : 0;
      m.precioPromedio = m.gavetasRecibidas > 0 ? m.valor / m.gavetasRecibidas : 0;
      m.diferenciaGavetas = m.gavetasRecibidas - m.gavetasAnunPesadas;
      m.tasaDiferencia = m.gavetasAnunPesadas > 0 ? m.diferenciaGavetas / m.gavetasAnunPesadas : 0;
      m.tasaDiferenciaKg = m.kgAnunPesados > 0
        ? (m.kgRecibidos - m.kgAnunPesados) / m.kgAnunPesados : 0;
      m.pesoGavetaReal = m.gavetasRecibidas > 0 ? m.kgRecibidos / m.gavetasRecibidas : 0;
      m.tasaRechazo = m.lotes > 0 ? m.rechazados / m.lotes : 0;
      /* Indice de variabilidad: es la CR6 hecha numero. Combina lo que el
         proveedor falla al declarar, lo que le rechazan y lo que rinde. */
      m.indiceVariabilidad = Math.abs(m.tasaDiferencia) + m.tasaRechazo +
        Math.max(0, 0.8 - m.tasaExportable);
      return m;
    }).sort(function (a, b) { return b.gavetasRecibidas - a.gavetasRecibidas; });
  }

  function porLinea(filtros) {
    const datos = filtrar(filtros);
    const mapa = {};

    function bucket(id) {
      if (!mapa[id]) {
        const l = DB.linea(id);
        mapa[id] = {
          lineaId: id, nombre: nombreLinea(id), color: colorLinea(id),
          meta: l ? l.metaRendimiento : 0,
          gavetasRecibidas: 0, gavetasProcesadas: 0, cajasExportables: 0,
          kgProcesados: 0, kgExportable: 0,
          kgMerma: 0, kgValorizado: 0, minutosReales: 0, minutosEstandar: 0
        };
      }
      return mapa[id];
    }

    datos.lotes.forEach(function (l) {
      bucket(l.lineaId).gavetasRecibidas += Number(l.gavetasRecibidas) || 0;
    });
    datos.producciones.forEach(function (p) {
      const b = bucket(p.lineaId);
      b.gavetasProcesadas += Number(p.gavetasProcesadas) || 0;
      b.cajasExportables += Number(p.cajasExportables) || 0;
      b.kgProcesados += Number(p.kgProcesados) || 0;
      b.kgExportable += Number(p.kgExportable) || 0;
      b.kgMerma += totalMerma(p);
      b.kgValorizado += mermaValorizada(p);
      /* Minutos-persona: el reloj multiplicado por la gente que estuvo. */
      b.minutosReales += (Number(p.tiempoRealMin) || 0) * (Number(p.operarios) || 1);
      b.minutosEstandar += tiempoEstandar(p);
    });

    return Object.keys(mapa).map(function (k) {
      const m = mapa[k];
      m.tasaExportable = m.kgProcesados > 0 ? m.kgExportable / m.kgProcesados : 0;
      m.brecha = m.tasaExportable - m.meta;
      m.eficiencia = m.minutosReales > 0 ? m.minutosEstandar / m.minutosReales : 0;
      m.minutosPorGaveta = m.gavetasProcesadas > 0 ? m.minutosReales / m.gavetasProcesadas : 0;
      m.tasaValorizacion = m.kgMerma > 0 ? m.kgValorizado / m.kgMerma : 0;
      return m;
    }).sort(function (a, b) { return b.gavetasRecibidas - a.gavetasRecibidas; });
  }

  /* Pareto por causa raiz: cuanto pesa cada CR en la perdida total. Es el
     indicador que sostiene la priorizacion CR5-CR8 del diagnostico. */
  function porCausaRaiz(filtros) {
    const prod = filtrar(filtros).producciones;
    const mapa = {};

    DB.all("causas").forEach(function (c) {
      mapa[c.id] = {
        causaId: c.id, codigo: c.codigo, nombre: c.nombre,
        etiqueta: c.codigo + " · " + c.nombre,
        origen: c.origen, definida: c.definida, principal: c.principal,
        kg: 0, valorPerdido: 0
      };
    });

    prod.forEach(function (p) {
      const l = DB.linea(p.lineaId);
      const valorKg = l ? (Number(l.valorKgProductor) || 0) : 0;
      (p.mermas || []).forEach(function (m) {
        if (!mapa[m.causaId]) return;
        const kg = Number(m.kg) || 0;
        const d = DB.destino(m.destinoId);
        mapa[m.causaId].kg += kg;
        /* Lo perdido es la diferencia entre lo que valia como exportacion y
           lo que finalmente se recupero por su destino. */
        mapa[m.causaId].valorPerdido += kg * (valorKg - (d ? (Number(d.valorKg) || 0) : 0));
      });
    });

    const lista = Object.keys(mapa).map(function (k) { return mapa[k]; })
      .filter(function (x) { return x.kg > 0; })
      .sort(function (a, b) { return b.kg - a.kg; });

    const total = lista.reduce(function (a, x) { return a + x.kg; }, 0);
    let acumulado = 0;
    lista.forEach(function (x) {
      x.porcentaje = total > 0 ? x.kg / total : 0;
      acumulado += x.porcentaje;
      x.acumulado = acumulado;
    });
    return lista;
  }

  /* ================================= pérdida por etapa

     Dónde se cae la fruta: al recibirla, al seleccionarla o al empacarla.
     Es el balance de masa del TIC, y sin esta separación «merma» era un
     solo número que no decía dónde actuar: retirar en recepción es un
     problema del proveedor, caerse en selección es un problema de método.
     ==================================================================== */

  function porEtapa(filtros) {
    const datos = filtrar(filtros);
    const mapa = {};
    DB.ETAPAS.forEach(function (e) {
      mapa[e.id] = { etapaId: e.id, nombre: e.nombre, orden: e.orden, ayuda: e.ayuda,
                     kg: 0, valorPerdido: 0, lotes: 0 };
    });

    /* Recepción: el retiro vive en el lote, no en la producción. */
    datos.lotes.forEach(function (l) {
      const kg = Number(l.kgRetirados) || 0;
      if (kg <= 0) return;
      const ln = DB.linea(l.lineaId);
      const d = DB.destino(l.destinoRetiro);
      mapa.recepcion.kg += kg;
      mapa.recepcion.lotes += 1;
      mapa.recepcion.valorPerdido += kg *
        ((ln ? Number(ln.valorKgProductor) || 0 : 0) - (d ? Number(d.valorKg) || 0 : 0));
    });

    datos.producciones.forEach(function (p) {
      const ln = DB.linea(p.lineaId);
      const valorKg = ln ? Number(ln.valorKgProductor) || 0 : 0;
      const vistas = {};
      (p.mermas || []).forEach(function (m) {
        /* Lo registrado antes de separar etapas se cuenta en selección, que
           es donde ocurre la mayor parte; marcarlo como desconocido dejaría
           un hueco en el balance. */
        const e = mapa[m.etapa] ? m.etapa : "seleccion";
        const kg = Number(m.kg) || 0;
        const d = DB.destino(m.destinoId);
        mapa[e].kg += kg;
        mapa[e].valorPerdido += kg * (valorKg - (d ? Number(d.valorKg) || 0 : 0));
        if (!vistas[e]) { mapa[e].lotes += 1; vistas[e] = true; }
      });
    });

    const total = DB.ETAPAS.reduce(function (a, e) { return a + mapa[e.id].kg; }, 0);
    return DB.ETAPAS.map(function (e) {
      const x = mapa[e.id];
      x.porcentaje = total > 0 ? x.kg / total : 0;
      return x;
    });
  }

  /* El balance de masa en cascada: cuánto entra, cuánto se cae en cada
     etapa y cuánto sale empacado. Es la figura del documento. */
  function balanceMasa(filtros) {
    const datos = filtrar(filtros);
    const etapas = porEtapa(filtros);
    const porId = {};
    etapas.forEach(function (e) { porId[e.etapaId] = e; });

    const kgRecibidos = datos.lotes.reduce(function (a, l) {
      return a + (Number(l.kgRecibidos) || 0);
    }, 0);
    const retiro = porId.recepcion.kg;
    const aProceso = kgRecibidos - retiro;
    const seleccion = porId.seleccion.kg;
    const aEmpaque = aProceso - seleccion;
    const empaque = porId.empaque.kg;
    const exportado = aEmpaque - empaque;

    return {
      kgRecibidos: kgRecibidos,
      pasos: [
        { id: "recibido", nombre: "Recibido en báscula", kg: kgRecibidos, perdida: 0 },
        { id: "recepcion", nombre: "Retirado al recibir", kg: aProceso, perdida: retiro },
        { id: "seleccion", nombre: "Descartado en selección", kg: aEmpaque, perdida: seleccion },
        { id: "empaque", nombre: "Perdido en empaque", kg: exportado, perdida: empaque }
      ],
      kgExportado: exportado,
      perdidaTotal: retiro + seleccion + empaque,
      rendimientoGlobal: kgRecibidos > 0 ? exportado / kgRecibidos : 0,
      rendimientoProceso: aProceso > 0 ? exportado / aProceso : 0,
      tasaRetiro: kgRecibidos > 0 ? retiro / kgRecibidos : 0
    };
  }

  /* Reparto del descarte por destino: la foto de la economia circular. */
  function porDestino(filtros) {
    const prod = filtrar(filtros).producciones;
    const mapa = {};

    DB.all("destinos").forEach(function (d) {
      mapa[d.id] = {
        destinoId: d.id, nombre: d.nombre, nivel: d.nivel,
        valoriza: d.valoriza, valorKg: d.valorKg, kg: 0, valor: 0
      };
    });

    prod.forEach(function (p) {
      (p.mermas || []).forEach(function (m) {
        if (!mapa[m.destinoId]) return;
        const kg = Number(m.kg) || 0;
        mapa[m.destinoId].kg += kg;
        mapa[m.destinoId].valor += kg * (Number(mapa[m.destinoId].valorKg) || 0);
      });
    });

    return Object.keys(mapa).map(function (k) { return mapa[k]; })
      .filter(function (x) { return x.kg > 0; })
      .sort(function (a, b) { return a.nivel - b.nivel; });
  }

  function porCalidad(filtros) {
    const lotes = filtrar(filtros).lotes;
    return DB.CALIDADES.map(function (c) {
      const items = lotes.filter(function (l) {
        return (l.calidadVerificada || l.calidadDeclarada) === c.id && l.estado !== "Rechazado";
      });
      return {
        id: c.id, nombre: c.nombre,
        kg: items.reduce(function (a, l) {
          return a + (Number(l.gavetasRecibidas) || Number(l.gavetasAnunciadas) || 0);
        }, 0),
        lotes: items.length
      };
    }).filter(function (x) { return x.kg > 0; });
  }

  function serie(filtros, granularidad) {
    const datos = filtrar(filtros);
    const corte = granularidad === "mes" ? 7 : 10;
    const mapa = {};

    function bucket(fecha) {
      const k = fecha.slice(0, corte);
      if (!mapa[k]) mapa[k] = { periodo: k, recibido: 0, procesado: 0, exportable: 0 };
      return mapa[k];
    }

    datos.lotes.forEach(function (l) {
      if (l.gavetasRecibidas === null) return;
      bucket(l.fechaRecepcion || l.fecha).recibido += Number(l.gavetasRecibidas) || 0;
    });
    datos.producciones.forEach(function (p) {
      const b = bucket(p.fecha);
      b.procesado += Number(p.kgProcesados) || 0;
      b.exportable += Number(p.kgExportable) || 0;
    });

    return Object.keys(mapa).sort().map(function (k) {
      const m = mapa[k];
      m.tasaExportable = m.procesado > 0 ? m.exportable / m.procesado : 0;
      return m;
    });
  }

  /* ===================================== estudio de tiempos y asignación

     Dos relojes, nunca uno. Confundirlos es el error clásico, y era el de
     la versión anterior de esta app:

       · TIEMPO DE CICLO (min/gaveta)  — cuánto tarda la gaveta en recorrer
         la línea. Sirve para prometer entregas y para compararse con el
         takt. No depende de cuánta gente haya.
       · CONTENIDO DE TRABAJO (min-persona/gaveta) — cuánta mano de obra
         consume esa misma gaveta. Sirve para asignar personal y costear.
         Sí depende: una actividad con dos personas tarda lo mismo y cuesta
         el doble.

     La asignación sale del segundo dividido por el takt, y la estación que
     manda es la de mayor contenido, no la más larga.
     ==================================================================== */

  function estudioTiempos(lineaId, opciones) {
    const linea = DB.linea(lineaId);
    if (!linea) return null;
    const o = opciones || {};
    const p = DB.parametros();

    const disponible = Number(o.disponibleMin) || p.disponibleMin;
    const ingresoKg = Number(o.ingresoDiarioKg) || linea.ingresoDiarioKg;
    const porGaveta = DB.cajasPorGaveta(linea);
    const gavetasDia = linea.pesoGavetaKg > 0 ? ingresoKg / linea.pesoGavetaKg : 0;

    const detalle = DB.actividadesDe(lineaId, DB.all("actividades"))
      .slice()
      .sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); })
      .map(function (a) {
        const tn = (Number(a.to) || 0) * (Number(a.v) || 1);
        const te = tn * (1 + (Number(a.suplemento) || 0));
        const unidades = a.unidad === "caja" ? porGaveta : 1;
        const personas = Number(a.personas) || 1;
        return {
          id: a.id, codigo: a.codigo, nombre: a.nombre, simbolo: a.simbolo,
          estacion: a.estacion, unidad: a.unidad, origen: a.origen, base: a.base,
          to: Number(a.to) || 0, v: Number(a.v) || 1, suplemento: Number(a.suplemento) || 0,
          tn: tn, te: te, personas: personas,
          unidadesPorGaveta: unidades,
          tePorGaveta: te * unidades,
          minPersonaPorGaveta: te * unidades * personas
        };
      });

    const ciclo = detalle.reduce(function (a, d) { return a + d.tePorGaveta; }, 0);
    const contenido = detalle.reduce(function (a, d) { return a + d.minPersonaPorGaveta; }, 0);

    detalle.forEach(function (d) {
      d.participacion = contenido > 0 ? d.minPersonaPorGaveta / contenido : 0;
    });

    /* Resumen por estación: es el nivel al que se asigna gente de verdad. */
    const mapa = {};
    detalle.forEach(function (d) {
      if (!mapa[d.estacion]) {
        mapa[d.estacion] = { estacion: d.estacion, ciclo: 0, contenido: 0, actividades: 0 };
      }
      mapa[d.estacion].ciclo += d.tePorGaveta;
      mapa[d.estacion].contenido += d.minPersonaPorGaveta;
      mapa[d.estacion].actividades += 1;
    });

    /* Takt: cada cuántos minutos debe salir una gaveta para cubrir el
       ingreso del día con el tiempo disponible del turno. */
    const takt = gavetasDia > 0 ? disponible / gavetasDia : 0;

    const estaciones = Object.keys(mapa).map(function (k) { return mapa[k]; });
    estaciones.forEach(function (e) {
      e.participacion = contenido > 0 ? e.contenido / contenido : 0;
      /* Gente necesaria en la estación para no romper el takt. */
      e.operarios = takt > 0 ? e.contenido / takt : 0;
      e.operariosEnteros = Math.ceil(e.operarios - 0.0001);
    });
    estaciones.sort(function (a, b) { return b.contenido - a.contenido; });

    const operariosExactos = takt > 0 ? contenido / takt : 0;
    const cuello = estaciones[0] || null;

    const cajasDia = gavetasDia * porGaveta;
    const costoLinea = (contenido / 60) * p.costoHoraHombre;   // por gaveta

    return {
      linea: linea,
      detalle: detalle,
      estaciones: estaciones,
      cuello: cuello,
      disponibleMin: disponible,
      ingresoDiarioKg: ingresoKg,
      gavetasDia: gavetasDia,
      cajasDia: cajasDia,
      cajasPorGaveta: porGaveta,
      cicloGavetaMin: ciclo,
      contenidoGavetaMin: contenido,
      cicloCajaMin: porGaveta > 0 ? ciclo / porGaveta : 0,
      contenidoCajaMin: porGaveta > 0 ? contenido / porGaveta : 0,
      contenidoKgMin: linea.pesoGavetaKg > 0 ? contenido / linea.pesoGavetaKg : 0,
      taktMin: takt,
      operariosExactos: operariosExactos,
      operariosMinimos: Math.ceil(operariosExactos - 0.0001),
      /* Eficiencia del balanceo: cuánta de la capacidad asignada se usa de
         verdad. Lo que se pierde aquí son personas paradas esperando. */
      eficienciaBalance: cuello && cuello.operariosEnteros > 0
        ? operariosExactos / estaciones.reduce(function (a, e) { return a + e.operariosEnteros; }, 0)
        : 0,
      costoManoObraGaveta: costoLinea,
      costoManoObraCaja: porGaveta > 0 ? costoLinea / porGaveta : 0,
      costoManoObraKg: linea.pesoGavetaKg > 0 ? costoLinea / linea.pesoGavetaKg : 0
    };
  }

  /* Las tres líneas de un vistazo, que es la tabla comparativa del TIC. */
  function estudioTodas(opciones) {
    return DB.all("lineas").filter(function (l) { return l.activa; })
      .map(function (l) { return estudioTiempos(l.id, opciones); })
      .filter(Boolean);
  }

  /* ------------------------------------------------- planificación diaria */

  /* El plan se escribe en GAVETAS, que es lo que de verdad entra del campo
     y lo que hay en cámara. De ahí salen las cajas, no al revés.

     La asignación de gente usa el CONTENIDO DE TRABAJO (min-persona), no el
     tiempo de ciclo: la versión anterior dividía el ciclo entre los minutos
     de un operario, lo que subestimaba el personal en toda actividad
     atendida por más de una persona —el sopleteado de pitahaya o la
     clasificación de tomate, justo las que mandan. */
  function planificar(plan) {
    const p = DB.parametros();
    const minutosTurno = Number(plan.jornadaMin) || p.jornadaMin;
    const pausas = plan.pausasMin === undefined ? p.pausasMin : Number(plan.pausasMin);
    const operarios = Number(plan.operarios) || p.operariosDisponibles;
    const eficiencia = Number(plan.eficiencia) || p.eficienciaPlanta;

    /* Tiempo con el que se cuenta de verdad: la jornada menos las pausas,
       ajustada por la eficiencia observada de la planta. Los suplementos de
       la OIT NO se restan aquí: ya están dentro de cada tiempo estándar. */
    const disponibleMin = Math.max(0, minutosTurno - pausas);
    const minutosNetosPorOperario = disponibleMin * eficiencia;
    const capacidadTotalMin = minutosNetosPorOperario * operarios;

    const detalle = (plan.lineas || []).map(function (item) {
      const linea = DB.linea(item.lineaId);
      if (!linea) return null;
      const gavetas = Number(item.gavetas) || 0;
      const est = estudioTiempos(linea.id, { disponibleMin: disponibleMin });
      if (!est) return null;

      const minutosRequeridos = gavetas * est.contenidoGavetaMin;
      const operariosNecesarios = minutosNetosPorOperario > 0
        ? minutosRequeridos / minutosNetosPorOperario : 0;
      const kg = gavetas * linea.pesoGavetaKg;

      return {
        lineaId: linea.id,
        nombre: linea.nombre,
        color: linea.color,
        gavetas: gavetas,
        cajas: gavetas * est.cajasPorGaveta,
        cicloGavetaMin: est.cicloGavetaMin,
        contenidoGavetaMin: est.contenidoGavetaMin,
        /* Minutos-persona que pide el plan. */
        minutosRequeridos: minutosRequeridos,
        horasRequeridas: minutosRequeridos / 60,
        operariosNecesarios: operariosNecesarios,
        /* Takt: cada cuántos minutos debe salir una gaveta para cumplir. */
        taktMin: gavetas > 0 ? disponibleMin / gavetas : 0,
        /* Lo que la línea puede dar si se le pone la gente que pide. */
        cuello: est.cuello ? est.cuello.estacion : "—",
        cuelloParticipacion: est.cuello ? est.cuello.participacion : 0,
        estaciones: est.estaciones,
        kg: kg,
        valor: kg * linea.valorKgProductor,
        costoManoObra: (minutosRequeridos / 60) * p.costoHoraHombre
      };
    }).filter(Boolean);

    const minutosRequeridos = detalle.reduce(function (a, d) { return a + d.minutosRequeridos; }, 0);
    const gavetasTotales = detalle.reduce(function (a, d) { return a + d.gavetas; }, 0);
    const cajasTotales = detalle.reduce(function (a, d) { return a + d.cajas; }, 0);
    const operariosNecesarios = detalle.reduce(function (a, d) { return a + d.operariosNecesarios; }, 0);

    /* Carga: >1 significa que el plan no cabe en el turno con esa gente. */
    const carga = capacidadTotalMin > 0 ? minutosRequeridos / capacidadTotalMin : 0;

    detalle.forEach(function (d) {
      d.participacion = minutosRequeridos > 0 ? d.minutosRequeridos / minutosRequeridos : 0;
      d.operariosAsignados = operariosNecesarios > 0
        ? Math.round((d.operariosNecesarios / operariosNecesarios) * operarios * 10) / 10 : 0;
    });

    /* Materia prima realmente disponible en camara para cada linea. */
    const disponible = {};
    DB.all("lotes").forEach(function (l) {
      if (l.estado !== "Recibido") return;
      disponible[l.lineaId] = (disponible[l.lineaId] || 0) + (Number(l.gavetasRecibidas) || 0);
    });
    detalle.forEach(function (d) {
      d.disponible = disponible[d.lineaId] || 0;
      d.faltante = Math.max(0, d.gavetas - d.disponible);
    });

    return {
      detalle: detalle,
      gavetasTotales: gavetasTotales,
      cajasTotales: cajasTotales,
      kgTotales: detalle.reduce(function (a, d) { return a + d.kg; }, 0),
      valorTotal: detalle.reduce(function (a, d) { return a + d.valor; }, 0),
      minutosRequeridos: minutosRequeridos,
      horasRequeridas: minutosRequeridos / 60,
      capacidadTotalMin: capacidadTotalMin,
      capacidadHoras: capacidadTotalMin / 60,
      carga: carga,
      alcanza: carga <= 1,
      operarios: operarios,
      operariosNecesarios: operariosNecesarios,
      operariosFaltantes: Math.max(0, Math.ceil(operariosNecesarios - operarios)),
      jornadaMin: minutosTurno,
      pausasMin: pausas,
      disponibleMin: disponibleMin,
      minutosNetosPorOperario: minutosNetosPorOperario,
      taktPromedio: gavetasTotales > 0 ? disponibleMin / gavetasTotales : 0,
      costoManoObra: detalle.reduce(function (a, d) { return a + d.costoManoObra; }, 0),
      hayFaltantes: detalle.some(function (d) { return d.faltante > 0; })
    };
  }

  /* ==================================== resumen para archivar

     Un mes entero comprimido en un solo documento. Conserva lo que
     sostiene los indicadores —kilos, rendimiento, merma por causa y por
     destino, valor— y suelta lo que ya no se consulta: el lote a lote.

     No es un sustituto del respaldo. El respaldo guarda TODO y se descarga
     antes de archivar; esto es lo que queda dentro de la app para poder
     seguir mirando la historia sin ocupar un documento por lote.
     ==================================================================== */

  function resumenMensual(mes) {
    const desde = mes + "-01";
    const d = new Date(desde + "T12:00:00");
    const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const hasta = mes + "-" + String(fin.getDate()).padStart(2, "0");

    const f = { desde: desde, hasta: hasta };
    const k = calcular(f);
    const datos = filtrar(f);

    return {
      id: "res_" + mes,
      mes: mes,
      desde: desde,
      hasta: hasta,
      generadoEn: new Date().toISOString(),
      lotes: k.numLotes,
      producciones: k.numProducciones,
      gavetasRecibidas: k.gavetasRecibidas,
      kgRecibidos: k.kgRecibidos,
      kgProcesados: k.kgProcesados,
      kgExportable: k.kgExportable,
      cajasExportables: k.cajasExportables,
      kgMerma: k.kgMerma,
      kgValorizado: k.kgValorizado,
      valorCompra: k.valorCompra,
      valorDescarte: k.valorDescarte,
      tasaExportable: k.tasaExportable,
      tasaMerma: k.tasaMerma,
      tasaValorizacion: k.tasaValorizacion,
      eficienciaTiempo: k.eficienciaTiempo,
      numRechazados: k.numRechazados,
      porLinea: porLinea(f).map(function (x) {
        return { lineaId: x.lineaId, nombre: x.nombre, gavetas: x.gavetasRecibidas,
                 kgProcesados: x.kgProcesados, kgExportable: x.kgExportable,
                 cajas: x.cajasExportables, kgMerma: x.kgMerma };
      }),
      porProveedor: porProveedor(f).map(function (x) {
        return { proveedorId: x.proveedorId, nombre: x.nombre, lotes: x.lotes,
                 gavetas: x.gavetasRecibidas, kg: x.kgRecibidos, valor: x.valor,
                 rechazados: x.rechazados, tasaDiferencia: x.tasaDiferencia };
      }),
      porCausa: porCausaRaiz(f).map(function (x) {
        return { causaId: x.causaId, codigo: x.codigo, kg: x.kg, valorPerdido: x.valorPerdido };
      }),
      porDestino: porDestino(f).map(function (x) {
        return { destinoId: x.destinoId, nombre: x.nombre, kg: x.kg, valor: x.valor };
      }),
      /* Cuántos documentos sueltos representa este resumen. */
      documentosArchivados: datos.lotes.length + datos.producciones.length
    };
  }

  /* Meses cerrados y archivables: todo lote de ese mes tiene que estar
     Cerrado o Rechazado. Archivar un mes con trabajo a medias perdería el
     lote que todavía hay que terminar. */
  function mesesArchivables(antesDe) {
    const corte = antesDe || DB.hoy().slice(0, 7);
    const meses = {};
    DB.all("lotes").forEach(function (l) {
      const mes = (l.fechaRecepcion || l.fecha).slice(0, 7);
      if (mes >= corte) return;
      if (!meses[mes]) meses[mes] = { mes: mes, lotes: 0, abiertos: 0 };
      meses[mes].lotes += 1;
      if (l.estado !== "Cerrado" && l.estado !== "Rechazado") meses[mes].abiertos += 1;
    });
    return Object.keys(meses).sort().map(function (m) {
      const x = meses[m];
      x.archivable = x.abiertos === 0;
      return x;
    });
  }

  /* ====================================== liquidación al proveedor

     El documento con el que se le paga. Cierra el ciclo: el proveedor
     anuncia, la planta pesa, y esto es lo que resulta de ese pesaje.

     Se liquida sobre el KILO de báscula, no sobre lo declarado ni sobre
     bultos: es el único dato que las dos partes vieron. Un lote rechazado
     aparece igual, con importe cero y su motivo, porque no decirlo es lo
     que genera la llamada.
     ==================================================================== */

  function liquidacion(proveedorId, filtros) {
    const prov = DB.get("proveedores", proveedorId);
    if (!prov) return null;
    const f = filtros || {};
    const desde = f.desde || "0000-01-01";
    const hasta = f.hasta || "9999-12-31";

    const lotes = DB.all("lotes").filter(function (l) {
      const fecha = l.fechaRecepcion || l.fecha;
      return l.proveedorId === proveedorId && fecha >= desde && fecha <= hasta &&
        (l.gavetasRecibidas !== null || l.estado === "Rechazado");
    }).sort(function (a, b) {
      return (a.fechaRecepcion || a.fecha) < (b.fechaRecepcion || b.fecha) ? -1 : 1;
    });

    const detalle = lotes.map(function (l) {
      const rechazado = l.estado === "Rechazado";
      const kg = rechazado ? 0 : (Number(l.kgRecibidos) || 0);
      const precio = Number(l.precioKg) || 0;
      const difKg = l.kgAnunciados ? kg - l.kgAnunciados : null;
      return {
        loteId: l.id,
        fecha: l.fechaRecepcion || l.fecha,
        codigoLote: l.codigoLote,
        linea: nombreLinea(l.lineaId),
        calidad: l.calidadVerificada || l.calidadDeclarada,
        gavetas: rechazado ? 0 : (Number(l.gavetasRecibidas) || 0),
        kg: kg,
        precioKg: precio,
        importe: kg * precio,
        rechazado: rechazado,
        motivo: rechazado ? (l.observacionesRecepcion || "Sin motivo anotado.") : "",
        /* Un lote pesado ya se paga, aunque todavía no se haya cerrado: lo
           que se liquida es lo que entró, no lo que salió. Se marca para
           que el proveedor sepa que aún está en planta. */
        enProceso: !rechazado && l.estado !== "Cerrado",
        diferenciaKg: rechazado ? null : difKg,
        kgAnunciados: Number(l.kgAnunciados) || 0
      };
    });

    const pagables = detalle.filter(function (d) { return !d.rechazado; });
    const kg = pagables.reduce(function (a, d) { return a + d.kg; }, 0);
    const importe = pagables.reduce(function (a, d) { return a + d.importe; }, 0);
    const kgAnunciados = pagables.reduce(function (a, d) { return a + d.kgAnunciados; }, 0);

    return {
      proveedor: prov,
      /* Folio estable: el mismo período y el mismo proveedor dan el mismo
         número, así que reimprimir no genera un documento distinto. */
      folio: "LIQ-" + String(desde).replace(/-/g, "").slice(2) + "-" +
        String(prov.codigo || prov.id).toUpperCase(),
      desde: desde,
      hasta: hasta,
      detalle: detalle,
      lotes: detalle.length,
      lotesPagables: pagables.length,
      lotesRechazados: detalle.length - pagables.length,
      gavetas: pagables.reduce(function (a, d) { return a + d.gavetas; }, 0),
      kg: kg,
      kgAnunciados: kgAnunciados,
      diferenciaKg: kg - kgAnunciados,
      tasaDiferencia: kgAnunciados > 0 ? (kg - kgAnunciados) / kgAnunciados : 0,
      precioPromedio: kg > 0 ? importe / kg : 0,
      importe: importe,
      enProceso: pagables.filter(function (d) { return d.enProceso; }).length
    };
  }

  /* Todas las liquidaciones del período, para la vista de Supervisión. */
  function liquidaciones(filtros) {
    return DB.all("proveedores")
      .map(function (p) { return liquidacion(p.id, filtros); })
      .filter(function (x) { return x && x.lotes > 0; })
      .sort(function (a, b) { return b.importe - a.importe; });
  }

  /* ---------------------------------------------------- ficha del lote */

  function fichaLote(loteId) {
    const lote = DB.get("lotes", loteId);
    if (!lote) return null;
    const prod = DB.all("producciones").find(function (p) { return p.loteId === loteId; }) || null;
    const linea = DB.linea(lote.lineaId);

    const dif = lote.gavetasRecibidas === null ? null : lote.gavetasRecibidas - lote.gavetasAnunciadas;
    const difKg = lote.kgRecibidos === null ? null : lote.kgRecibidos - (lote.kgAnunciados || 0);
    const kgMerma = prod ? totalMerma(prod) : 0;

    return {
      lote: lote,
      produccion: prod,
      linea: linea,
      proveedor: DB.get("proveedores", lote.proveedorId),
      diferenciaGavetas: dif,
      tasaDiferencia: dif === null || !lote.gavetasAnunciadas ? null : dif / lote.gavetasAnunciadas,
      diferenciaKg: difKg,
      tasaDiferenciaKg: difKg === null || !lote.kgAnunciados ? null : difKg / lote.kgAnunciados,
      pesoGavetaReal: lote.gavetasRecibidas ? lote.kgRecibidos / lote.gavetasRecibidas : null,
      valor: (lote.kgRecibidos || 0) * (lote.precioKg || 0),
      kgMerma: kgMerma,
      kgValorizado: prod ? mermaValorizada(prod) : 0,
      tasaValorizacion: prod && kgMerma > 0 ? mermaValorizada(prod) / kgMerma : null,
      valorDescarte: prod ? valorRecuperado(prod) : 0,
      tasaExportable: prod && prod.gavetasProcesadas > 0
        ? prod.cajasExportables / prod.gavetasProcesadas : null,
      meta: linea ? linea.metaRendimiento : null,
      tiempoEstandarMin: prod ? tiempoEstandar(prod) : 0,
      eficiencia: prod && prod.tiempoRealMin > 0
        ? tiempoEstandar(prod) / (prod.tiempoRealMin * (Number(prod.operarios) || 1)) : null,
      mermas: prod ? (prod.mermas || []).slice().sort(function (a, b) { return b.kg - a.kg; }) : []
    };
  }

  /* ================================================================= costeo
     Cuánto cuesta cada causa raíz, en dinero. Es el puente entre el
     diagnóstico (kg perdidos por CR) y la decisión de inversión: mientras la
     pérdida se mide en kilos nadie la prioriza; medida en dólares al año, sí.

     El costo de una pérdida tiene tres partes, y las tres se suman:
       · la fruta        — lo que valía esa fruta puesta como exportación
       · la recuperación — lo que el destino devuelve (en relleno es NEGATIVA:
                           se paga por botar, de ahí el valorKg -0.02)
       · la transformación — las horas-hombre ya invertidas en fruta que al
                           final no se exportó; el estudio de tiempos las da
                           por caja, así que se prorratean por kilo.
     ==================================================================== */

  /* Días sobre los que se proyecta. Se toma el tramo que realmente tiene
     registros, no el rango del filtro: con un filtro muy ancho —o abierto—
     el rango diría "cien años" y la proyección anual saldría en nada. Si el
     filtro es más estrecho que los datos, manda el filtro. */
  function diasDelPeriodo(filtros, datos) {
    const f = filtros || {};
    let dias = null;
    if (f.desde && f.hasta) {
      const d = Math.round((new Date(f.hasta) - new Date(f.desde)) / 86400000) + 1;
      if (d > 0) dias = d;
    }
    const fechas = datos.producciones.map(function (p) { return p.fecha; })
      .concat(datos.lotes.map(function (l) { return l.fecha; }))
      .filter(Boolean).sort();
    if (fechas.length) {
      const d = Math.round(
        (new Date(fechas[fechas.length - 1]) - new Date(fechas[0])) / 86400000) + 1;
      if (d > 0) dias = dias === null ? d : Math.min(dias, d);
    }
    return dias === null || dias < 1 ? 1 : dias;
  }

  function costeo(filtros) {
    const p = DB.parametros();
    const datos = filtrar(filtros);
    const prod = datos.producciones;
    const dias = diasDelPeriodo(filtros, datos);
    const factorAnual = 365 / dias;

    const mapa = {};
    DB.all("causas").forEach(function (c) {
      mapa[c.id] = {
        causaId: c.id, codigo: c.codigo, nombre: c.nombre,
        etiqueta: c.codigo + " · " + c.nombre,
        origen: c.origen, definida: c.definida, principal: c.principal,
        descripcion: c.descripcion || "",
        kg: 0, kgSinValorizar: 0, gavetasEquivalentes: 0,
        valorFruta: 0, valorRecuperado: 0, costoTransformacion: 0
      };
    });

    prod.forEach(function (pr) {
      const l = DB.linea(pr.lineaId);
      const peso = l && l.pesoGavetaKg ? l.pesoGavetaKg : DB.PESO_GAVETA_KG;
      const valorKg = l ? (Number(l.valorKgProductor) || 0) : 0;
      /* Minutos-persona por kilo, del estudio de tiempos. */
      const minutosPorKg = l
        ? DB.contenidoGavetaMin(l, DB.all("actividades")) / peso : 0;

      (pr.mermas || []).forEach(function (m) {
        const f = mapa[m.causaId];
        if (!f) return;
        const kg = Number(m.kg) || 0;
        const d = DB.destino(m.destinoId);
        f.kg += kg;
        f.gavetasEquivalentes += kg / peso;
        f.valorFruta += kg * valorKg;
        f.valorRecuperado += kg * (d ? (Number(d.valorKg) || 0) : 0);
        f.costoTransformacion += (kg * minutosPorKg / 60) * p.costoHoraHombre;
        if (!d || !d.valoriza) f.kgSinValorizar += kg;
      });
    });

    const lista = Object.keys(mapa).map(function (k) { return mapa[k]; })
      .filter(function (x) { return x.kg > 0; });

    lista.forEach(function (x) {
      x.costoTotal = x.valorFruta - x.valorRecuperado + x.costoTransformacion;
      x.costoPorKg = x.kg > 0 ? x.costoTotal / x.kg : 0;
      x.costoDiario = x.costoTotal / dias;
      x.costoAnual = x.costoTotal * factorAnual;
      x.kgAnual = x.kg * factorAnual;
    });
    lista.sort(function (a, b) { return b.costoTotal - a.costoTotal; });

    const total = lista.reduce(function (a, x) { return a + x.costoTotal; }, 0);
    let acumulado = 0;
    lista.forEach(function (x) {
      x.porcentaje = total > 0 ? x.costoTotal / total : 0;
      acumulado += x.porcentaje;
      x.acumulado = acumulado;
      /* Pareto: las primeras causas hasta cubrir el 80% son las "vitales". */
      x.vital = x.acumulado - x.porcentaje < 0.8;
    });

    function sumar(campo) {
      return lista.reduce(function (a, x) { return a + x[campo]; }, 0);
    }

    return {
      lista: lista,
      dias: dias,
      factorAnual: factorAnual,
      costoHoraHombre: p.costoHoraHombre,
      kg: sumar("kg"),
      kgSinValorizar: sumar("kgSinValorizar"),
      gavetasEquivalentes: sumar("gavetasEquivalentes"),
      valorFruta: sumar("valorFruta"),
      valorRecuperado: sumar("valorRecuperado"),
      costoTransformacion: sumar("costoTransformacion"),
      costoTotal: total,
      costoDiario: total / dias,
      costoMensual: total * factorAnual / 12,
      costoAnual: total * factorAnual,
      /* Cuántas causas concentran el 80% del dinero perdido. */
      vitales: lista.filter(function (x) { return x.vital; }).length,
      sinClasificar: lista.filter(function (x) { return !x.definida; })
        .reduce(function (a, x) { return a + x.costoTotal; }, 0)
    };
  }

  /* ============================================================ simulador
     Escenario "con mejora": se decide cuánto se cree que baja cada causa y
     cuánto costaría lograrlo. Devuelve ahorro anual, recuperación de la
     inversión (payback) y el valor actual neto a tres años, para que la
     propuesta de la tesis se defienda con números y no con intenciones.

     Las reducciones son SUPUESTOS (origen S): el sistema las deja editar y
     las muestra como tales, nunca como dato medido.
     ==================================================================== */

  const TASA_DESCUENTO = 0.12;          // costo de oportunidad anual, supuesto
  const ANIOS_VAN = 3;

  /* Las ocho causas raíz de la matriz KPI de la base maestra, con su
     indicador actual, su meta y la pérdida ya calculada allí. No son
     invención de la app: vienen del diagnóstico, y por eso cada una dice
     sobre qué base se calculó. La nº 5 no se monetiza —capacidad ociosa es
     pérdida indirecta— y se deja a propósito en cero: inflarla sería el
     tipo de número que hace desconfiar de todo lo demás. */
  const MEDIDAS = [
    { id: "kpi_1", n: 1, causaId: "CR6", linea: "Pitahaya",
      nombre: "Estandarizar la composición de los equipos",
      indicador: "Sobre-tiempo-persona frente a la mejor mesa",
      actual: 0.4336, meta: 0.10, reduccion: 0.7694,
      perdidaAnual: 9279.36, proyectada: 2139.86, inversion: 600, recurrenteAnual: 0,
      detalle: "Grupos con roles fijos según el mejor tiempo-persona medido (mesa 1).",
      base: "Sobre-tiempo-persona × gavetas/año × costo hora. Depende de confirmar mesas 2 y 3." },
    { id: "kpi_2", n: 2, causaId: "CR7", linea: "Tomate",
      nombre: "Eliminar el lavado y secado del tomate",
      indicador: "% del contenido de trabajo dedicado a limpieza y secado",
      actual: 0.5176, meta: 0, reduccion: 1,
      perdidaAnual: 24565.32, proyectada: 0, inversion: 0, recurrenteAnual: 0,
      detalle: "ECRS — Eliminar: exigir fruta limpia al proveedor en el acuerdo comercial.",
      base: "Min-persona de limpieza + secado por gaveta × gavetas/año × costo hora." },
    { id: "kpi_3", n: 3, causaId: "CR6", linea: "Granadilla",
      nombre: "Controlar el calibre de la granadilla en finca",
      indicador: "% retirado en recepción",
      actual: 0.0345, meta: 0.015, reduccion: 0.5657,
      perdidaAnual: 5988.70, proyectada: 2600.64, inversion: 900, recurrenteAnual: 600,
      detalle: "Muestreo de peso en finca, precio diferenciado por calibre y segunda " +
        "calidad en vez de rechazo.",
      base: "Pérdida neta del retiro en recepción (balance de masa), anualizada." },
    { id: "kpi_4", n: 4, causaId: "CR7", linea: "Pitahaya",
      nombre: "Rediseñar las mesas de sopleteado",
      indicador: "% de daño en mesas anchas",
      actual: 0.05, meta: 0.02, reduccion: 0.60,
      perdidaAnual: 12960, proyectada: 5184, inversion: 4500, recurrenteAnual: 0,
      detalle: "Ancho reducido según SLP y Guerchet, para acortar el alcance.",
      base: "Daño extra frente a la mesa 1 × kg/año × (precio − precio local). Hipótesis a verificar." },
    { id: "kpi_5", n: 5, causaId: "CR8", linea: "Pitahaya",
      nombre: "Usar las estaciones de sopleteado ociosas",
      indicador: "% de capacidad instalada sin usar",
      actual: 0.40, meta: 0.20, reduccion: 0,
      perdidaAnual: 0, proyectada: 0, inversion: 300, recurrenteAnual: 0,
      detalle: "Redistribuir personal según la demanda del día (planeación agregada).",
      base: "Capacidad ociosa: pérdida indirecta, no se monetiza." },
    { id: "kpi_6", n: 6, causaId: "CR5", linea: "Pitahaya",
      nombre: "Bajar la merma de pitahaya al 2%",
      indicador: "% merma real sobre kg recibidos",
      actual: 0.0406, meta: 0.02, reduccion: 0.5069,
      perdidaAnual: 40440.82, proyectada: 19940.52, inversion: 1800, recurrenteAnual: 900,
      detalle: "Clasificación de proveedores A–D, segregación en origen y destino circular.",
      base: "Balance de masa de la línea; meta 2% = mejor caso reportado en Ecuador." },
    { id: "kpi_7", n: 7, causaId: "CR5", linea: "Tomate",
      nombre: "Bajar la merma de tomate al 2%",
      indicador: "% merma real sobre kg recibidos",
      actual: 0.0538, meta: 0.02, reduccion: 0.6284,
      perdidaAnual: 24938.74, proyectada: 9266.92, inversion: 1200, recurrenteAnual: 600,
      detalle: "Clasificación de proveedores A–D, segregación en origen y destino circular.",
      base: "Balance de masa de la línea; meta 2% = mejor caso reportado en Ecuador." },
    { id: "kpi_8", n: 8, causaId: "CR5", linea: "Granadilla",
      nombre: "Bajar la merma de granadilla al 2%",
      indicador: "% merma real sobre kg recibidos",
      actual: 0.023, meta: 0.02, reduccion: 0.1388,
      perdidaAnual: 11812.28, proyectada: 10172.47, inversion: 800, recurrenteAnual: 400,
      detalle: "Clasificación de proveedores A–D, segregación en origen y destino circular.",
      base: "Balance de masa de la línea; meta 2% = mejor caso reportado en Ecuador." }
  ];

  /* Compatibilidad con el simulador por causa raíz: cada medida se expresa
     como una reducción sobre la causa a la que apunta. */
  const ESCENARIOS = MEDIDAS.map(function (m) {
    return {
      id: m.id, nombre: m.nombre, causas: [m.causaId],
      reduccion: m.reduccion, valorizacion: m.causaId === "CR5" ? 0.4 : 0,
      inversion: m.inversion, recurrenteAnual: m.recurrenteAnual,
      detalle: m.detalle
    };
  });

  /* Lo que la matriz KPI dice que se pierde y se puede recuperar al año,
     sin pasar por la simulación: es la cifra del diagnóstico. */
  function matrizKPI() {
    const total = MEDIDAS.reduce(function (a, m) { return a + m.perdidaAnual; }, 0);
    const proyectada = MEDIDAS.reduce(function (a, m) { return a + m.proyectada; }, 0);
    const inversion = MEDIDAS.reduce(function (a, m) { return a + m.inversion; }, 0);
    return {
      medidas: MEDIDAS.map(function (m) {
        const copia = {};
        Object.keys(m).forEach(function (k) { copia[k] = m[k]; });
        copia.ahorro = m.perdidaAnual - m.proyectada;
        copia.participacion = total > 0 ? m.perdidaAnual / total : 0;
        return copia;
      }),
      perdidaAnual: total,
      proyectadaAnual: proyectada,
      ahorroAnual: total - proyectada,
      inversion: inversion,
      paybackMeses: total - proyectada > 0 ? (inversion / (total - proyectada)) * 12 : null
    };
  }

  function acotar(x) { return Math.max(0, Math.min(1, Number(x) || 0)); }

  /* esc = {
       filtros, reducciones:{CRx:0..1}, inversion, recurrenteAnual,
       valorizacion: 0..1 (cuánto del residuo que hoy va a relleno se
       valoriza), valorKgObjetivo: $/kg del destino al que se movería
     } */
  function simular(esc) {
    const e = esc || {};
    const base = costeo(e.filtros);
    const red = e.reducciones || {};
    const destinoObjetivo = DB.destino(e.destinoObjetivoId) ||
      DB.all("destinos").filter(function (d) { return d.valoriza; })
        .sort(function (a, b) { return b.valorKg - a.valorKg; })[1] || null;
    const relleno = DB.all("destinos").find(function (d) { return !d.valoriza; });
    const valorObjetivo = e.valorKgObjetivo !== undefined
      ? Number(e.valorKgObjetivo) || 0
      : (destinoObjetivo ? destinoObjetivo.valorKg : 0);
    const valorRelleno = relleno ? Number(relleno.valorKg) || 0 : 0;

    const detalle = base.lista.map(function (c) {
      const r = acotar(red[c.causaId]);
      return {
        causaId: c.causaId, codigo: c.codigo, nombre: c.nombre,
        etiqueta: c.etiqueta, principal: c.principal, definida: c.definida,
        reduccion: r,
        kgAnual: c.kgAnual,
        kgEvitadosAnual: c.kgAnual * r,
        costoAnual: c.costoAnual,
        costoAnualConMejora: c.costoAnual * (1 - r),
        ahorroAnual: c.costoAnual * r
      };
    });

    const ahorroCausas = detalle.reduce(function (a, x) { return a + x.ahorroAnual; }, 0);
    const kgEvitados = detalle.reduce(function (a, x) { return a + x.kgEvitadosAnual; }, 0);

    /* Lo que aun así se descarta y hoy termina en relleno: valorizarlo no
       evita la pérdida, pero recupera parte y deja de pagar disposición.

       Lo evitado no se resta en bruto: las reducciones actúan sobre TODA la
       merma, no solo sobre la que va al relleno. Se aplica la reducción
       media ponderada por kilo, que es la fracción del descarte que deja de
       existir; restar los kilos evitados sin más dejaba el relleno en cero y
       la valorización en cero con él. */
    const kgTotalAnual = base.lista.reduce(function (a, x) { return a + x.kgAnual; }, 0);
    const reduccionMedia = kgTotalAnual > 0 ? kgEvitados / kgTotalAnual : 0;
    const kgRellenoAnual = base.kgSinValorizar * base.factorAnual;
    const kgRellenoRestante = kgRellenoAnual * (1 - reduccionMedia);
    const fraccion = acotar(e.valorizacion);
    const kgValorizados = kgRellenoRestante * fraccion;
    const ahorroValorizacion = kgValorizados * (valorObjetivo - valorRelleno);

    const inversion = Math.max(0, Number(e.inversion) || 0);
    const recurrente = Math.max(0, Number(e.recurrenteAnual) || 0);
    const ahorroBruto = ahorroCausas + ahorroValorizacion;
    const ahorroNeto = ahorroBruto - recurrente;

    /* Payback simple sobre el flujo neto. Sin ahorro neto no hay retorno:
       se devuelve null y la pantalla lo dice, en vez de un número absurdo. */
    const paybackMeses = ahorroNeto > 0 && inversion > 0
      ? (inversion / ahorroNeto) * 12 : (inversion === 0 ? 0 : null);

    let van = -inversion;
    for (let t = 1; t <= ANIOS_VAN; t += 1) {
      van += ahorroNeto / Math.pow(1 + TASA_DESCUENTO, t);
    }

    /* Cómo quedarían los indicadores del periodo con la mejora aplicada. */
    const ind = calcular(e.filtros);
    /* Kilos que vuelven a ser exportables en el período, y su equivalente
       en cajas al peso real de la caja de cada línea. */
    const kgRecuperados = kgEvitados / base.factorAnual;
    const kgMermaConMejora = Math.max(0, ind.kgMerma - kgEvitados / base.factorAnual);
    const kgValorizadoConMejora = Math.min(
      kgMermaConMejora,
      ind.kgValorizado + kgValorizados / base.factorAnual
    );

    return {
      base: base,
      detalle: detalle,
      inversion: inversion,
      recurrenteAnual: recurrente,
      ahorroCausas: ahorroCausas,
      ahorroValorizacion: ahorroValorizacion,
      ahorroBruto: ahorroBruto,
      ahorroNeto: ahorroNeto,
      ahorroMensual: ahorroNeto / 12,
      kgEvitadosAnual: kgEvitados,
      kgValorizadosAnual: kgValorizados,
      valorKgObjetivo: valorObjetivo,
      destinoObjetivo: destinoObjetivo ? destinoObjetivo.nombre : "—",
      paybackMeses: paybackMeses,
      paybackAnios: paybackMeses === null ? null : paybackMeses / 12,
      van: van,
      tasaDescuento: TASA_DESCUENTO,
      aniosVan: ANIOS_VAN,
      /* Beneficio/costo: dólares ahorrados en el horizonte por dólar puesto. */
      beneficioCosto: inversion > 0 ? (ahorroNeto * ANIOS_VAN) / inversion : null,
      viable: ahorroNeto > 0 && van > 0,
      costoAnualActual: base.costoAnual,
      costoAnualConMejora: Math.max(0, base.costoAnual - ahorroBruto) + recurrente,
      indicadores: {
        tasaMerma: ind.tasaMerma,
        tasaMermaConMejora: ind.kgProcesados > 0 ? kgMermaConMejora / ind.kgProcesados : 0,
        tasaExportable: ind.tasaExportable,
        tasaExportableConMejora: ind.kgProcesados > 0
          ? Math.min(1, (ind.kgExportable + kgRecuperados) / ind.kgProcesados)
          : 0,
        metaRendimiento: ind.metaRendimiento,
        tasaValorizacion: ind.tasaValorizacion,
        tasaValorizacionConMejora: kgMermaConMejora > 0
          ? kgValorizadoConMejora / kgMermaConMejora : 0,
        kgRecuperados: kgRecuperados
      }
    };
  }

  /* Escenario armado a partir de las medidas elegidas del diagnóstico. */
  function escenarioDeMedidas(ids, filtros) {
    const elegidas = ESCENARIOS.filter(function (m) { return ids.indexOf(m.id) !== -1; });
    const reducciones = {};
    let inversion = 0, recurrente = 0, valorizacion = 0;
    elegidas.forEach(function (m) {
      m.causas.forEach(function (c) {
        /* Dos medidas sobre la misma causa no suman linealmente: se combinan
           como reducciones sucesivas, que es lo que de verdad pasa. */
        const previa = reducciones[c] || 0;
        reducciones[c] = previa + m.reduccion * (1 - previa);
      });
      inversion += m.inversion;
      recurrente += m.recurrenteAnual;
      valorizacion = valorizacion + (m.valorizacion || 0) * (1 - valorizacion);
    });
    return {
      filtros: filtros, reducciones: reducciones, inversion: inversion,
      recurrenteAnual: recurrente, valorizacion: valorizacion,
      medidas: elegidas.map(function (m) { return m.id; })
    };
  }

  return {
    filtrar: filtrar,
    coincideTexto: coincideTexto,
    calcular: calcular,
    porProveedor: porProveedor,
    porLinea: porLinea,
    porCausaRaiz: porCausaRaiz,
    porDestino: porDestino,
    porEtapa: porEtapa,
    balanceMasa: balanceMasa,
    porCalidad: porCalidad,
    serie: serie,
    planificar: planificar,
    estudioTiempos: estudioTiempos,
    estudioTodas: estudioTodas,
    costeo: costeo,
    simular: simular,
    escenarioDeMedidas: escenarioDeMedidas,
    ESCENARIOS: ESCENARIOS,
    MEDIDAS: MEDIDAS,
    matrizKPI: matrizKPI,
    fichaLote: fichaLote,
    liquidacion: liquidacion,
    resumenMensual: resumenMensual,
    mesesArchivables: mesesArchivables,
    liquidaciones: liquidaciones,
    totalMerma: totalMerma,
    mermaValorizada: mermaValorizada,
    valorRecuperado: valorRecuperado,
    tiempoEstandar: tiempoEstandar,
    editable: editable,
    nombreLinea: nombreLinea,
    nombreProveedor: nombreProveedor,
    nombreUsuario: nombreUsuario,
    nombreCausa: nombreCausa,
    nombreDestino: nombreDestino,
    colorLinea: colorLinea
  };
})();
