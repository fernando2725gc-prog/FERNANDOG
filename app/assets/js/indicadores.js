/* =========================================================================
   indicadores.js — Motor de cálculo
   Toma las recepciones y las producciones ya filtradas y devuelve los
   indicadores de gestión que sustentan los reportes.
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

  /* Aplica el filtro común (rango de fechas, proveedor, fruta) a ambas
     colecciones. Producción no guarda proveedor, así que se resuelve a
     través de la recepción que le dio origen. */
  function filtrar(filtros) {
    const f = filtros || {};
    const desde = f.desde || "0000-01-01";
    const hasta = f.hasta || "9999-12-31";

    let recepciones = DB.all("recepciones").filter(function (r) {
      if (r.fecha < desde || r.fecha > hasta) return false;
      if (f.proveedorId && r.proveedorId !== f.proveedorId) return false;
      if (f.frutaId && r.frutaId !== f.frutaId) return false;
      if (f.calidad && r.calidad !== f.calidad) return false;
      return true;
    });

    const idsRec = {};
    DB.all("recepciones").forEach(function (r) { idsRec[r.id] = r; });

    let producciones = DB.all("producciones").filter(function (p) {
      if (p.fecha < desde || p.fecha > hasta) return false;
      if (f.frutaId && p.frutaId !== f.frutaId) return false;
      if (f.proveedorId) {
        const rec = idsRec[p.recepcionId];
        if (!rec || rec.proveedorId !== f.proveedorId) return false;
      }
      return true;
    });

    return { recepciones: recepciones, producciones: producciones };
  }

  function suma(lista, campo) {
    return lista.reduce(function (acc, x) { return acc + (Number(x[campo]) || 0); }, 0);
  }

  /* --------------------------------------------------------------- KPIs */

  function calcular(filtros) {
    const datos = filtrar(filtros);
    const rec = datos.recepciones;
    const prod = datos.producciones;

    const kgRecibidos = suma(rec, "cantidadKg");
    const kgProcesados = suma(prod, "kgProcesados");
    const kgFinal = suma(prod, "kgProductoFinal");
    const horas = suma(prod, "horasHombre");

    const valorCompra = rec.reduce(function (acc, r) {
      return acc + (Number(r.cantidadKg) || 0) * (Number(r.precioUnitario) || 0);
    }, 0);

    const rendimiento = kgProcesados > 0 ? kgFinal / kgProcesados : 0;
    const merma = kgProcesados > 0 ? (kgProcesados - kgFinal) / kgProcesados : 0;

    /* Meta ponderada: cada fruta tiene su propio rendimiento esperado, así
       que la meta del período depende de la mezcla realmente procesada. */
    let metaPonderada = 0;
    if (kgProcesados > 0) {
      const acumulado = prod.reduce(function (acc, p) {
        const fruta = DB.get("frutas", p.frutaId);
        const meta = fruta ? fruta.rendimientoMeta : 0.6;
        return acc + meta * (Number(p.kgProcesados) || 0);
      }, 0);
      metaPonderada = acumulado / kgProcesados;
    }

    const pendientes = rec.filter(function (r) { return r.estado === "Pendiente"; });
    const sinProcesar = kgRecibidos - kgProcesados;

    return {
      kgRecibidos: kgRecibidos,
      kgProcesados: kgProcesados,
      kgProductoFinal: kgFinal,
      kgMerma: kgProcesados - kgFinal,
      rendimiento: rendimiento,
      metaRendimiento: metaPonderada,
      cumplimientoMeta: metaPonderada > 0 ? rendimiento / metaPonderada : 0,
      merma: merma,
      valorCompra: valorCompra,
      costoPorKgFinal: kgFinal > 0 ? valorCompra / kgFinal : 0,
      productividad: horas > 0 ? kgProcesados / horas : 0,
      horasHombre: horas,
      numRecepciones: rec.length,
      numProducciones: prod.length,
      numPendientes: pendientes.length,
      kgSinProcesar: sinProcesar > 0 ? sinProcesar : 0,
      tasaProcesamiento: kgRecibidos > 0 ? kgProcesados / kgRecibidos : 0,
      proveedoresActivos: new Set(rec.map(function (r) { return r.proveedorId; })).size
    };
  }

  /* ------------------------------------------------------ agrupaciones */

  function porProveedor(filtros) {
    const datos = filtrar(filtros);
    const mapa = {};

    datos.recepciones.forEach(function (r) {
      if (!mapa[r.proveedorId]) {
        mapa[r.proveedorId] = {
          proveedorId: r.proveedorId,
          nombre: nombreProveedor(r.proveedorId),
          envios: 0, kgRecibidos: 0, valor: 0,
          kgProcesados: 0, kgFinal: 0, calidadA: 0
        };
      }
      const m = mapa[r.proveedorId];
      m.envios += 1;
      m.kgRecibidos += Number(r.cantidadKg) || 0;
      m.valor += (Number(r.cantidadKg) || 0) * (Number(r.precioUnitario) || 0);
      if (r.calidad === "A") m.calidadA += Number(r.cantidadKg) || 0;
    });

    const recPorId = {};
    DB.all("recepciones").forEach(function (r) { recPorId[r.id] = r; });

    datos.producciones.forEach(function (p) {
      const rec = recPorId[p.recepcionId];
      if (!rec || !mapa[rec.proveedorId]) return;
      mapa[rec.proveedorId].kgProcesados += Number(p.kgProcesados) || 0;
      mapa[rec.proveedorId].kgFinal += Number(p.kgProductoFinal) || 0;
    });

    return Object.keys(mapa).map(function (k) {
      const m = mapa[k];
      m.rendimiento = m.kgProcesados > 0 ? m.kgFinal / m.kgProcesados : 0;
      m.pctCalidadA = m.kgRecibidos > 0 ? m.calidadA / m.kgRecibidos : 0;
      m.precioPromedio = m.kgRecibidos > 0 ? m.valor / m.kgRecibidos : 0;
      return m;
    }).sort(function (a, b) { return b.kgRecibidos - a.kgRecibidos; });
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
          meta: fruta ? fruta.rendimientoMeta : 0,
          kgRecibidos: 0, kgProcesados: 0, kgFinal: 0
        };
      }
      return mapa[id];
    }

    datos.recepciones.forEach(function (r) {
      bucket(r.frutaId).kgRecibidos += Number(r.cantidadKg) || 0;
    });
    datos.producciones.forEach(function (p) {
      const b = bucket(p.frutaId);
      b.kgProcesados += Number(p.kgProcesados) || 0;
      b.kgFinal += Number(p.kgProductoFinal) || 0;
    });

    return Object.keys(mapa).map(function (k) {
      const m = mapa[k];
      m.rendimiento = m.kgProcesados > 0 ? m.kgFinal / m.kgProcesados : 0;
      m.brecha = m.rendimiento - m.meta;
      return m;
    }).sort(function (a, b) { return b.kgRecibidos - a.kgRecibidos; });
  }

  function porCalidad(filtros) {
    const rec = filtrar(filtros).recepciones;
    return DB.CALIDADES.map(function (c) {
      const items = rec.filter(function (r) { return r.calidad === c.id; });
      return { id: c.id, nombre: c.nombre, kg: suma(items, "cantidadKg"), envios: items.length };
    }).filter(function (x) { return x.kg > 0; });
  }

  /* Serie diaria o mensual para la tendencia del dashboard. */
  function serie(filtros, granularidad) {
    const datos = filtrar(filtros);
    const corte = granularidad === "mes" ? 7 : 10;
    const mapa = {};

    function bucket(fecha) {
      const k = fecha.slice(0, corte);
      if (!mapa[k]) mapa[k] = { periodo: k, recibido: 0, procesado: 0, final: 0 };
      return mapa[k];
    }

    datos.recepciones.forEach(function (r) {
      bucket(r.fecha).recibido += Number(r.cantidadKg) || 0;
    });
    datos.producciones.forEach(function (p) {
      const b = bucket(p.fecha);
      b.procesado += Number(p.kgProcesados) || 0;
      b.final += Number(p.kgProductoFinal) || 0;
    });

    return Object.keys(mapa).sort().map(function (k) {
      const m = mapa[k];
      m.rendimiento = m.procesado > 0 ? m.final / m.procesado : 0;
      return m;
    });
  }

  return {
    filtrar: filtrar,
    calcular: calcular,
    porProveedor: porProveedor,
    porFruta: porFruta,
    porCalidad: porCalidad,
    serie: serie,
    nombreFruta: nombreFruta,
    nombreProveedor: nombreProveedor,
    nombreProducto: nombreProducto
  };
})();
