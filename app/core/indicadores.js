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

  function filtrar(filtros) {
    const f = filtros || {};
    const desde = f.desde || "0000-01-01";
    const hasta = f.hasta || "9999-12-31";

    const lotes = DB.all("lotes").filter(function (l) {
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

  return {
    filtrar: filtrar,
    calcular: calcular,
    porProveedor: porProveedor,
    porLinea: porLinea,
    porCausaRaiz: porCausaRaiz,
    porDestino: porDestino,
    porCalidad: porCalidad,
    serie: serie,
    planificar: planificar,
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
