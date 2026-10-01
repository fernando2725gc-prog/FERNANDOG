/* =========================================================================
   indicadores.js — Motor de cálculo del Sistema FLP
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
    return l ? (Number(prod.cajasProcesadas) || 0) * l.tiempoEstandarMin : 0;
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
      return l.cajasRecibidas !== null && l.estado !== "Rechazado";
    });

    const cajasAnunciadas = suma(lotes, "cajasAnunciadas");
    const cajasAnunPesadas = suma(pesados, "cajasAnunciadas");
    const cajasRecibidas = suma(pesados, "cajasRecibidas");
    const kgRecibidos = suma(pesados, "kgRecibidos");
    const kgAnunPesados = suma(pesados, "kgAnunciados");

    const cajasProcesadas = suma(prod, "cajasProcesadas");
    const kgProcesados = suma(prod, "kgProcesados");
    const cajasExportables = suma(prod, "cajasExportables");
    const kgExportable = suma(prod, "kgExportable");

    const kgMerma = prod.reduce(function (a, p) { return a + totalMerma(p); }, 0);
    const kgValorizado = prod.reduce(function (a, p) { return a + mermaValorizada(p); }, 0);
    const valorDescarte = prod.reduce(function (a, p) { return a + valorRecuperado(p); }, 0);

    const minutosReales = suma(prod, "tiempoRealMin");
    const minutosEstandar = prod.reduce(function (a, p) { return a + tiempoEstandar(p); }, 0);
    const horasHombre = prod.reduce(function (a, p) {
      return a + ((Number(p.tiempoRealMin) || 0) * (Number(p.operarios) || 0)) / 60;
    }, 0);

    const valorCompra = pesados.reduce(function (a, l) {
      return a + (Number(l.cajasRecibidas) || 0) * (Number(l.precioCaja) || 0);
    }, 0);

    /* Meta ponderada por la mezcla realmente procesada: si el periodo tuvo
       mucha granadilla (meta mas baja), la meta del periodo debe bajar. */
    let metaPonderada = 0;
    if (cajasProcesadas > 0) {
      const acc = prod.reduce(function (a, p) {
        const l = DB.linea(p.lineaId);
        return a + (l ? l.metaExportable : 0.8) * (Number(p.cajasProcesadas) || 0);
      }, 0);
      metaPonderada = acc / cajasProcesadas;
    }

    const tasaExportable = cajasProcesadas > 0 ? cajasExportables / cajasProcesadas : 0;
    const diferenciaCajas = cajasRecibidas - cajasAnunPesadas;

    const cerrados = lotes.filter(function (l) { return l.estado === "Cerrado" && l.fechaCierre; });
    const cicloTotal = cerrados.reduce(function (a, l) {
      return a + Math.round((new Date(l.fechaCierre) - new Date(l.fecha)) / 86400000);
    }, 0);

    const porEstado = {};
    DB.ESTADOS.forEach(function (e) {
      porEstado[e.id] = lotes.filter(function (l) { return l.estado === e.id; }).length;
    });

    const rechazados = lotes.filter(function (l) { return l.estado === "Rechazado"; });
    const cajasPerdidas = cajasProcesadas - cajasExportables;

    return {
      /* --- volumen --- */
      cajasAnunciadas: cajasAnunciadas,
      cajasRecibidas: cajasRecibidas,
      kgRecibidos: kgRecibidos,
      diferenciaCajas: diferenciaCajas,
      tasaDiferenciaCajas: cajasAnunPesadas > 0 ? diferenciaCajas / cajasAnunPesadas : 0,
      /* Dos diferencias distintas: pueden llegar todas las cajas y aun asi
         pesar menos, si vienen incompletas. */
      kgAnunciados: kgAnunPesados,
      diferenciaKg: kgRecibidos - kgAnunPesados,
      tasaDiferenciaKg: kgAnunPesados > 0 ? (kgRecibidos - kgAnunPesados) / kgAnunPesados : 0,
      cajasProcesadas: cajasProcesadas,
      kgProcesados: kgProcesados,
      cajasExportables: cajasExportables,
      kgExportable: kgExportable,
      cajasPerdidas: cajasPerdidas,

      /* --- perdidas --- */
      tasaExportable: tasaExportable,
      metaExportable: metaPonderada,
      cumplimientoMeta: metaPonderada > 0 ? tasaExportable / metaPonderada : 0,
      kgMerma: kgMerma,
      tasaMerma: kgProcesados > 0 ? kgMerma / kgProcesados : 0,

      /* --- economia circular --- */
      kgValorizado: kgValorizado,
      tasaValorizacion: kgMerma > 0 ? kgValorizado / kgMerma : 0,
      kgRelleno: kgMerma - kgValorizado,
      valorDescarte: valorDescarte,

      /* --- proceso --- */
      minutosReales: minutosReales,
      minutosEstandar: minutosEstandar,
      eficienciaTiempo: minutosReales > 0 ? minutosEstandar / minutosReales : 0,
      horasHombre: horasHombre,
      productividad: horasHombre > 0 ? cajasProcesadas / horasHombre : 0,
      minutosPorCaja: cajasProcesadas > 0 ? minutosReales / cajasProcesadas : 0,

      /* --- economico --- */
      valorCompra: valorCompra,
      costoPorCajaExportable: cajasExportables > 0 ? valorCompra / cajasExportables : 0,
      perdidaEconomica: cajasPerdidas * (cajasRecibidas > 0 ? valorCompra / cajasRecibidas : 0),

      /* --- flujo --- */
      numLotes: lotes.length,
      numProducciones: prod.length,
      porEstado: porEstado,
      numRechazados: rechazados.length,
      tasaRechazo: lotes.length > 0 ? rechazados.length / lotes.length : 0,
      cajasSinProcesar: Math.max(cajasRecibidas - cajasProcesadas, 0),
      tasaProcesamiento: cajasRecibidas > 0 ? cajasProcesadas / cajasRecibidas : 0,
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
          lotes: 0, rechazados: 0, cajasAnunciadas: 0, cajasAnunPesadas: 0,
          cajasRecibidas: 0, kgAnunPesados: 0, kgRecibidos: 0, valor: 0, calidadA: 0,
          cajasProcesadas: 0, cajasExportables: 0, kgMerma: 0
        };
      }
      const m = mapa[l.proveedorId];
      m.lotes += 1;
      m.cajasAnunciadas += Number(l.cajasAnunciadas) || 0;
      if (l.estado === "Rechazado") { m.rechazados += 1; return; }
      if (l.cajasRecibidas === null) return;
      m.cajasAnunPesadas += Number(l.cajasAnunciadas) || 0;
      m.cajasRecibidas += Number(l.cajasRecibidas) || 0;
      m.kgAnunPesados += Number(l.kgAnunciados) || 0;
      m.kgRecibidos += Number(l.kgRecibidos) || 0;
      m.valor += (Number(l.cajasRecibidas) || 0) * (Number(l.precioCaja) || 0);
      if (l.calidadVerificada === "A") m.calidadA += Number(l.cajasRecibidas) || 0;
    });

    datos.producciones.forEach(function (p) {
      const lote = datos.indice[p.loteId];
      if (!lote || !mapa[lote.proveedorId]) return;
      const m = mapa[lote.proveedorId];
      m.cajasProcesadas += Number(p.cajasProcesadas) || 0;
      m.cajasExportables += Number(p.cajasExportables) || 0;
      m.kgMerma += totalMerma(p);
    });

    return Object.keys(mapa).map(function (k) {
      const m = mapa[k];
      m.tasaExportable = m.cajasProcesadas > 0 ? m.cajasExportables / m.cajasProcesadas : 0;
      m.pctCalidadA = m.cajasRecibidas > 0 ? m.calidadA / m.cajasRecibidas : 0;
      m.precioPromedio = m.cajasRecibidas > 0 ? m.valor / m.cajasRecibidas : 0;
      m.diferenciaCajas = m.cajasRecibidas - m.cajasAnunPesadas;
      m.tasaDiferencia = m.cajasAnunPesadas > 0 ? m.diferenciaCajas / m.cajasAnunPesadas : 0;
      m.tasaDiferenciaKg = m.kgAnunPesados > 0
        ? (m.kgRecibidos - m.kgAnunPesados) / m.kgAnunPesados : 0;
      m.pesoCajaReal = m.cajasRecibidas > 0 ? m.kgRecibidos / m.cajasRecibidas : 0;
      m.tasaRechazo = m.lotes > 0 ? m.rechazados / m.lotes : 0;
      /* Indice de variabilidad: es la CR6 hecha numero. Combina lo que el
         proveedor falla al declarar, lo que le rechazan y lo que rinde. */
      m.indiceVariabilidad = Math.abs(m.tasaDiferencia) + m.tasaRechazo +
        Math.max(0, 0.8 - m.tasaExportable);
      return m;
    }).sort(function (a, b) { return b.cajasRecibidas - a.cajasRecibidas; });
  }

  function porLinea(filtros) {
    const datos = filtrar(filtros);
    const mapa = {};

    function bucket(id) {
      if (!mapa[id]) {
        const l = DB.linea(id);
        mapa[id] = {
          lineaId: id, nombre: nombreLinea(id), color: colorLinea(id),
          meta: l ? l.metaExportable : 0, tiempoEstandarMin: l ? l.tiempoEstandarMin : 0,
          cajasRecibidas: 0, cajasProcesadas: 0, cajasExportables: 0,
          kgMerma: 0, kgValorizado: 0, minutosReales: 0, minutosEstandar: 0
        };
      }
      return mapa[id];
    }

    datos.lotes.forEach(function (l) {
      bucket(l.lineaId).cajasRecibidas += Number(l.cajasRecibidas) || 0;
    });
    datos.producciones.forEach(function (p) {
      const b = bucket(p.lineaId);
      b.cajasProcesadas += Number(p.cajasProcesadas) || 0;
      b.cajasExportables += Number(p.cajasExportables) || 0;
      b.kgMerma += totalMerma(p);
      b.kgValorizado += mermaValorizada(p);
      b.minutosReales += Number(p.tiempoRealMin) || 0;
      b.minutosEstandar += tiempoEstandar(p);
    });

    return Object.keys(mapa).map(function (k) {
      const m = mapa[k];
      m.tasaExportable = m.cajasProcesadas > 0 ? m.cajasExportables / m.cajasProcesadas : 0;
      m.brecha = m.tasaExportable - m.meta;
      m.eficiencia = m.minutosReales > 0 ? m.minutosEstandar / m.minutosReales : 0;
      m.minutosPorCaja = m.cajasProcesadas > 0 ? m.minutosReales / m.cajasProcesadas : 0;
      m.tasaValorizacion = m.kgMerma > 0 ? m.kgValorizado / m.kgMerma : 0;
      return m;
    }).sort(function (a, b) { return b.cajasRecibidas - a.cajasRecibidas; });
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
      const valorKg = l && l.pesoCajaKg ? l.precioCaja / l.pesoCajaKg : 0;
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
          return a + (Number(l.cajasRecibidas) || Number(l.cajasAnunciadas) || 0);
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
      if (l.cajasRecibidas === null) return;
      bucket(l.fechaRecepcion || l.fecha).recibido += Number(l.cajasRecibidas) || 0;
    });
    datos.producciones.forEach(function (p) {
      const b = bucket(p.fecha);
      b.procesado += Number(p.cajasProcesadas) || 0;
      b.exportable += Number(p.cajasExportables) || 0;
    });

    return Object.keys(mapa).sort().map(function (k) {
      const m = mapa[k];
      m.tasaExportable = m.procesado > 0 ? m.exportable / m.procesado : 0;
      return m;
    });
  }

  /* ------------------------------------------------- planificación diaria */

  /* Dado un plan de produccion (cajas por linea) y los parametros de planta,
     calcula el takt time, la carga de cada linea y si el turno alcanza.
     Es el nucleo del modulo de planificacion diaria. */
  function planificar(plan) {
    const p = DB.parametros();
    const horas = Number(plan.horasTurno) || p.horasTurno;
    const operarios = Number(plan.operarios) || p.operariosDisponibles;
    const eficiencia = Number(plan.eficiencia) || p.eficienciaPlanta;

    /* Minutos productivos: el turno menos los suplementos de la OIT, y
       ajustado por la eficiencia observada de la planta. */
    const minutosTurno = horas * 60;
    const minutosNetosPorOperario = minutosTurno * (1 - p.suplementosOIT) * eficiencia;
    const capacidadTotalMin = minutosNetosPorOperario * operarios;

    const detalle = (plan.lineas || []).map(function (item) {
      const linea = DB.linea(item.lineaId);
      if (!linea) return null;
      const cajas = Number(item.cajas) || 0;
      const minutosRequeridos = cajas * linea.tiempoEstandarMin;
      const operariosNecesarios = minutosNetosPorOperario > 0
        ? minutosRequeridos / minutosNetosPorOperario : 0;

      return {
        lineaId: linea.id,
        nombre: linea.nombre,
        color: linea.color,
        cajas: cajas,
        tiempoEstandarMin: linea.tiempoEstandarMin,
        minutosRequeridos: minutosRequeridos,
        horasRequeridas: minutosRequeridos / 60,
        operariosNecesarios: operariosNecesarios,
        /* Takt time: cada cuantos minutos debe salir una caja para cumplir. */
        taktMin: cajas > 0 ? minutosTurno / cajas : 0,
        kg: cajas * linea.pesoCajaKg,
        valor: cajas * linea.precioCaja
      };
    }).filter(Boolean);

    const minutosRequeridos = detalle.reduce(function (a, d) { return a + d.minutosRequeridos; }, 0);
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
      disponible[l.lineaId] = (disponible[l.lineaId] || 0) + (Number(l.cajasRecibidas) || 0);
    });
    detalle.forEach(function (d) {
      d.disponible = disponible[d.lineaId] || 0;
      d.faltante = Math.max(0, d.cajas - d.disponible);
    });

    return {
      detalle: detalle,
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
      horasTurno: horas,
      minutosNetosPorOperario: minutosNetosPorOperario,
      taktPromedio: cajasTotales > 0 ? minutosTurno / cajasTotales : 0,
      costoManoObra: (operarios * horas) * p.costoHoraHombre,
      hayFaltantes: detalle.some(function (d) { return d.faltante > 0; })
    };
  }

  /* ---------------------------------------------------- ficha del lote */

  function fichaLote(loteId) {
    const lote = DB.get("lotes", loteId);
    if (!lote) return null;
    const prod = DB.all("producciones").find(function (p) { return p.loteId === loteId; }) || null;
    const linea = DB.linea(lote.lineaId);

    const dif = lote.cajasRecibidas === null ? null : lote.cajasRecibidas - lote.cajasAnunciadas;
    const difKg = lote.kgRecibidos === null ? null : lote.kgRecibidos - (lote.kgAnunciados || 0);
    const kgMerma = prod ? totalMerma(prod) : 0;

    return {
      lote: lote,
      produccion: prod,
      linea: linea,
      proveedor: DB.get("proveedores", lote.proveedorId),
      diferenciaCajas: dif,
      tasaDiferencia: dif === null || !lote.cajasAnunciadas ? null : dif / lote.cajasAnunciadas,
      diferenciaKg: difKg,
      tasaDiferenciaKg: difKg === null || !lote.kgAnunciados ? null : difKg / lote.kgAnunciados,
      pesoCajaReal: lote.cajasRecibidas ? lote.kgRecibidos / lote.cajasRecibidas : null,
      valor: (lote.cajasRecibidas || 0) * (lote.precioCaja || 0),
      kgMerma: kgMerma,
      kgValorizado: prod ? mermaValorizada(prod) : 0,
      tasaValorizacion: prod && kgMerma > 0 ? mermaValorizada(prod) / kgMerma : null,
      valorDescarte: prod ? valorRecuperado(prod) : 0,
      tasaExportable: prod && prod.cajasProcesadas > 0
        ? prod.cajasExportables / prod.cajasProcesadas : null,
      meta: linea ? linea.metaExportable : null,
      tiempoEstandarMin: prod ? tiempoEstandar(prod) : 0,
      eficiencia: prod && prod.tiempoRealMin > 0 ? tiempoEstandar(prod) / prod.tiempoRealMin : null,
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
        kg: 0, kgSinValorizar: 0, cajasEquivalentes: 0,
        valorFruta: 0, valorRecuperado: 0, costoTransformacion: 0
      };
    });

    prod.forEach(function (pr) {
      const l = DB.linea(pr.lineaId);
      const peso = l && l.pesoCajaKg ? l.pesoCajaKg : DB.PESO_CAJA_KG;
      const valorKg = l ? l.precioCaja / peso : 0;
      const minutosPorKg = l ? l.tiempoEstandarMin / peso : 0;

      (pr.mermas || []).forEach(function (m) {
        const f = mapa[m.causaId];
        if (!f) return;
        const kg = Number(m.kg) || 0;
        const d = DB.destino(m.destinoId);
        f.kg += kg;
        f.cajasEquivalentes += kg / peso;
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
      cajasEquivalentes: sumar("cajasEquivalentes"),
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

  /* Medidas del diagnóstico, con una estimación inicial editable. */
  const ESCENARIOS = [
    { id: "esc_segregacion", nombre: "Segregar la merma en la línea",
      causas: ["CR5"], reduccion: 0.35, valorizacion: 0.60, inversion: 1800,
      recurrenteAnual: 900,
      detalle: "Contenedores identificados por destino y un responsable por turno." },
    { id: "esc_proveedores", nombre: "Estandarizar la entrega del proveedor",
      causas: ["CR6"], reduccion: 0.30, valorizacion: 0.10, inversion: 1200,
      recurrenteAnual: 1400,
      detalle: "Ficha técnica, capacitación en campo y verificación de peso por caja." },
    { id: "esc_layout", nombre: "Reordenar el layout de planta",
      causas: ["CR7"], reduccion: 0.40, valorizacion: 0, inversion: 4500,
      recurrenteAnual: 0,
      detalle: "Recorrido en línea recta entre recepción, selección y empaque." },
    { id: "esc_sopleteado", nombre: "Balancear la estación de sopleteado",
      causas: ["CR8"], reduccion: 0.45, valorizacion: 0, inversion: 2600,
      recurrenteAnual: 300,
      detalle: "Reasignar operarios según el takt time y nivelar la carga." }
  ];

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
    const pesoCaja = DB.PESO_CAJA_KG;
    const cajasRecuperadas = (kgEvitados / base.factorAnual) / pesoCaja;
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
        tasaExportableConMejora: ind.cajasProcesadas > 0
          ? Math.min(1, (ind.cajasExportables + cajasRecuperadas) / ind.cajasProcesadas)
          : 0,
        metaExportable: ind.metaExportable,
        tasaValorizacion: ind.tasaValorizacion,
        tasaValorizacionConMejora: kgMermaConMejora > 0
          ? kgValorizadoConMejora / kgMermaConMejora : 0,
        cajasRecuperadas: cajasRecuperadas
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
    porCalidad: porCalidad,
    serie: serie,
    planificar: planificar,
    costeo: costeo,
    simular: simular,
    escenarioDeMedidas: escenarioDeMedidas,
    ESCENARIOS: ESCENARIOS,
    fichaLote: fichaLote,
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
