/* =========================================================================
   graficos.js — Gráficos en SVG generados a mano
   Sin librerías externas: la app debe poder ejecutarse sin internet.
   Cada función devuelve una cadena de marcado SVG lista para inyectar.
   ========================================================================= */

const Graficos = (function () {
  "use strict";

  const PALETA = ["#1f7a5a", "#c98a1b", "#3b6ea5", "#9c5aa8", "#a8503b", "#4a8a8a"];

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function fmt(n) {
    return new Intl.NumberFormat("es-EC", { maximumFractionDigits: 0 }).format(n);
  }

  function vacio(mensaje) {
    return '<p class="grafico-vacio">' + esc(mensaje || "Sin datos en el período seleccionado.") + "</p>";
  }

  function escalaBonita(max) {
    if (max <= 0) return 1;
    const exp = Math.pow(10, Math.floor(Math.log10(max)));
    const norm = max / exp;
    const paso = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
    return paso * exp;
  }

  /* ------------------------------------------------- líneas / tendencia */

  function lineas(puntos, opciones) {
    const o = opciones || {};
    if (!puntos.length) return vacio();

    const W = 720, H = 260;
    const m = { t: 16, r: 16, b: 34, l: 56 };
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;

    const series = o.series || [
      { campo: "recibido", nombre: "Recibido", color: PALETA[0] },
      { campo: "procesado", nombre: "Procesado", color: PALETA[1] }
    ];

    let max = 0;
    puntos.forEach(function (p) {
      series.forEach(function (s) { max = Math.max(max, Number(p[s.campo]) || 0); });
    });
    max = escalaBonita(max);

    const x = function (i) {
      return m.l + (puntos.length === 1 ? iw / 2 : (i * iw) / (puntos.length - 1));
    };
    const y = function (v) {
      return m.t + ih - (Math.min(v, max) / max) * ih;
    };

    let svg = '<svg viewBox="0 0 ' + W + " " + H + '" class="chart" role="img" ' +
      'aria-label="' + esc(o.titulo || "Tendencia") + '" preserveAspectRatio="xMidYMid meet">';

    /* Rejilla y eje Y */
    for (let g = 0; g <= 4; g += 1) {
      const v = (max / 4) * g;
      const yy = y(v);
      svg += '<line x1="' + m.l + '" y1="' + yy + '" x2="' + (W - m.r) + '" y2="' + yy +
        '" class="chart-grid"/>';
      svg += '<text x="' + (m.l - 8) + '" y="' + (yy + 4) + '" class="chart-tick chart-tick-y">' +
        fmt(v) + "</text>";
    }

    /* Eje X: como máximo 6 etiquetas para que no se encimen */
    const salto = Math.max(1, Math.ceil(puntos.length / 6));
    puntos.forEach(function (p, i) {
      if (i % salto !== 0 && i !== puntos.length - 1) return;
      svg += '<text x="' + x(i) + '" y="' + (H - 10) + '" class="chart-tick chart-tick-x">' +
        esc(p.periodo.slice(5)) + "</text>";
    });

    /* Series */
    series.forEach(function (s) {
      const d = puntos.map(function (p, i) {
        return (i === 0 ? "M" : "L") + x(i).toFixed(1) + " " + y(Number(p[s.campo]) || 0).toFixed(1);
      }).join(" ");
      const area = d + " L" + x(puntos.length - 1).toFixed(1) + " " + (m.t + ih) +
        " L" + x(0).toFixed(1) + " " + (m.t + ih) + " Z";
      svg += '<path d="' + area + '" fill="' + s.color + '" opacity="0.08"/>';
      svg += '<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="2.5" ' +
        'stroke-linejoin="round" stroke-linecap="round"/>';
      puntos.forEach(function (p, i) {
        if (puntos.length > 40 && i % salto !== 0) return;
        svg += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(Number(p[s.campo]) || 0).toFixed(1) +
          '" r="3" fill="' + s.color + '"><title>' + esc(p.periodo) + " · " + s.nombre + ": " +
          fmt(p[s.campo]) + " kg</title></circle>";
      });
    });

    svg += "</svg>";

    let leyenda = '<ul class="leyenda">';
    series.forEach(function (s) {
      leyenda += '<li><span class="punto" style="background:' + s.color + '"></span>' +
        esc(s.nombre) + "</li>";
    });
    leyenda += "</ul>";

    return svg + leyenda;
  }

  /* ------------------------------------------------- barras horizontales */

  function barras(datos, opciones) {
    const o = opciones || {};
    if (!datos.length) return vacio();

    const campo = o.campo || "valor";
    const filas = datos.slice(0, o.limite || 8);
    const alto = 34;
    const W = 720;
    const H = filas.length * alto + 12;
    const anchoEtiqueta = 190;
    const max = Math.max.apply(null, filas.map(function (d) { return Number(d[campo]) || 0; })) || 1;

    let svg = '<svg viewBox="0 0 ' + W + " " + H + '" class="chart" role="img" ' +
      'aria-label="' + esc(o.titulo || "Comparativo") + '" preserveAspectRatio="xMidYMin meet">';

    filas.forEach(function (d, i) {
      const yy = i * alto + 6;
      const ancho = ((Number(d[campo]) || 0) / max) * (W - anchoEtiqueta - 90);
      const color = o.color || PALETA[i % PALETA.length];
      svg += '<text x="0" y="' + (yy + 15) + '" class="chart-label">' +
        esc(String(d.nombre).slice(0, 26)) + "</text>";
      svg += '<rect x="' + anchoEtiqueta + '" y="' + yy + '" width="' + Math.max(ancho, 2) +
        '" height="20" rx="4" fill="' + color + '"><title>' + esc(d.nombre) + ": " +
        fmt(d[campo]) + (o.sufijo || " kg") + "</title></rect>";
      svg += '<text x="' + (anchoEtiqueta + Math.max(ancho, 2) + 8) + '" y="' + (yy + 15) +
        '" class="chart-valor">' + fmt(d[campo]) + (o.sufijo || "") + "</text>";
    });

    return svg + "</svg>";
  }

  /* ------------------------------------------------------------- dona */

  function dona(datos, opciones) {
    const o = opciones || {};
    if (!datos.length) return vacio();

    const campo = o.campo || "kg";
    const total = datos.reduce(function (a, d) { return a + (Number(d[campo]) || 0); }, 0);
    if (total <= 0) return vacio();

    const S = 200, c = S / 2, R = 78, r = 48;
    let angulo = -Math.PI / 2;

    let svg = '<svg viewBox="0 0 ' + S + " " + S + '" class="chart chart-dona" role="img" ' +
      'aria-label="' + esc(o.titulo || "Distribución") + '">';

    datos.forEach(function (d, i) {
      const parte = (Number(d[campo]) || 0) / total;
      const fin = angulo + parte * Math.PI * 2;
      const grande = parte > 0.5 ? 1 : 0;
      const x1 = c + R * Math.cos(angulo), y1 = c + R * Math.sin(angulo);
      const x2 = c + R * Math.cos(fin), y2 = c + R * Math.sin(fin);
      const x3 = c + r * Math.cos(fin), y3 = c + r * Math.sin(fin);
      const x4 = c + r * Math.cos(angulo), y4 = c + r * Math.sin(angulo);

      /* Un único segmento al 100% no se puede dibujar con un solo arco. */
      const d1 = parte >= 0.999
        ? "M" + (c - R) + " " + c + " A" + R + " " + R + " 0 1 1 " + (c + R) + " " + c +
          " A" + R + " " + R + " 0 1 1 " + (c - R) + " " + c + " Z " +
          "M" + (c - r) + " " + c + " A" + r + " " + r + " 0 1 0 " + (c + r) + " " + c +
          " A" + r + " " + r + " 0 1 0 " + (c - r) + " " + c + " Z"
        : "M" + x1.toFixed(2) + " " + y1.toFixed(2) +
          " A" + R + " " + R + " 0 " + grande + " 1 " + x2.toFixed(2) + " " + y2.toFixed(2) +
          " L" + x3.toFixed(2) + " " + y3.toFixed(2) +
          " A" + r + " " + r + " 0 " + grande + " 0 " + x4.toFixed(2) + " " + y4.toFixed(2) + " Z";

      svg += '<path d="' + d1 + '" fill="' + PALETA[i % PALETA.length] + '" fill-rule="evenodd">' +
        "<title>" + esc(d.nombre) + ": " + fmt(d[campo]) + " kg (" +
        (parte * 100).toFixed(1) + "%)</title></path>";
      angulo = fin;
    });

    svg += '<text x="' + c + '" y="' + (c - 2) + '" class="dona-total">' + fmt(total) + "</text>";
    svg += '<text x="' + c + '" y="' + (c + 16) + '" class="dona-sub">kg</text>';
    svg += "</svg>";

    let leyenda = '<ul class="leyenda leyenda-col">';
    datos.forEach(function (d, i) {
      const pct = ((Number(d[campo]) || 0) / total) * 100;
      leyenda += '<li><span class="punto" style="background:' + PALETA[i % PALETA.length] + '"></span>' +
        esc(d.nombre) + ' <strong>' + pct.toFixed(1) + "%</strong></li>";
    });
    leyenda += "</ul>";

    return '<div class="dona-wrap">' + svg + leyenda + "</div>";
  }


  /* ------------------------------------------------- Pareto de mermas */

  /* Barras ordenadas de mayor a menor mas la curva de porcentaje acumulado.
     Sirve para ver que pocas causas explican la mayor parte de la merma. */
  function pareto(datos, opciones) {
    const o = opciones || {};
    if (!datos.length) return vacio();

    const filas = datos.slice(0, o.limite || 9);
    const W = 720, H = 300;
    const m = { t: 18, r: 46, b: 92, l: 58 };
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;

    const max = escalaBonita(Math.max.apply(null, filas.map(function (d) { return d.kg; })));
    const ancho = iw / filas.length;
    const y = function (v) { return m.t + ih - (v / max) * ih; };
    const yAcum = function (p) { return m.t + ih - p * ih; };

    let svg = '<svg viewBox="0 0 ' + W + " " + H + '" class="chart" role="img" ' +
      'aria-label="' + esc(o.titulo || "Pareto de causas") + '" preserveAspectRatio="xMidYMid meet">';

    /* Rejilla: kilogramos a la izquierda, porcentaje acumulado a la derecha */
    for (let g = 0; g <= 4; g += 1) {
      const yy = y((max / 4) * g);
      svg += '<line x1="' + m.l + '" y1="' + yy + '" x2="' + (W - m.r) + '" y2="' + yy +
        '" class="chart-grid"/>';
      svg += '<text x="' + (m.l - 8) + '" y="' + (yy + 4) + '" class="chart-tick chart-tick-y">' +
        fmt((max / 4) * g) + "</text>";
      svg += '<text x="' + (W - m.r + 8) + '" y="' + (yy + 4) + '" class="chart-tick">' +
        (g * 25) + "%</text>";
    }

    filas.forEach(function (d, i) {
      const x = m.l + i * ancho;
      const bw = ancho * 0.62;
      const bx = x + (ancho - bw) / 2;
      const by = y(d.kg);
      const color = d.tipo === "Campo" ? PALETA[0]
        : d.tipo === "Transporte" ? PALETA[1] : PALETA[2];

      svg += '<rect x="' + bx.toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + bw.toFixed(1) +
        '" height="' + (m.t + ih - by).toFixed(1) + '" rx="3" fill="' + color + '">' +
        "<title>" + esc(d.nombre) + " (" + esc(d.tipo) + "): " + fmt(d.kg) + " kg · " +
        (d.porcentaje * 100).toFixed(1) + "% de la merma</title></rect>";

      /* Etiqueta girada: los nombres de causa no caben en horizontal */
      svg += '<text transform="translate(' + (x + ancho / 2).toFixed(1) + "," + (m.t + ih + 10) +
        ') rotate(-38)" class="chart-tick" text-anchor="end">' +
        esc(d.nombre.length > 22 ? d.nombre.slice(0, 21) + "…" : d.nombre) + "</text>";
    });

    /* Curva acumulada */
    const linea = filas.map(function (d, i) {
      return (i === 0 ? "M" : "L") + (m.l + i * ancho + ancho / 2).toFixed(1) + " " +
        yAcum(d.acumulado).toFixed(1);
    }).join(" ");
    svg += '<path d="' + linea + '" fill="none" stroke="' + PALETA[4] +
      '" stroke-width="2" stroke-dasharray="4 3"/>';
    filas.forEach(function (d, i) {
      svg += '<circle cx="' + (m.l + i * ancho + ancho / 2).toFixed(1) + '" cy="' +
        yAcum(d.acumulado).toFixed(1) + '" r="3.5" fill="' + PALETA[4] + '">' +
        "<title>Acumulado: " + (d.acumulado * 100).toFixed(1) + "%</title></circle>";
    });

    /* Referencia del 80%: la frontera clasica del analisis de Pareto */
    svg += '<line x1="' + m.l + '" y1="' + yAcum(0.8).toFixed(1) + '" x2="' + (W - m.r) +
      '" y2="' + yAcum(0.8).toFixed(1) + '" stroke="' + PALETA[4] +
      '" stroke-width="1" stroke-dasharray="2 4" opacity="0.55"/>';

    svg += "</svg>";

    let leyenda = '<ul class="leyenda">';
    [["Campo", PALETA[0]], ["Transporte", PALETA[1]], ["Proceso", PALETA[2]]].forEach(function (t) {
      leyenda += '<li><span class="punto" style="background:' + t[1] + '"></span>' + t[0] + "</li>";
    });
    leyenda += '<li><span class="punto punto-linea" style="background:' + PALETA[4] +
      '"></span>% acumulado</li></ul>';

    return svg + leyenda;
  }

  /* ------------------------------------- barra de cumplimiento vs meta */

  function medidor(valor, meta, etiqueta) {
    const pct = meta > 0 ? Math.min(valor / meta, 1.35) : 0;
    const ancho = Math.min(pct, 1) * 100;
    const estado = pct >= 1 ? "ok" : pct >= 0.9 ? "alerta" : "bajo";
    return '<div class="medidor medidor-' + estado + '">' +
      '<div class="medidor-cab"><span>' + esc(etiqueta) + "</span><strong>" +
      (valor * 100).toFixed(1) + "%</strong></div>" +
      '<div class="medidor-pista"><div class="medidor-barra" style="width:' + ancho.toFixed(1) + '%"></div>' +
      '<div class="medidor-meta" style="left:' + Math.min(100, 100).toFixed(1) + '%"></div></div>' +
      '<div class="medidor-pie">Meta ponderada: ' + (meta * 100).toFixed(1) + "%</div></div>";
  }

  return {
    PALETA: PALETA,
    lineas: lineas,
    barras: barras,
    dona: dona,
    pareto: pareto,
    medidor: medidor,
    vacio: vacio
  };
})();
