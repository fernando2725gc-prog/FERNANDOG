/* =========================================================================
   indicadores.js — Motor de cálculo
   Toma los lotes y las producciones ya filtrados y devuelve los indicadores
   de gestión que sustentan los reportes.
   ========================================================================= */

const Indicadores = (function () {
  "use strict";

  function nombreFruta(id) {
    const f = DB.get("frutas", id);
    return f ? f.nombre : "—";
  }

  function nombreProveedor(id) {
    const p = DB.get("proveedores", id);
    return p ? p.nombre : "—";
  }

  function nombreProducto(id) {
    const p = DB.get("productos", id);
    return p ? p.nombre : "—";
  }

  function nombreUsuario(id) {
    const u = DB.get("usuarios", id);
    return u ? u.nombre : "—";
  }

  function totalMerma(prod) {
    return (prod.mermas || []).reduce(function (a, m) { return a + (Number(m.kg) || 0); }, 0);
  }

  /* Un lote cerrado ya no admite cambios de ningún rol. */
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
      if (f.frutaId && l.frutaId !== f.frutaId) return false;
      if (f.calidad && (l.calidadVerificada || l.calidadDeclarada) !== f.calidad) return false;
      if (f.estado && l.estado !== f.estado) return false;
      return true;
    });

    const indice = {};
    lotes.forEach(function (l) { indice[l.id] = l; });

    /* La producción se filtra por el lote que la originó: así el filtro de
       proveedor alcanza también a los datos de planta. */
    const producciones = DB.all("producciones").filter(function (p) {
      return !!indice[p.loteId];
    });

    return { lotes: lotes, producciones: producciones, indice: indice };
  }

  function suma(lista, campo) {
    return lista.reduce(function (acc, x) { return acc + (Number(x[campo]) || 0); }, 0);
  }

  /* --------------------------------------------------------------- KPIs */

  function calcular(filtros) {
    const datos = filtrar(filtros);
    const lotes = datos.lotes;
    const prod = datos.producciones;

    /* Solo los lotes efectivamente pesados entran en la comparación de peso:
       un lote aún en tránsito no tiene diferencia que medir. */
    const pesados = lotes.filter(function (l) {
      return l.cantidadRecibidaKg !== null && l.estado !== "Rechazado";
    });

    const kgAnunciado = suma(lotes, "cantidadAnunciadaKg");
    const kgAnunciadoPesado = suma(pesados, "cantidadAnunciadaKg");
    const kgRecibido = suma(pesados, "cantidadRecibidaKg");
    const kgProcesados = suma(prod, "kgProcesados");
    const kgExportable = suma(prod, "kgExportable");
    const kgMerma = prod.reduce(function (a, p) { return a + totalMerma(p); }, 0);
    const horas = suma(prod, "horasHombre");

    const valorCompra = pesados.reduce(function (acc, l) {
      return acc + (Number(l.cantidadRecibidaKg) || 0) * (Number(l.precioUnitario) || 0);
    }, 0);

    /* Meta ponderada: cada fruta tiene su propia tasa de exportable
       esperada, así que la meta del período depende de la mezcla procesada. */
    let metaPonderada = 0;
    if (kgProcesados > 0) {
      const acumulado = prod.reduce(function (acc, p) {
        const fruta = DB.get("frutas", p.frutaId);
        const meta = fruta ? fruta.metaExportable : 0.6;
        return acc + meta * (Number(p.kgProcesados) || 0);
      }, 0);
      metaPonderada = acumulado / kgProcesados;
    }

    const tasaExportable = kgProcesados > 0 ? kgExportable / kgProcesados : 0;
    const diferenciaPeso = kgRecibido - kgAnunciadoPesado;

    /* Tiempo de ciclo: del anuncio del proveedor al cierre del lote. */
    const cerrados = lotes.filter(function (l) { return l.estado === "Cerrado" && l.fechaCierre; });
    const cicloTotal = cerrados.reduce(function (a, l) {
      return a + Math.round((new Date(l.fechaCierre) - new Date(l.fecha)) / 86400000);
    }, 0);

    const porEstado = {};
    DB.ESTADOS.forEach(function (e) {
      porEstado[e.id] = lotes.filter(function (l) { return l.estado === e.id; }).length;
    });

    const rechazados = lotes.filter(function (l) { return l.estado === "Rechazado"; });

    return {
      kgAnunciado: kgAnunciado,
      kgRecibido: kgRecibido,
      diferenciaPeso: diferenciaPeso,
      tasaDiferenciaPeso: kgAnunciadoPesado > 0 ? diferenciaPeso / kgAnunciadoPesado : 0,
      exactitudPeso: kgAnunciadoPesado > 0 ? 1 - Math.abs(diferenciaPeso) / kgAnunciadoPesado : 0,

      kgProcesados: kgProcesados,
      kgExportable: kgExportable,
      kgMerma: kgMerma,
      tasaExportable: tasaExportable,
      metaExportable: metaPonderada,
      cumplimientoMeta: metaPonderada > 0 ? tasaExportable / metaPonderada : 0,
      tasaMerma: kgProcesados > 0 ? kgMerma / kgProcesados : 0,

      valorCompra: valorCompra,
      costoPorKgExportable: kgExportable > 0 ? valorCompra / kgExportable : 0,
      productividad: horas > 0 ? kgProcesados / horas : 0,
      horasHombre: horas,

      numLotes: lotes.length,
      numProducciones: prod.length,
      porEstado: porEstado,
      numRechazados: rechazados.length,
      tasaRechazo: lotes.length > 0 ? rechazados.length / lotes.length : 0,
      kgSinProcesar: Math.max(kgRecibido - kgProcesados, 0),
      tasaProcesamiento: kgRecibido > 0 ? kgProcesados / kgRecibido : 0,
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
          proveedorId: l.proveedorId,
          nombre: nombreProveedor(l.proveedorId),
          lotes: 0, rechazados: 0,
          kgAnunciado: 0, kgAnunciadoPesado: 0, kgRecibido: 0,
          valor: 0, calidadA: 0,
          kgProcesados: 0, kgExportable: 0, kgMerma: 0
        };
      }
      const m = mapa[l.proveedorId];
      m.lotes += 1;
      m.kgAnunciado += Number(l.cantidadAnunciadaKg) || 0;
      if (l.estado === "Rechazado") { m.rechazados += 1; return; }
      if (l.cantidadRecibidaKg === null) return;
      m.kgAnunciadoPesado += Number(l.cantidadAnunciadaKg) || 0;
      m.kgRecibido += Number(l.cantidadRecibidaKg) || 0;
      m.valor += (Number(l.cantidadRecibidaKg) || 0) * (Number(l.precioUnitario) || 0);
      if (l.calidadVerificada === "A") m.calidadA += Number(l.cantidadRecibidaKg) || 0;
    });

    datos.producciones.forEach(function (p) {
      const lote = datos.indice[p.loteId];
      if (!lote || !mapa[lote.proveedorId]) return;
      const m = mapa[lote.proveedorId];
      m.kgProcesados += Number(p.kgProcesados) || 0;
      m.kgExportable += Number(p.kgExportable) || 0;
      m.kgMerma += totalMerma(p);
    });

    return Object.keys(mapa).map(function (k) {
      const m = mapa[k];
      m.tasaExportable = m.kgProcesados > 0 ? m.kgExportable / m.kgProcesados : 0;
      m.pctCalidadA = m.kgRecibido > 0 ? m.calidadA / m.kgRecibido : 0;
      m.precioPromedio = m.kgRecibido > 0 ? m.valor / m.kgRecibido : 0;
      m.diferenciaPeso = m.kgRecibido - m.kgAnunciadoPesado;
      m.tasaDiferenciaPeso = m.kgAnunciadoPesado > 0 ? m.diferenciaPeso / m.kgAnunciadoPesado : 0;
      m.tasaRechazo = m.lotes > 0 ? m.rechazados / m.lotes : 0;
      return m;
    }).sort(function (a, b) { return b.kgRecibido - a.kgRecibido; });
  }

  function porFruta(filtros) {
    const datos = filtrar(filtros);
    const mapa = {};

    function bucket(id) {
      if (!mapa[id]) {
        const fruta = DB.get("frutas", id);
        mapa[id] = {
          frutaId: id,
          nombre: nombreFruta(id),
          meta: fruta ? fruta.metaExportable : 0,
          kgRecibido: 0, kgProcesados: 0, kgExportable: 0, kgMerma: 0
        };
      }
      return mapa[id];
    }

    datos.lotes.forEach(function (l) {
      bucket(l.frutaId).kgRecibido += Number(l.cantidadRecibidaKg) || 0;
    });
    datos.producciones.forEach(function (p) {
      const b = bucket(p.frutaId);
      b.kgProcesados += Number(p.kgProcesados) || 0;
      b.kgExportable += Number(p.kgExportable) || 0;
      b.kgMerma += totalMerma(p);
    });

    return Object.keys(mapa).map(function (k) {
      const m = mapa[k];
      m.tasaExportable = m.kgProcesados > 0 ? m.kgExportable / m.kgProcesados : 0;
      m.brecha = m.tasaExportable - m.meta;
      return m;
    }).sort(function (a, b) { return b.kgRecibido - a.kgRecibido; });
  }

  /* Pareto de mermas: dónde se está perdiendo la fruta y de quién es el
     problema (campo, transporte o planta). */
  function porCausaMerma(filtros) {
    const prod = filtrar(filtros).producciones;
    const mapa = {};

    prod.forEach(function (p) {
      (p.mermas || []).forEach(function (m) {
        if (!mapa[m.causaId]) {
          const causa = DB.causaMerma(m.causaId);
          mapa[m.causaId] = {
            causaId: m.causaId,
            nombre: causa ? causa.nombre : m.causaId,
            tipo: causa ? causa.tipo : "—",
            kg: 0
          };
        }
        mapa[m.causaId].kg += Number(m.kg) || 0;
      });
    });

    const lista = Object.keys(mapa).map(function (k) { return mapa[k]; })
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

  function porTipoMerma(filtros) {
    const causas = porCausaMerma(filtros);
    const mapa = {};
    causas.forEach(function (c) {
      if (!mapa[c.tipo]) mapa[c.tipo] = { nombre: c.tipo, kg: 0 };
      mapa[c.tipo].kg += c.kg;
    });
    return Object.keys(mapa).map(function (k) { return mapa[k]; })
      .sort(function (a, b) { return b.kg - a.kg; });
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
          return a + (Number(l.cantidadRecibidaKg) || Number(l.cantidadAnunciadaKg) || 0);
        }, 0),
        lotes: items.length
      };
    }).filter(function (x) { return x.kg > 0; });
  }

  /* Serie diaria o mensual para la tendencia del panel. */
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
      if (l.cantidadRecibidaKg === null) return;
      bucket(l.fechaRecepcion || l.fecha).recibido += Number(l.cantidadRecibidaKg) || 0;
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

  /* Ficha completa de un lote: su recorrido y su resultado. Es lo que
     Supervisión revisa antes de cerrar y lo que recibe el proveedor. */
  function fichaLote(loteId) {
    const lote = DB.get("lotes", loteId);
    if (!lote) return null;
    const prod = DB.all("producciones").find(function (p) { return p.loteId === loteId; }) || null;
    const fruta = DB.get("frutas", lote.frutaId);

    const diferencia = lote.cantidadRecibidaKg === null
      ? null : lote.cantidadRecibidaKg - lote.cantidadAnunciadaKg;

    return {
      lote: lote,
      produccion: prod,
      fruta: fruta,
      proveedor: DB.get("proveedores", lote.proveedorId),
      diferenciaKg: diferencia,
      tasaDiferencia: diferencia === null || !lote.cantidadAnunciadaKg
        ? null : diferencia / lote.cantidadAnunciadaKg,
      valor: (lote.cantidadRecibidaKg || 0) * (lote.precioUnitario || 0),
      kgMerma: prod ? totalMerma(prod) : 0,
      tasaExportable: prod && prod.kgProcesados > 0 ? prod.kgExportable / prod.kgProcesados : null,
      meta: fruta ? fruta.metaExportable : null,
      mermas: prod ? (prod.mermas || []).slice().sort(function (a, b) { return b.kg - a.kg; }) : []
    };
  }

  return {
    filtrar: filtrar,
    calcular: calcular,
    porProveedor: porProveedor,
    porFruta: porFruta,
    porCausaMerma: porCausaMerma,
    porTipoMerma: porTipoMerma,
    porCalidad: porCalidad,
    serie: serie,
    fichaLote: fichaLote,
    totalMerma: totalMerma,
    editable: editable,
    nombreFruta: nombreFruta,
    nombreProveedor: nombreProveedor,
    nombreProducto: nombreProducto,
    nombreUsuario: nombreUsuario
  };
})();
