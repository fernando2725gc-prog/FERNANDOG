/* =========================================================================
   planta.js — Sistema de Planta (aplicación interna)

   Roles: Recepción, Producción y Supervisor. Consume los lotes que los
   proveedores anuncian desde el portal externo, y consolida en un solo
   repositorio la recepción, la producción, las pérdidas por causa raíz y
   el destino del descarte.
   ========================================================================= */

(function () {
  "use strict";

  const $ = UI.$, $$ = UI.$$;
  const esc = UI.esc, nf = UI.nf, pct = UI.pct, money = UI.money;
  const pctFirmado = UI.pctFirmado;
  const SESION = "flp.planta.sesion";

  let usuario = null;
  let vista = "panel";
  let reporteActual = "proveedor";

  let filtros = {
    desde: DB.diasAtras(30), hasta: DB.hoy(),
    proveedorId: "", lineaId: "", calidad: "", estado: ""
  };

  const ROLES_INTERNOS = ["recepcion", "produccion", "supervisor"];

  const PERMISOS = {
    recepcion: ["pesar", "rechazar", "ver_lotes"],
    produccion: ["procesar", "ver_lotes"],
    supervisor: ["pesar", "rechazar", "procesar", "ver_lotes", "cerrar", "reabrir",
      "enviar_reporte", "planificar", "administrar"]
  };

  function puede(accion) {
    return !!usuario && (PERMISOS[usuario.rol] || []).indexOf(accion) !== -1;
  }

  /* ============================== sesión ============================== */

  function entrar(rol, nombre) {
    const limpio = String(nombre).trim();
    if (ROLES_INTERNOS.indexOf(rol) === -1) return { error: "Selecciona tu rol." };
    if (limpio.length < 3) return { error: "Escribe tu nombre y apellido." };

    let u = DB.all("usuarios").find(function (x) {
      return x.rol === rol && x.nombre.toLowerCase() === limpio.toLowerCase();
    });
    if (!u) {
      u = DB.insert("usuarios", {
        nombre: limpio, rol: rol, proveedorId: null, activo: true, fechaAlta: DB.hoy()
      });
      DB.registrarBitacora(u.id, "Alta de usuario interno", limpio + " · " + rol);
    } else if (!u.activo) {
      return { error: "Tu usuario está inactivo. Habla con Supervisión." };
    }

    usuario = u;
    UI.guardarSesion(SESION, u.id);
    DB.registrarBitacora(u.id, "Inicio de sesión", u.nombre + " · " + rol);
    return { ok: true };
  }

  function salir() {
    if (usuario) DB.registrarBitacora(usuario.id, "Cierre de sesión", usuario.nombre);
    usuario = null;
    if (repintado) { clearTimeout(repintado); repintado = null; }
    vista = "panel";
    UI.borrarSesion(SESION);
    render();
  }

  function restaurar() {
    const id = UI.leerSesion(SESION);
    if (!id) return;
    const u = DB.get("usuarios", id);
    if (u && ROLES_INTERNOS.indexOf(u.rol) !== -1) usuario = u;
  }

  /* ============================== navegación ========================== */

  function menu() {
    return [
      { id: "panel", texto: "Indicadores", icono: "📊", roles: "*" },
      { id: "planificador", texto: "Planificación diaria", icono: "🗓️", roles: ["supervisor"] },
      { id: "recepcion", texto: "Recepción y pesaje", icono: "⚖️", roles: ["recepcion", "supervisor"] },
      { id: "produccion", texto: "Producción", icono: "🏭", roles: ["produccion", "supervisor"] },
      { id: "lotes", texto: "Lotes", icono: "📦", roles: "*" },
      { id: "reportes", texto: "Reportes", icono: "📄", roles: "*" },
      { id: "catalogos", texto: "Parámetros", icono: "⚙️", roles: ["supervisor"] },
      { id: "proveedores", texto: "Proveedores", icono: "🤝", roles: ["supervisor"] },
      { id: "usuarios", texto: "Usuarios", icono: "👥", roles: ["supervisor"] },
      { id: "bitacora", texto: "Bitácora", icono: "🕘", roles: ["supervisor"] },
      { id: "datos", texto: "Datos del sistema", icono: "🗄️", roles: ["supervisor"] }
    ].filter(function (m) { return m.roles === "*" || m.roles.indexOf(usuario.rol) !== -1; });
  }

  function ir(v) {
    vista = v; render();
    const m = $("#contenido"); if (m) m.focus();
  }

  /* ============================== filtros ============================= */

  function barraFiltros(o) {
    o = o || {};
    let html = '<form class="filtros" id="formFiltros">';
    html += '<div class="campo"><label for="fDesde">Desde</label>' +
      '<input type="date" id="fDesde" name="desde" value="' + esc(filtros.desde) + '"></div>';
    html += '<div class="campo"><label for="fHasta">Hasta</label>' +
      '<input type="date" id="fHasta" name="hasta" value="' + esc(filtros.hasta) + '"></div>';

    html += '<div class="campo"><label for="fProv">Proveedor</label><select id="fProv" name="proveedorId"><option value="">Todos</option>';
    DB.all("proveedores").forEach(function (p) {
      html += '<option value="' + esc(p.id) + '"' + (filtros.proveedorId === p.id ? " selected" : "") +
        ">" + esc(p.nombre) + "</option>";
    });
    html += "</select></div>";

    html += '<div class="campo"><label for="fLinea">Línea</label><select id="fLinea" name="lineaId"><option value="">Todas</option>';
    DB.all("lineas").forEach(function (l) {
      html += '<option value="' + esc(l.id) + '"' + (filtros.lineaId === l.id ? " selected" : "") +
        ">" + esc(l.nombre) + "</option>";
    });
    html += "</select></div>";

    if (o.estado) {
      html += '<div class="campo"><label for="fEstado">Estado</label><select id="fEstado" name="estado"><option value="">Todos</option>';
      DB.ESTADOS.forEach(function (e) {
        html += '<option value="' + esc(e.id) + '"' + (filtros.estado === e.id ? " selected" : "") +
          ">" + esc(e.nombre) + "</option>";
      });
      html += "</select></div>";
    }
    if (o.calidad) {
      html += '<div class="campo"><label for="fCal">Calidad</label><select id="fCal" name="calidad"><option value="">Todas</option>';
      DB.CALIDADES.forEach(function (c) {
        html += '<option value="' + esc(c.id) + '"' + (filtros.calidad === c.id ? " selected" : "") +
          ">" + esc(c.nombre) + "</option>";
      });
      html += "</select></div>";
    }

    html += '<div class="campo campo-acciones">' +
      '<button type="submit" class="btn btn-sec">Aplicar</button>' +
      '<button type="button" class="btn btn-plano" id="btnLimpiar">Limpiar</button></div></form>';
    html += '<div class="atajos"><span>Rango rápido:</span>' +
      '<button type="button" class="chip" data-rango="7">7 días</button>' +
      '<button type="button" class="chip" data-rango="30">30 días</button>' +
      '<button type="button" class="chip" data-rango="90">90 días</button>' +
      '<button type="button" class="chip" data-rango="365">12 meses</button></div>';
    return html;
  }

  /* =============================== panel ============================== */

  function vistaPanel() {
    const k = Indicadores.calcular(filtros);
    const dias = Math.round((new Date(filtros.hasta) - new Date(filtros.desde)) / 86400000);
    const gran = dias > 120 ? "mes" : "dia";

    let html = '<div class="vista-cab"><div><h1>Indicadores</h1>' +
      '<p class="sub">Del ' + UI.fechaLarga(filtros.desde) + " al " + UI.fechaLarga(filtros.hasta) +
      "</p></div><button class=\"btn btn-plano\" id=\"btnImprimir\">Imprimir</button></div>";

    html += barraFiltros({ calidad: true, estado: true });

    /* Embudo del ciclo de vida. */
    html += '<section class="panel"><h2>Estado de los lotes</h2><div class="embudo">';
    DB.ESTADOS.filter(function (e) { return e.id !== "Rechazado"; }).forEach(function (e, i) {
      html += '<div class="embudo-paso"><span class="embudo-num">' + nf(k.porEstado[e.id] || 0) + "</span>" +
        '<span class="embudo-nombre">' + esc(e.nombre) + "</span>" +
        '<span class="embudo-ayuda">' + esc(e.ayuda) + "</span></div>";
      if (i < 3) html += '<div class="embudo-flecha" aria-hidden="true">→</div>';
    });
    html += "</div>";
    if (k.numRechazados > 0) {
      html += '<p class="embudo-rechazo">' + nf(k.numRechazados) + " lote(s) rechazado(s) · " +
        pct(k.tasaRechazo) + " del total.</p>";
    }
    html += "</section>";

    /* --- Bloque 1: pérdidas --- */
    html += '<h2 class="seccion-titulo">Pérdidas</h2><section class="kpis">';
    html += UI.kpi("Cajas recibidas", nf(k.cajasRecibidas),
      k.numLotes + " lotes · " + nf(k.kgRecibidos) + " kg", "linea1");
    html += UI.kpi("Diferencia al declarar", pctFirmado(k.tasaDiferenciaCajas),
      nf(k.diferenciaCajas) + " cajas entre lo anunciado y lo pesado",
      Math.abs(k.tasaDiferenciaCajas) <= 0.01 ? "bien" : Math.abs(k.tasaDiferenciaCajas) <= 0.03 ? "regular" : "mal");
    html += UI.kpi("Cajas exportables", nf(k.cajasExportables),
      pct(k.tasaExportable) + " de lo procesado", "bien");
    html += UI.kpi("Tasa de exportable", pct(k.tasaExportable),
      "Meta " + pct(k.metaExportable) + " · cumplimiento " + pct(k.cumplimientoMeta),
      k.cumplimientoMeta >= 1 ? "bien" : k.cumplimientoMeta >= 0.9 ? "regular" : "mal");
    html += UI.kpi("Merma", pct(k.tasaMerma), nf(k.kgMerma) + " kg descartados",
      k.tasaMerma > 0.25 ? "mal" : "regular");
    html += UI.kpi("Pérdida económica", money(k.perdidaEconomica),
      nf(k.cajasPerdidas) + " cajas que no llegaron a exportación", "mal");
    html += "</section>";

    html += '<section class="panel"><h2>¿Por qué causa raíz se pierde?</h2>' +
      '<p class="sub panel-sub">Las causas a la izquierda del 80 % acumulado son las ' +
      "que concentran la pérdida. Es el Pareto que sostiene la priorización del diagnóstico.</p>" +
      Graficos.pareto(Indicadores.porCausaRaiz(filtros), {
        titulo: "Pareto de causas raíz",
        ejeX: function (d) { return d.codigo; },
        etiqueta: function (d) { return d.etiqueta; },
        color: function (d) { return d.principal ? "#c0246b" : d.definida ? "#c85a1e" : "#8b96a3"; },
        leyenda: [["Causa principal (CR5-CR8)", "#c0246b"], ["Otra causa definida", "#c85a1e"],
          ["Por definir", "#8b96a3"]]
      }) + "</section>";

    /* --- Bloque 2: economía circular --- */
    html += '<h2 class="seccion-titulo">Economía circular</h2><section class="kpis">';
    html += UI.kpi("Descarte aprovechado", pct(k.tasaValorizacion),
      nf(k.kgValorizado) + " kg de " + nf(k.kgMerma) + " kg",
      k.tasaValorizacion >= 0.7 ? "bien" : k.tasaValorizacion >= 0.4 ? "regular" : "mal");
    html += UI.kpi("A relleno sanitario", nf(k.kgRelleno) + " kg",
      "Lo que todavía no se valoriza", k.kgRelleno > 0 ? "mal" : "bien");
    html += UI.kpi("Valor recuperado", money(k.valorDescarte),
      "Por dar destino al descarte en vez de botarlo", "bien");
    html += "</section>";

    html += '<div class="grid-2">';
    html += '<section class="panel"><h2>Destino del descarte</h2>' +
      '<p class="sub panel-sub">De mayor a menor valor recuperado.</p>' +
      Graficos.barras(Indicadores.porDestino(filtros), { campo: "kg", sufijo: " kg" }) +
      "</section>";
    html += '<section class="panel"><h2>Distribución por calidad</h2>' +
      Graficos.dona(Indicadores.porCalidad(filtros), { titulo: "Cajas por calidad" }) + "</section>";
    html += "</div>";

    /* --- Bloque 3: proceso --- */
    html += '<h2 class="seccion-titulo">Proceso</h2><section class="kpis">';
    html += UI.kpi("Eficiencia de tiempo", pct(k.eficienciaTiempo),
      "Tiempo estándar ÷ tiempo real",
      k.eficienciaTiempo >= 0.95 ? "bien" : k.eficienciaTiempo >= 0.85 ? "regular" : "mal");
    html += UI.kpi("Minutos por caja", nf(k.minutosPorCaja, 2) + " min",
      "Promedio real del período", "neutro");
    html += UI.kpi("Productividad", nf(k.productividad, 2) + " cajas/HH",
      nf(k.horasHombre, 1) + " horas-hombre", "linea3");
    html += UI.kpi("Ciclo del lote", nf(k.cicloPromedio, 1) + " días",
      "Del anuncio al cierre · " + k.numCerrados + " cerrados", "neutro");
    html += "</section>";

    html += '<div class="grid-2">';
    html += '<section class="panel"><h2>Tendencia</h2>' +
      Graficos.lineas(Indicadores.serie(filtros, gran), {
        titulo: "Cajas por período",
        series: [
          { campo: "recibido", nombre: "Recibido", color: "#2f6f8f" },
          { campo: "procesado", nombre: "Procesado", color: "#c85a1e" },
          { campo: "exportable", nombre: "Exportable", color: "#5b8c3a" }
        ]
      }) + "</section>";
    html += '<section class="panel"><h2>Volumen por línea</h2>' +
      Graficos.barras(Indicadores.porLinea(filtros), { campo: "cajasRecibidas", sufijo: " cajas" }) +
      "</section>";
    html += "</div>";

    html += '<section class="panel"><h2>Desempeño por línea de producto</h2>' +
      UI.tabla([
        { titulo: "Línea", valor: function (m) { return UI.etiquetaLinea(m.lineaId); } },
        { titulo: "T. estándar", num: true, valor: function (m) {
          return nf(m.tiempoEstandarMin, 2) + " min " + UI.origen("M"); } },
        { titulo: "Min/caja real", num: true, valor: function (m) { return nf(m.minutosPorCaja, 2); } },
        { titulo: "Eficiencia", num: true, valor: function (m) {
          return '<span class="etq ' + (m.eficiencia >= 0.95 ? "etq-ok" : "etq-bajo") + '">' +
            pct(m.eficiencia) + "</span>"; } },
        { titulo: "Cajas recibidas", num: true, valor: function (m) { return nf(m.cajasRecibidas); } },
        { titulo: "Exportable", num: true, valor: function (m) {
          return '<span class="etq ' + (m.tasaExportable >= m.meta ? "etq-ok" : "etq-bajo") + '">' +
            pct(m.tasaExportable) + "</span>"; } },
        { titulo: "Meta", num: true, valor: function (m) { return pct(m.meta) + " " + UI.origen("E"); } },
        { titulo: "Aprovechado", num: true, valor: function (m) { return pct(m.tasaValorizacion); } }
      ], Indicadores.porLinea(filtros), {}) + "</section>";

    return html;
  }

  /* ========================= planificación diaria ===================== */

  let planActual = null;

  function planPorDefecto() {
    const p = DB.parametros();
    return {
      fecha: DB.hoy(),
      horasTurno: p.horasTurno,
      operarios: p.operariosDisponibles,
      eficiencia: p.eficienciaPlanta,
      lineas: DB.all("lineas").filter(function (l) { return l.activa; })
        .map(function (l) { return { lineaId: l.id, cajas: 0 }; })
    };
  }

  function vistaPlanificador() {
    if (!planActual) planActual = planPorDefecto();
    const r = Indicadores.planificar(planActual);
    const p = DB.parametros();

    let html = '<div class="vista-cab"><div><h1>Planificación diaria</h1>' +
      '<p class="sub">Cuánto se puede producir hoy, con cuánta gente y en qué ritmo.</p></div>' +
      '<div class="cab-acciones">' +
      '<button class="btn btn-plano" id="btnGuardarPlan">Guardar plan</button>' +
      '<button class="btn btn-plano" id="btnImprimir">Imprimir</button></div></div>';

    /* --- entradas --- */
    html += '<section class="panel"><h2>Condiciones del turno</h2>' +
      '<form class="filtros" id="formPlan">' +
      '<div class="campo"><label for="pFecha">Fecha</label>' +
      '<input type="date" id="pFecha" name="fecha" value="' + esc(planActual.fecha) + '"></div>' +
      '<div class="campo"><label for="pHoras">Horas de turno</label>' +
      '<input type="number" inputmode="decimal" id="pHoras" name="horasTurno" min="1" max="24" step="0.5" value="' +
      planActual.horasTurno + '"></div>' +
      '<div class="campo"><label for="pOper">Operarios disponibles</label>' +
      '<input type="number" inputmode="numeric" id="pOper" name="operarios" min="1" max="200" step="1" value="' +
      planActual.operarios + '"></div>' +
      '<div class="campo"><label for="pEf">Eficiencia de planta</label>' +
      '<input type="number" inputmode="decimal" id="pEf" name="eficiencia" min="0.3" max="1" step="0.01" value="' +
      planActual.eficiencia + '"></div>' +
      '<div class="campo campo-acciones"><button type="submit" class="btn btn-sec">Recalcular</button></div>' +
      "</form>" +
      '<p class="nota-info">Se descuentan los suplementos de la OIT (' + pct(p.suplementosOIT, 0) +
      " " + UI.origen(p.origenSuplementos) + ") del tiempo de turno antes de calcular la capacidad.</p>" +
      "</section>";

    /* --- demanda por línea --- */
    html += '<section class="panel"><h2>¿Qué hay que sacar hoy?</h2>' +
      '<p class="sub panel-sub">Escribe las cajas comprometidas de cada línea. ' +
      "El sistema calcula el tiempo que toman según el estudio de tiempos.</p>" +
      '<form id="formDemanda"><div class="demanda">';
    planActual.lineas.forEach(function (item) {
      const l = DB.linea(item.lineaId);
      if (!l) return;
      const disp = r.detalle.find(function (d) { return d.lineaId === item.lineaId; });
      html += '<div class="demanda-fila" style="--linea:' + esc(l.color) + '">' +
        '<label for="dem_' + esc(l.id) + '"><span class="linea-punto" aria-hidden="true"></span>' +
        esc(l.nombre) + '<small>' + nf(l.tiempoEstandarMin, 2) + " min/caja " + UI.origen(l.origenTiempo) +
        "</small></label>" +
        '<input type="number" inputmode="numeric" id="dem_' + esc(l.id) + '" data-linea="' + esc(l.id) +
        '" min="0" step="1" value="' + (item.cajas || "") + '" placeholder="0">' +
        '<span class="demanda-disp">' + (disp ? "en cámara: " + nf(disp.disponible) : "") + "</span>" +
        "</div>";
    });
    html += "</div></form></section>";

    /* El resultado se repinta solo, sin tocar los campos donde se escribe. */
    html += '<div id="planDinamico">' + resultadoPlan() + "</div>";
    return html;
  }

  /* Solo la parte calculada del planificador. Se regenera en cada tecla sin
     reconstruir la pagina, para no robarle el foco a quien esta escribiendo. */
  function resultadoPlan() {
    const r = Indicadores.planificar(planActual);
    let html = "";

    const tono = !r.alcanza ? "mal" : r.carga > 0.9 ? "regular" : "bien";
    html += '<section class="kpis">';
    html += UI.kpi("Cajas planificadas", nf(r.cajasTotales),
      nf(r.kgTotales) + " kg · " + money(r.valorTotal), "linea1");
    html += UI.kpi("Carga del turno", pct(r.carga),
      UI.minutos(r.minutosRequeridos) + " de " + UI.minutos(r.capacidadTotalMin) + " disponibles", tono);
    html += UI.kpi("Operarios necesarios", nf(r.operariosNecesarios, 1),
      r.operariosFaltantes > 0 ? "Faltan " + nf(r.operariosFaltantes) + " para cumplir"
        : "Alcanza con los " + nf(r.operarios) + " disponibles",
      r.operariosFaltantes > 0 ? "mal" : "bien");
    html += UI.kpi("Takt time", r.taktPromedio > 0 ? nf(r.taktPromedio, 2) + " min" : "—",
      "Una caja debe salir cada este tiempo", "neutro");
    html += "</section>";

    if (r.cajasTotales > 0) {
      html += '<section class="panel panel-' + tono + '"><h2>' +
        (r.alcanza ? "El plan cabe en el turno" : "El plan NO cabe en el turno") + "</h2>" +
        Graficos.medidor(r.carga, 1, "Carga sobre la capacidad disponible",
          "100 % = el turno completo de " + nf(r.operarios) + " operarios (" +
          UI.minutos(r.capacidadTotalMin) + " netos)") +
        (r.alcanza
          ? "<p>Sobran " + UI.minutos(r.capacidadTotalMin - r.minutosRequeridos) +
            " de capacidad con " + nf(r.operarios) + " operarios.</p>"
          : "<p><strong>Faltan " + UI.minutos(r.minutosRequeridos - r.capacidadTotalMin) +
            "</strong>. Hay que sumar " + nf(r.operariosFaltantes) +
            " operario(s), alargar el turno o recortar el plan.</p>");

      if (r.hayFaltantes) {
        html += '<p class="embudo-rechazo">Además, falta materia prima en cámara para ' +
          "algunas líneas: revisa la columna «Faltan» de la tabla.</p>";
      }
      html += "</section>";

      html += '<section class="panel"><h2>Reparto por línea</h2>' +
        UI.tabla([
          { titulo: "Línea", valor: function (d) { return UI.etiquetaLinea(d.lineaId); },
            csv: function (d) { return d.nombre; } },
          { titulo: "Cajas", num: true, valor: function (d) { return nf(d.cajas); },
            csv: function (d) { return d.cajas; } },
          { titulo: "Min/caja", num: true, valor: function (d) { return nf(d.tiempoEstandarMin, 2); },
            csv: function (d) { return d.tiempoEstandarMin; } },
          { titulo: "Tiempo total", num: true, valor: function (d) { return UI.minutos(d.minutosRequeridos); },
            csv: function (d) { return Math.round(d.minutosRequeridos); } },
          { titulo: "Takt", num: true, valor: function (d) {
            return d.taktMin > 0 ? nf(d.taktMin, 2) + " min" : "—"; },
            csv: function (d) { return d.taktMin.toFixed(2); } },
          { titulo: "Operarios", num: true, valor: function (d) { return nf(d.operariosAsignados, 1); },
            csv: function (d) { return d.operariosAsignados; } },
          { titulo: "En cámara", num: true, valor: function (d) { return nf(d.disponible); },
            csv: function (d) { return d.disponible; } },
          { titulo: "Faltan", num: true, valor: function (d) {
            return d.faltante > 0 ? '<span class="etq etq-bajo">' + nf(d.faltante) + "</span>" : "—"; },
            csv: function (d) { return d.faltante; } },
          { titulo: "Carga", num: true, valor: function (d) {
            return '<span class="barra-mini barra-ancha"><span style="width:' +
              (d.participacion * 100).toFixed(1) + '%;background:' + esc(d.color) + '"></span></span> ' +
              pct(d.participacion, 0); },
            csv: function (d) { return (d.participacion * 100).toFixed(1); } }
        ], r.detalle, { vacio: "Escribe las cajas de cada línea para ver el reparto." }) +
        '<div class="acciones-fila"><button class="btn btn-plano" id="btnCsvPlan">Exportar plan a CSV</button></div>' +
        "</section>";
    } else {
      html += '<p class="vacio">Escribe cuántas cajas hay que sacar de cada línea para ver el plan.</p>';
    }

    /* Planes guardados. */
    const planes = DB.all("planes").slice().sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });
    if (planes.length) {
      html += '<section class="panel"><h2>Planes guardados</h2>' +
        UI.tabla([
          { titulo: "Fecha", valor: function (x) { return UI.fechaLarga(x.fecha); } },
          { titulo: "Cajas", num: true, valor: function (x) { return nf(x.cajasTotales); } },
          { titulo: "Carga", num: true, valor: function (x) {
            return '<span class="etq ' + (x.carga <= 1 ? "etq-ok" : "etq-bajo") + '">' + pct(x.carga) + "</span>"; } },
          { titulo: "Operarios", num: true, valor: function (x) { return nf(x.operarios); } },
          { titulo: "Registró", valor: function (x) { return esc(Indicadores.nombreUsuario(x.registradoPor)); } },
          { titulo: "", valor: function (x) {
            return '<button class="btn-mini" data-cargar-plan="' + esc(x.id) + '">Cargar</button>' +
              '<button class="btn-mini btn-mini-peligro" data-borrar-plan="' + esc(x.id) + '">Eliminar</button>'; } }
        ], planes.slice(0, 12), {}) + "</section>";
    }

    return html;
  }

  /* ============================= recepción ============================ */

  function vistaRecepcion() {
    const pendientes = DB.all("lotes").filter(function (l) { return l.estado === "Anunciado"; })
      .sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
    const pesados = Indicadores.filtrar(filtros).lotes
      .filter(function (l) { return l.cajasRecibidas !== null; })
      .sort(function (a, b) { return a.fechaRecepcion < b.fechaRecepcion ? 1 : -1; });

    let html = '<div class="vista-cab"><div><h1>Recepción y pesaje</h1>' +
      '<p class="sub">Cuenta las cajas y pesa lo que llega. Lo anunciado viene del portal del proveedor.</p></div></div>';

    html += '<section class="panel panel-destacado"><h2>Esperando en el patio (' +
      nf(pendientes.length) + ")</h2>";
    if (!pendientes.length) {
      html += '<p class="vacio">No hay lotes anunciados pendientes de pesar.</p>';
    } else {
      html += UI.tabla([
        { titulo: "Lote", valor: function (l) { return "<code>" + esc(l.codigoLote) + "</code>"; } },
        { titulo: "Anunciado", valor: function (l) { return UI.fechaCorta(l.fecha); } },
        { titulo: "Proveedor", valor: function (l) { return esc(Indicadores.nombreProveedor(l.proveedorId)); } },
        { titulo: "Línea", valor: function (l) { return UI.etiquetaLinea(l.lineaId); } },
        { titulo: "Cajas anunciadas", num: true, valor: function (l) { return nf(l.cajasAnunciadas); } },
        { titulo: "Calidad", valor: function (l) {
          return '<span class="etq etq-' + esc(l.calidadDeclarada) + '">' + esc(l.calidadDeclarada) + "</span>"; } },
        { titulo: "", valor: function (l) {
          if (!puede("pesar")) return "—";
          return '<button class="btn-mini btn-mini-accion" data-pesar="' + esc(l.id) + '">Pesar</button>' +
            '<button class="btn-mini btn-mini-peligro" data-rechazar="' + esc(l.id) + '">Rechazar</button>'; } }
      ], pendientes, {});
    }
    html += "</section>";

    html += '<h2 class="seccion-titulo">Historial de pesaje</h2>';
    html += barraFiltros({ calidad: true });

    const anun = pesados.reduce(function (a, l) { return a + l.cajasAnunciadas; }, 0);
    const real = pesados.reduce(function (a, l) { return a + l.cajasRecibidas; }, 0);
    html += '<p class="resumen-linea"><strong>' + nf(pesados.length) + "</strong> lotes · anunciadas <strong>" +
      nf(anun) + "</strong> cajas · pesadas <strong>" + nf(real) + "</strong> · diferencia <strong>" +
      pctFirmado(anun > 0 ? (real - anun) / anun : 0) + "</strong></p>";

    html += UI.tabla(columnasLote({ acciones: true }), pesados,
      { vacio: "No se ha pesado ningún lote en este período." });
    return html;
  }

  function formPesar(loteId) {
    const l = DB.get("lotes", loteId);
    if (!l || l.estado !== "Anunciado") { UI.aviso("Ese lote ya no está pendiente.", "alerta"); return; }
    const linea = DB.linea(l.lineaId);

    const campos = [
      { tipo: "html", contenido: fichaMini(l) },
      { nombre: "fechaRecepcion", etiqueta: "Fecha de llegada", tipo: "date", valor: DB.hoy(),
        requerido: true, ancho: "mitad",
        validar: function (v) {
          if (v > DB.hoy()) return "La fecha no puede ser futura.";
          if (v < l.fecha) return "La fruta no puede llegar antes de que el proveedor la enviara (" +
            UI.fechaLarga(l.fecha) + ").";
          return null;
        } },
      { nombre: "cajasRecibidas", etiqueta: "Cajas contadas", tipo: "number", requerido: true,
        min: 0, max: 10000, paso: "1", ancho: "mitad",
        valor: l.cajasAnunciadas,
        ayuda: "El proveedor anunció " + nf(l.cajasAnunciadas) + "." },
      { nombre: "kgRecibidos", etiqueta: "Peso real en báscula (kg)", tipo: "number", requerido: true,
        min: 0, max: 200000, paso: "0.1", ancho: "mitad",
        ayuda: "Lo que marca la báscula, no lo que dice la guía." },
      { nombre: "calidadVerificada", etiqueta: "Calidad verificada", tipo: "select", requerido: true,
        ancho: "mitad", valor: l.calidadDeclarada,
        opciones: DB.CALIDADES.map(function (c) { return { valor: c.id, texto: c.nombre }; }),
        ayuda: "El proveedor declaró " + l.calidadDeclarada + "." },
      { nombre: "difCalc", etiqueta: "Contraste con lo anunciado", tipo: "calculado" },
      { nombre: "observacionesRecepcion", etiqueta: "Observaciones", tipo: "textarea",
        marcador: "Temperatura, estado de los envases, novedades del transporte." }
    ];

    UI.abrirFormulario("Pesar lote " + l.codigoLote, campos, function (d) {
      DB.update("lotes", l.id, {
        fechaRecepcion: d.fechaRecepcion,
        cajasRecibidas: Number(d.cajasRecibidas),
        kgRecibidos: Number(d.kgRecibidos),
        calidadVerificada: d.calidadVerificada,
        observacionesRecepcion: d.observacionesRecepcion || "",
        recibidoPor: usuario.id,
        estado: "Recibido"
      });
      const dif = Number(d.cajasRecibidas) - l.cajasAnunciadas;
      DB.registrarBitacora(usuario.id, "Pesaje de lote",
        l.codigoLote + " · " + nf(d.cajasRecibidas) + " cajas (" +
        (dif >= 0 ? "+" : "") + nf(dif) + " contra lo anunciado)");
      UI.aviso("Lote " + l.codigoLote + " recibido. Producción ya puede procesarlo.");
      render();
    }, {
      aceptar: "Confirmar recepción",
      alCambiar: function (d, form) {
        const out = $("#difCalc", form);
        if (!out) return;
        const c = Number(d.cajasRecibidas);
        const kg = Number(d.kgRecibidos);
        if (!c) { out.textContent = "—"; out.className = ""; return; }
        const dif = c - l.cajasAnunciadas;
        const tasa = dif / l.cajasAnunciadas;
        const kgCaja = kg > 0 ? kg / c : 0;
        out.innerHTML = (dif >= 0 ? "+" : "") + nf(dif) + " cajas (" + pctFirmado(tasa) + ")" +
          (kgCaja > 0 ? ' <span class="tenue">· ' + nf(kgCaja, 2) + " kg/caja, nominal " +
            nf(linea.pesoCajaKg) + "</span>" : "");
        out.className = Math.abs(tasa) <= 0.01 ? "ok" : Math.abs(tasa) <= 0.03 ? "" : "bajo";
      }
    });
  }

  function formRechazar(loteId) {
    const l = DB.get("lotes", loteId);
    if (!l) return;
    UI.abrirFormulario("Rechazar lote " + l.codigoLote, [
      { tipo: "html", contenido: fichaMini(l) },
      { nombre: "motivo", etiqueta: "Motivo del rechazo", tipo: "textarea", requerido: true,
        marcador: "Por qué la fruta no ingresa a planta.",
        validar: function (v) {
          return v.length < 10 ? "Explica el motivo con al menos 10 caracteres: el proveedor lo verá en su portal." : null;
        } }
    ], function (d) {
      DB.update("lotes", l.id, {
        estado: "Rechazado", fechaRecepcion: DB.hoy(),
        cajasRecibidas: 0, kgRecibidos: 0, calidadVerificada: "C",
        observacionesRecepcion: d.motivo, recibidoPor: usuario.id
      });
      DB.registrarBitacora(usuario.id, "Rechazo de lote", l.codigoLote + " · " + d.motivo);
      UI.aviso("Lote " + l.codigoLote + " rechazado.", "alerta");
      render();
    }, { aceptar: "Rechazar lote",
         nota: "El proveedor verá el motivo en su portal." });
  }

  /* ============================= producción =========================== */

  function vistaProduccion() {
    const enCamara = DB.all("lotes").filter(function (l) { return l.estado === "Recibido"; })
      .sort(function (a, b) { return a.fechaRecepcion < b.fechaRecepcion ? -1 : 1; });
    const lista = Indicadores.filtrar(filtros).producciones
      .sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });

    let html = '<div class="vista-cab"><div><h1>Producción</h1>' +
      '<p class="sub">Registra lo exportable, las mermas con su causa raíz y el destino del descarte.</p></div>' +
      '<div class="cab-acciones"><button class="btn btn-plano" id="btnCsvProduccion">Exportar CSV</button></div></div>';

    html += '<section class="panel panel-destacado"><h2>En cámara, listos para procesar (' +
      nf(enCamara.length) + ")</h2>";
    if (!enCamara.length) {
      html += '<p class="vacio">No hay lotes recibidos pendientes de procesar.</p>';
    } else {
      html += UI.tabla([
        { titulo: "Lote", valor: function (l) { return "<code>" + esc(l.codigoLote) + "</code>"; } },
        { titulo: "Recibido", valor: function (l) { return UI.fechaCorta(l.fechaRecepcion); } },
        { titulo: "Proveedor", valor: function (l) { return esc(Indicadores.nombreProveedor(l.proveedorId)); } },
        { titulo: "Línea", valor: function (l) { return UI.etiquetaLinea(l.lineaId); } },
        { titulo: "Cajas", num: true, valor: function (l) { return nf(l.cajasRecibidas); } },
        { titulo: "T. estimado", num: true, valor: function (l) {
          const ln = DB.linea(l.lineaId);
          return ln ? UI.minutos(l.cajasRecibidas * ln.tiempoEstandarMin) : "—"; } },
        { titulo: "Calidad", valor: function (l) {
          return '<span class="etq etq-' + esc(l.calidadVerificada) + '">' + esc(l.calidadVerificada) + "</span>"; } },
        { titulo: "", valor: function (l) {
          return puede("procesar")
            ? '<button class="btn-mini btn-mini-accion" data-procesar="' + esc(l.id) + '">Registrar producción</button>'
            : "—"; } }
      ], enCamara, {});
    }
    html += "</section>";

    html += '<h2 class="seccion-titulo">Producción registrada</h2>';
    html += barraFiltros({});

    const proc = lista.reduce(function (a, p) { return a + p.cajasProcesadas; }, 0);
    const exp = lista.reduce(function (a, p) { return a + p.cajasExportables; }, 0);
    html += '<p class="resumen-linea"><strong>' + nf(lista.length) + "</strong> lotes · <strong>" +
      nf(proc) + "</strong> cajas procesadas · <strong>" + nf(exp) +
      "</strong> exportables · tasa <strong>" + pct(proc > 0 ? exp / proc : 0) + "</strong></p>";

    html += UI.tabla(columnasProduccion(), lista, { vacio: "No hay producción en este período." });
    return html;
  }

  function columnasProduccion() {
    return [
      { titulo: "Folio", valor: function (p) { return "<code>" + esc(p.folio) + "</code>"; },
        csv: function (p) { return p.folio; } },
      { titulo: "Fecha", valor: function (p) { return UI.fechaCorta(p.fecha); },
        csv: function (p) { return p.fecha; } },
      { titulo: "Lote", valor: function (p) { return "<code>" + esc(p.codigoLote) + "</code>"; },
        csv: function (p) { return p.codigoLote; } },
      { titulo: "Línea", valor: function (p) { return UI.etiquetaLinea(p.lineaId); },
        csv: function (p) { return Indicadores.nombreLinea(p.lineaId); } },
      { titulo: "Turno", valor: function (p) { return esc(p.turno); }, csv: function (p) { return p.turno; } },
      { titulo: "Procesadas", num: true, valor: function (p) { return nf(p.cajasProcesadas); },
        csv: function (p) { return p.cajasProcesadas; } },
      { titulo: "Exportables", num: true, valor: function (p) { return nf(p.cajasExportables); },
        csv: function (p) { return p.cajasExportables; } },
      { titulo: "Tasa", num: true, valor: function (p) {
        const t = p.cajasProcesadas > 0 ? p.cajasExportables / p.cajasProcesadas : 0;
        const l = DB.linea(p.lineaId);
        const meta = l ? l.metaExportable : 0.8;
        return '<span class="etq ' + (t >= meta ? "etq-ok" : "etq-bajo") + '">' + pct(t) + "</span>"; },
        csv: function (p) { return p.cajasProcesadas > 0 ? ((p.cajasExportables / p.cajasProcesadas) * 100).toFixed(2) : 0; } },
      { titulo: "Merma kg", num: true, valor: function (p) { return nf(Indicadores.totalMerma(p)); },
        csv: function (p) { return Indicadores.totalMerma(p); } },
      { titulo: "Aprovechado", num: true, valor: function (p) {
        const t = Indicadores.totalMerma(p);
        return t > 0 ? pct(Indicadores.mermaValorizada(p) / t) : "—"; },
        csv: function (p) {
          const t = Indicadores.totalMerma(p);
          return t > 0 ? ((Indicadores.mermaValorizada(p) / t) * 100).toFixed(1) : ""; } },
      { titulo: "Eficiencia", num: true, valor: function (p) {
        const e = p.tiempoRealMin > 0 ? Indicadores.tiempoEstandar(p) / p.tiempoRealMin : 0;
        return '<span class="etq ' + (e >= 0.95 ? "etq-ok" : "etq-bajo") + '">' + pct(e) + "</span>"; },
        csv: function (p) {
          return p.tiempoRealMin > 0 ? ((Indicadores.tiempoEstandar(p) / p.tiempoRealMin) * 100).toFixed(1) : ""; } },
      { titulo: "CR principal", valor: function (p) {
        const m = (p.mermas || []).slice().sort(function (a, b) { return b.kg - a.kg; })[0];
        if (!m) return '<span class="tenue">—</span>';
        const c = DB.causa(m.causaId);
        return '<span class="etq etq-rol">' + esc(c ? c.codigo : m.causaId) + "</span> " +
          '<small class="tenue">' + nf(m.kg) + " kg</small>"; },
        csv: function (p) {
          const m = (p.mermas || []).slice().sort(function (a, b) { return b.kg - a.kg; })[0];
          const c = m ? DB.causa(m.causaId) : null;
          return c ? c.codigo + " " + c.nombre : ""; } }
    ];
  }

  function formProcesar(loteId) {
    const l = DB.get("lotes", loteId);
    if (!l || l.estado !== "Recibido") { UI.aviso("Ese lote no está disponible.", "alerta"); return; }
    const linea = DB.linea(l.lineaId);
    const tEstandar = l.cajasRecibidas * linea.tiempoEstandarMin;

    const campos = [
      { tipo: "html", contenido: fichaMini(l) },
      { nombre: "fecha", etiqueta: "Fecha de proceso", tipo: "date", valor: DB.hoy(),
        requerido: true, ancho: "mitad",
        validar: function (v) {
          if (v > DB.hoy()) return "La fecha no puede ser futura.";
          if (v < l.fechaRecepcion) return "No se puede procesar antes de recibir el lote (" +
            UI.fechaLarga(l.fechaRecepcion) + ").";
          return null;
        } },
      { nombre: "turno", etiqueta: "Turno", tipo: "select", ancho: "mitad", valor: "Matutino",
        opciones: DB.TURNOS.map(function (t) { return { valor: t, texto: t }; }) },
      { nombre: "cajasProcesadas", etiqueta: "Cajas ingresadas a proceso", tipo: "number",
        requerido: true, min: 1, max: l.cajasRecibidas, paso: "1", ancho: "mitad",
        valor: l.cajasRecibidas,
        ayuda: "El lote trajo " + nf(l.cajasRecibidas) + " cajas." },
      { nombre: "cajasExportables", etiqueta: "Cajas exportables obtenidas", tipo: "number",
        requerido: true, min: 0, paso: "1", ancho: "mitad",
        validar: function (v, d) {
          return Number(d.cajasProcesadas) && v > Number(d.cajasProcesadas)
            ? "Lo exportable no puede superar las cajas ingresadas a proceso." : null;
        } },
      { nombre: "operarios", etiqueta: "Operarios en la línea", tipo: "number", requerido: true,
        min: 1, max: 100, paso: "1", ancho: "mitad", valor: 4 },
      { nombre: "tiempoRealMin", etiqueta: "Tiempo real de proceso (min)", tipo: "number",
        requerido: true, min: 1, paso: "1", ancho: "mitad",
        ayuda: "Estándar para este lote: " + nf(tEstandar, 0) + " min (" +
          nf(linea.tiempoEstandarMin, 2) + " min/caja " + "M)." },
      { nombre: "operador", etiqueta: "Responsable de línea", tipo: "text", requerido: true,
        valor: usuario.nombre, ancho: "mitad" },
      { nombre: "tasaCalc", etiqueta: "Tasa de exportable", tipo: "calculado", ancho: "mitad" },
      { nombre: "eficienciaCalc", etiqueta: "Eficiencia contra el estándar", tipo: "calculado", ancho: "mitad" },
      { nombre: "mermas", etiqueta: "Reparto de la merma: causa raíz y destino", tipo: "repetible",
        textoAgregar: "Agregar causa",
        ayuda: "La suma debe cuadrar con la merma total (procesado − exportable). " +
          "El destino define si el descarte se aprovecha o va a relleno.",
        columnas: [
          { nombre: "causaId", etiqueta: "Causa raíz", tipo: "select",
            opciones: function () {
              return DB.all("causas").map(function (c) {
                return { valor: c.id, texto: c.codigo + " · " + c.nombre };
              });
            } },
          { nombre: "kg", etiqueta: "kg", tipo: "number" },
          { nombre: "destinoId", etiqueta: "Destino", tipo: "select",
            opciones: function () {
              return DB.all("destinos").map(function (d) {
                return { valor: d.id, texto: d.nombre };
              });
            } }
        ],
        validar: function (v, d) {
          const proc = Number(d.cajasProcesadas) || 0;
          const expo = Number(d.cajasExportables) || 0;
          const objetivo = (proc - expo) * linea.pesoCajaKg;
          if (objetivo <= 0) return null;
          const suma = v.reduce(function (a, m) { return a + m.kg; }, 0);
          if (Math.abs(suma - objetivo) > Math.max(1, objetivo * 0.005)) {
            return "El balance no cuadra: la merma es <strong>" + nf(objetivo, 1) +
              " kg</strong> pero las causas suman <strong>" + nf(suma, 1) + " kg</strong>. " +
              "Faltan " + nf(objetivo - suma, 1) + " kg por asignar.";
          }
          const vistas = {};
          for (let i = 0; i < v.length; i += 1) {
            const clave = v[i].causaId + "|" + v[i].destinoId;
            if (vistas[clave]) return "Hay una causa y destino repetidos. Únelos en una sola fila.";
            vistas[clave] = true;
          }
          return null;
        } },
      { nombre: "observaciones", etiqueta: "Observaciones del turno", tipo: "textarea",
        marcador: "Paradas de línea, novedades, incidencias del lote." }
    ];

    UI.abrirFormulario("Procesar lote " + l.codigoLote, campos, function (d) {
      const prod = DB.insert("producciones", {
        folio: DB.siguienteFolio("producciones", "PRD"),
        fecha: d.fecha,
        loteId: l.id,
        codigoLote: l.codigoLote,
        lineaId: l.lineaId,
        turno: d.turno,
        cajasProcesadas: Number(d.cajasProcesadas),
        kgProcesados: Math.round(Number(d.cajasProcesadas) * linea.pesoCajaKg),
        cajasExportables: Number(d.cajasExportables),
        kgExportable: Math.round(Number(d.cajasExportables) * linea.pesoCajaKg),
        mermas: d.mermas,
        operarios: Number(d.operarios),
        tiempoRealMin: Number(d.tiempoRealMin),
        operador: d.operador,
        observaciones: d.observaciones || "",
        registradoPor: usuario.id,
        creadoEn: new Date().toISOString()
      });
      DB.update("lotes", l.id, { estado: "Procesado" });
      DB.registrarBitacora(usuario.id, "Registro de producción",
        prod.folio + " · lote " + l.codigoLote + " · tasa " +
        pct(prod.cajasProcesadas > 0 ? prod.cajasExportables / prod.cajasProcesadas : 0));
      UI.aviso("Producción " + prod.folio + " registrada. Pasa a Supervisión para su cierre.");
      render();
    }, {
      aceptar: "Registrar producción",
      ancho: true,
      filasIniciales: {
        mermas: [
          { causaId: "CR5", destinoId: "ds_subproducto" },
          { causaId: "CR6", destinoId: "ds_segunda" },
          { causaId: "CR8", destinoId: "ds_animal" }
        ]
      },
      alCambiar: function (d, form) {
        const proc = Number(d.cajasProcesadas) || 0;
        const expo = Number(d.cajasExportables) || 0;
        const real = Number(d.tiempoRealMin) || 0;

        const outT = $("#tasaCalc", form);
        if (outT) {
          if (proc <= 0 || expo <= 0) { outT.textContent = "—"; outT.className = ""; }
          else {
            const t = expo / proc;
            outT.textContent = pct(t) + (t >= linea.metaExportable ? " ✓ sobre la meta" : " ✕ bajo la meta");
            outT.className = t >= linea.metaExportable ? "ok" : "bajo";
          }
        }

        const outE = $("#eficienciaCalc", form);
        if (outE) {
          const est = proc * linea.tiempoEstandarMin;
          if (proc <= 0 || real <= 0) { outE.textContent = "—"; outE.className = ""; }
          else {
            const ef = est / real;
            outE.textContent = pct(ef) + " · estándar " + nf(est, 0) + " min";
            outE.className = ef >= 0.95 ? "ok" : "bajo";
          }
        }

        const balance = $("[data-balance]", form);
        if (balance) {
          const objetivo = (proc - expo) * linea.pesoCajaKg;
          const suma = UI.leerRepetible(form, "mermas", [
            { nombre: "causaId", tipo: "select" }, { nombre: "kg", tipo: "number" },
            { nombre: "destinoId", tipo: "select" }
          ]).reduce(function (a, m) { return a + m.kg; }, 0);
          if (objetivo <= 0) {
            balance.className = "balance";
            balance.innerHTML = "Indica primero las cajas procesadas y exportables.";
          } else {
            const falta = objetivo - suma;
            const ok = Math.abs(falta) <= Math.max(1, objetivo * 0.005);
            balance.className = "balance " + (ok ? "balance-ok" : "balance-pendiente");
            balance.innerHTML = "Merma total: <strong>" + nf(objetivo, 1) + " kg</strong> · asignado: " +
              "<strong>" + nf(suma, 1) + " kg</strong> · " +
              (ok ? "balance de masa cuadrado ✓"
                  : (falta > 0 ? "faltan <strong>" + nf(falta, 1) + " kg</strong>"
                               : "sobran <strong>" + nf(-falta, 1) + " kg</strong>"));
          }
        }
      }
    });
  }

  /* ================================ lotes ============================= */

  function columnasLote(o) {
    o = o || {};
    const cols = [
      { titulo: "Lote", valor: function (l) {
        return "<code>" + esc(l.codigoLote) + "</code><br><small class='tenue'>" + esc(l.folio) + "</small>"; },
        csv: function (l) { return l.codigoLote; } },
      { titulo: "Anunciado", valor: function (l) { return UI.fechaCorta(l.fecha); },
        csv: function (l) { return l.fecha; } },
      { titulo: "Proveedor", valor: function (l) { return esc(Indicadores.nombreProveedor(l.proveedorId)); },
        csv: function (l) { return Indicadores.nombreProveedor(l.proveedorId); } },
      { titulo: "Línea", valor: function (l) { return UI.etiquetaLinea(l.lineaId); },
        csv: function (l) { return Indicadores.nombreLinea(l.lineaId); } },
      { titulo: "Anunciadas", num: true, valor: function (l) { return nf(l.cajasAnunciadas); },
        csv: function (l) { return l.cajasAnunciadas; } },
      { titulo: "Pesadas", num: true, valor: function (l) {
        return l.cajasRecibidas === null ? '<span class="tenue">—</span>' : nf(l.cajasRecibidas); },
        csv: function (l) { return l.cajasRecibidas === null ? "" : l.cajasRecibidas; } },
      { titulo: "Diferencia", num: true, valor: function (l) {
        if (l.cajasRecibidas === null || !l.cajasAnunciadas) return '<span class="tenue">—</span>';
        const d = (l.cajasRecibidas - l.cajasAnunciadas) / l.cajasAnunciadas;
        const clase = Math.abs(d) <= 0.01 ? "etq-ok" : Math.abs(d) <= 0.03 ? "etq-B" : "etq-bajo";
        return '<span class="etq ' + clase + '">' + pctFirmado(d) + "</span>"; },
        csv: function (l) {
          if (l.cajasRecibidas === null || !l.cajasAnunciadas) return "";
          return (((l.cajasRecibidas - l.cajasAnunciadas) / l.cajasAnunciadas) * 100).toFixed(2); } },
      { titulo: "Calidad", valor: function (l) {
        const c = l.calidadVerificada || l.calidadDeclarada;
        const bajo = l.calidadVerificada && l.calidadVerificada !== l.calidadDeclarada;
        return '<span class="etq etq-' + esc(c) + '">' + esc(c) + "</span>" +
          (bajo ? ' <small class="tenue" title="Bajó respecto a lo declarado">↓' + esc(l.calidadDeclarada) + "</small>" : ""); },
        csv: function (l) { return l.calidadVerificada || l.calidadDeclarada; } },
      { titulo: "Estado", valor: function (l) { return UI.insignia(l.estado); },
        csv: function (l) { return l.estado; } }
    ];

    if (o.acciones !== false) {
      cols.push({ titulo: "", valor: accionesLote, csv: function () { return ""; } });
    }
    return cols;
  }

  function accionesLote(l) {
    let b = '<button class="btn-mini" data-ficha="' + esc(l.id) + '">Ficha</button>';
    if (l.estado === "Anunciado" && puede("pesar")) {
      b += '<button class="btn-mini btn-mini-accion" data-pesar="' + esc(l.id) + '">Pesar</button>';
    }
    if (l.estado === "Recibido" && puede("procesar")) {
      b += '<button class="btn-mini btn-mini-accion" data-procesar="' + esc(l.id) + '">Procesar</button>';
    }
    if (l.estado === "Procesado" && puede("cerrar")) {
      b += '<button class="btn-mini btn-mini-accion" data-cerrar="' + esc(l.id) + '">Cerrar</button>';
    }
    if (l.estado === "Cerrado" && puede("reabrir")) {
      b += '<button class="btn-mini" data-reabrir="' + esc(l.id) + '">Reabrir</button>';
    }
    if (l.estado === "Cerrado" && !l.reporteEnviado && puede("enviar_reporte")) {
      b += '<button class="btn-mini" data-enviar="' + esc(l.id) + '">Enviar reporte</button>';
    }
    return b;
  }

  function vistaLotes() {
    const lista = Indicadores.filtrar(filtros).lotes
      .sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });

    let html = '<div class="vista-cab"><div><h1>Lotes</h1>' +
      '<p class="sub">Recorrido completo, del anuncio del proveedor al cierre.</p></div>' +
      '<div class="cab-acciones"><button class="btn btn-plano" id="btnCsvLotes">Exportar CSV</button></div></div>';

    html += barraFiltros({ calidad: true, estado: true });

    const anun = lista.reduce(function (a, l) { return a + l.cajasAnunciadas; }, 0);
    const rec = lista.reduce(function (a, l) { return a + (l.cajasRecibidas || 0); }, 0);
    html += '<p class="resumen-linea"><strong>' + nf(lista.length) + "</strong> lotes · anunciadas <strong>" +
      nf(anun) + "</strong> cajas · pesadas <strong>" + nf(rec) + "</strong></p>";

    html += UI.tabla(columnasLote({}), lista, { vacio: "No hay lotes en este período." });
    return html;
  }

  /* ----------------------------------------------------- ficha del lote */

  function fichaMini(l) {
    return '<div class="ficha-mini">' +
      "<div><span>Lote</span><strong>" + esc(l.codigoLote) + "</strong></div>" +
      "<div><span>Proveedor</span><strong>" + esc(Indicadores.nombreProveedor(l.proveedorId)) + "</strong></div>" +
      "<div><span>Línea</span><strong>" + esc(Indicadores.nombreLinea(l.lineaId)) + "</strong></div>" +
      "<div><span>Anunciadas</span><strong>" + nf(l.cajasAnunciadas) + " cajas</strong></div>" +
      (l.cajasRecibidas !== null
        ? "<div><span>Pesadas</span><strong>" + nf(l.cajasRecibidas) + " cajas</strong></div>" : "") +
      "</div>";
  }

  function fichaCompleta(f) {
    if (!f) return "<p>Lote no encontrado.</p>";
    const l = f.lote, p = f.produccion;
    let html = '<div class="ficha"><div class="ficha-linea">';

    [["Anunciado", l.fecha, true, Indicadores.nombreUsuario(l.anunciadoPor)],
     [l.estado === "Rechazado" ? "Rechazado" : "Pesado", l.fechaRecepcion,
      l.cajasRecibidas !== null, Indicadores.nombreUsuario(l.recibidoPor)],
     ["Procesado", p ? p.fecha : null, !!p, p ? p.operador : ""],
     ["Cerrado", l.fechaCierre, l.estado === "Cerrado", Indicadores.nombreUsuario(l.cerradoPor)]
    ].forEach(function (h, i) {
      html += '<div class="ficha-hito' + (h[2] ? " hito-hecho" : "") + '">' +
        '<span class="hito-punto">' + (i + 1) + "</span><strong>" + esc(h[0]) + "</strong>" +
        "<small>" + (h[1] ? UI.fechaLarga(h[1]) + "<br>" + esc(h[3] || "") : "Pendiente") + "</small></div>";
    });
    html += "</div><div class='ficha-bloques'>";

    html += "<section><h4>Identificación</h4><dl>" +
      "<dt>Lote</dt><dd><code>" + esc(l.codigoLote) + "</code></dd>" +
      "<dt>Folio</dt><dd>" + esc(l.folio) + "</dd>" +
      "<dt>Proveedor</dt><dd>" + esc(f.proveedor ? f.proveedor.nombre : "—") + "</dd>" +
      "<dt>Línea</dt><dd>" + esc(f.linea ? f.linea.nombre : "—") + "</dd>" +
      "<dt>Transporte</dt><dd>" + esc(l.transporte) + "</dd>" +
      "<dt>Estado</dt><dd>" + UI.insignia(l.estado) + "</dd></dl></section>";

    html += "<section><h4>Cajas y calidad</h4><dl>" +
      "<dt>Anunciadas</dt><dd>" + nf(l.cajasAnunciadas) + " (calidad " + esc(l.calidadDeclarada) + ")</dd>" +
      "<dt>Pesadas</dt><dd>" + (l.cajasRecibidas === null ? "—" :
        nf(l.cajasRecibidas) + " (calidad " + esc(l.calidadVerificada) + ")") + "</dd>" +
      "<dt>Peso real</dt><dd>" + (l.kgRecibidos === null ? "—" : nf(l.kgRecibidos) + " kg") + "</dd>" +
      "<dt>Diferencia</dt><dd>" + (f.diferenciaCajas === null ? "—" :
        '<span class="etq ' + (Math.abs(f.tasaDiferencia) <= 0.01 ? "etq-ok" : "etq-bajo") + '">' +
        (f.diferenciaCajas >= 0 ? "+" : "") + nf(f.diferenciaCajas) + " · " +
        pctFirmado(f.tasaDiferencia) + "</span>") + "</dd>" +
      "<dt>Precio</dt><dd>" + money(l.precioCaja) + " / caja</dd>" +
      "<dt>A liquidar</dt><dd><strong>" + money(f.valor) + "</strong></dd></dl></section>";

    if (p) {
      html += "<section><h4>Resultado del proceso</h4><dl>" +
        "<dt>Procesadas</dt><dd>" + nf(p.cajasProcesadas) + " cajas</dd>" +
        "<dt>Exportables</dt><dd><strong>" + nf(p.cajasExportables) + " cajas</strong></dd>" +
        "<dt>Tasa</dt><dd>" + '<span class="etq ' + (f.tasaExportable >= f.meta ? "etq-ok" : "etq-bajo") +
        '">' + pct(f.tasaExportable) + "</span> (meta " + pct(f.meta) + ")</dd>" +
        "<dt>Tiempo real</dt><dd>" + UI.minutos(p.tiempoRealMin) + "</dd>" +
        "<dt>Estándar</dt><dd>" + UI.minutos(f.tiempoEstandarMin) + "</dd>" +
        "<dt>Eficiencia</dt><dd>" + '<span class="etq ' + (f.eficiencia >= 0.95 ? "etq-ok" : "etq-bajo") +
        '">' + pct(f.eficiencia) + "</span></dd>" +
        "<dt>Turno</dt><dd>" + esc(p.turno) + " · " + nf(p.operarios) + " operarios</dd></dl></section>";

      html += "<section><h4>Economía circular</h4><dl>" +
        "<dt>Merma</dt><dd>" + nf(f.kgMerma) + " kg</dd>" +
        "<dt>Aprovechado</dt><dd><strong>" + nf(f.kgValorizado) + " kg</strong> (" +
        pct(f.tasaValorizacion) + ")</dd>" +
        "<dt>A relleno</dt><dd>" + nf(f.kgMerma - f.kgValorizado) + " kg</dd>" +
        "<dt>Valor recuperado</dt><dd>" + money(f.valorDescarte) + "</dd></dl></section>";

      if (f.mermas.length) {
        html += '<section class="ficha-mermas"><h4>Reparto de la merma</h4><ul class="lista-mermas">';
        f.mermas.forEach(function (m) {
          const c = DB.causa(m.causaId), d = DB.destino(m.destinoId);
          const parte = f.kgMerma > 0 ? m.kg / f.kgMerma : 0;
          html += "<li><span><strong>" + esc(c ? c.codigo : "?") + "</strong> " +
            esc(c ? c.nombre : m.causaId) + '<br><small class="tenue">→ ' +
            esc(d ? d.nombre : "—") + (d && !d.valoriza ? " ⚠" : "") + "</small></span>" +
            '<span class="barra-mini"><span style="width:' + (parte * 100).toFixed(1) + '%"></span></span>' +
            "<strong>" + nf(m.kg) + " kg</strong></li>";
        });
        html += "</ul></section>";
      }
    }

    const notas = [];
    if (l.observacionesProveedor) notas.push("<strong>Proveedor:</strong> " + esc(l.observacionesProveedor));
    if (l.observacionesRecepcion) notas.push("<strong>Recepción:</strong> " + esc(l.observacionesRecepcion));
    if (p && p.observaciones) notas.push("<strong>Producción:</strong> " + esc(p.observaciones));
    if (notas.length) {
      html += '<section class="ficha-notas"><h4>Observaciones</h4><p>' + notas.join("</p><p>") + "</p></section>";
    }

    html += "</div></div>";
    return html;
  }

  function verFicha(loteId) {
    const f = Indicadores.fichaLote(loteId);
    if (!f) return;
    abrirPanel("Ficha del lote " + f.lote.codigoLote, fichaCompleta(f), true);
  }

  function abrirPanel(titulo, cuerpo, imprimible) {
    const capa = document.createElement("div");
    capa.className = "modal-capa";
    capa.innerHTML = '<div class="modal modal-ancho" role="dialog" aria-modal="true" aria-labelledby="panelTitulo">' +
      '<header class="modal-cab"><h2 id="panelTitulo">' + esc(titulo) + "</h2>" +
      '<button type="button" class="modal-x" aria-label="Cerrar">&times;</button></header>' +
      '<div class="modal-cuerpo modal-cuerpo-libre">' + cuerpo + "</div>" +
      '<footer class="modal-pie modal-pie-fijo">' +
      '<button type="button" class="btn btn-plano" data-cancelar>Cerrar</button>' +
      (imprimible ? '<button type="button" class="btn btn-sec" id="btnImprimirFicha">Imprimir</button>' : "") +
      "</footer></div>";

    document.body.appendChild(capa);
    document.body.classList.add("sin-scroll");

    function cerrar() {
      capa.remove();
      document.body.classList.remove("sin-scroll");
      document.body.classList.remove("imprimiendo-ficha");
      document.removeEventListener("keydown", onEsc);
    }
    function onEsc(e) { if (e.key === "Escape") cerrar(); }
    document.addEventListener("keydown", onEsc);
    $(".modal-x", capa).addEventListener("click", cerrar);
    $("[data-cancelar]", capa).addEventListener("click", cerrar);
    capa.addEventListener("mousedown", function (e) { if (e.target === capa) cerrar(); });
    const imp = $("#btnImprimirFicha", capa);
    if (imp) {
      imp.addEventListener("click", function () {
        document.body.classList.add("imprimiendo-ficha");
        window.print();
        setTimeout(function () { document.body.classList.remove("imprimiendo-ficha"); }, 800);
      });
    }
  }

  function cerrarLote(loteId) {
    const l = DB.get("lotes", loteId);
    if (!l || l.estado !== "Procesado") return;
    const f = Indicadores.fichaLote(loteId);

    UI.abrirFormulario("Cerrar lote " + l.codigoLote, [
      { tipo: "html", contenido: fichaCompleta(f) },
      { nombre: "enviar", etiqueta: "", tipo: "checkbox", valor: true,
        textoCheck: "Publicar el reporte en el portal del proveedor" }
    ], function (d) {
      DB.update("lotes", l.id, {
        estado: "Cerrado", fechaCierre: DB.hoy(), cerradoPor: usuario.id,
        reporteEnviado: !!d.enviar, fechaReporte: d.enviar ? DB.hoy() : null
      });
      DB.registrarBitacora(usuario.id, "Cierre de lote",
        l.codigoLote + (d.enviar ? " · reporte publicado al proveedor" : " · sin publicar reporte"));
      UI.aviso("Lote " + l.codigoLote + " cerrado.");
      render();
    }, { aceptar: "Cerrar lote", ancho: true,
         nota: "Una vez cerrado, el lote <strong>no admite más cambios</strong> de ningún rol." });
  }

  /* ============================== reportes ============================ */

  const REPORTES = {
    proveedor: {
      titulo: "Consolidado por proveedor",
      descripcion: "Volumen, exactitud al declarar, calidad y resultado en planta. " +
        "Sostiene la liquidación y hace visible la variabilidad de proveedor (CR6).",
      datos: function () { return Indicadores.porProveedor(filtros); },
      columnas: [
        { titulo: "Proveedor", valor: function (m) { return "<strong>" + esc(m.nombre) + "</strong>"; },
          csv: function (m) { return m.nombre; } },
        { titulo: "Lotes", num: true, valor: function (m) { return nf(m.lotes); }, csv: function (m) { return m.lotes; } },
        { titulo: "Anunciadas", num: true, valor: function (m) { return nf(m.cajasAnunciadas); },
          csv: function (m) { return m.cajasAnunciadas; } },
        { titulo: "Pesadas", num: true, valor: function (m) { return nf(m.cajasRecibidas); },
          csv: function (m) { return m.cajasRecibidas; } },
        { titulo: "Exactitud", num: true, valor: function (m) {
          const clase = Math.abs(m.tasaDiferencia) <= 0.01 ? "etq-ok" : "etq-bajo";
          return '<span class="etq ' + clase + '">' + pctFirmado(m.tasaDiferencia) + "</span>"; },
          csv: function (m) { return (m.tasaDiferencia * 100).toFixed(2); } },
        { titulo: "% Calidad A", num: true, valor: function (m) { return pct(m.pctCalidadA); },
          csv: function (m) { return (m.pctCalidadA * 100).toFixed(2); } },
        { titulo: "% Rechazo", num: true, valor: function (m) { return pct(m.tasaRechazo); },
          csv: function (m) { return (m.tasaRechazo * 100).toFixed(2); } },
        { titulo: "Exportable", num: true, valor: function (m) { return pct(m.tasaExportable); },
          csv: function (m) { return (m.tasaExportable * 100).toFixed(2); } },
        { titulo: "Variabilidad", num: true, valor: function (m) {
          const clase = m.indiceVariabilidad < 0.06 ? "etq-ok" : m.indiceVariabilidad < 0.14 ? "etq-B" : "etq-bajo";
          return '<span class="etq ' + clase + '">' + nf(m.indiceVariabilidad, 3) + "</span>"; },
          csv: function (m) { return m.indiceVariabilidad.toFixed(4); } },
        { titulo: "A liquidar", num: true, valor: function (m) { return "<strong>" + money(m.valor) + "</strong>"; },
          csv: function (m) { return m.valor.toFixed(2); } }
      ]
    },
    causas: {
      titulo: "Pérdidas por causa raíz",
      descripcion: "Pareto de las ocho causas del diagnóstico, con el valor económico " +
        "que cada una se lleva.",
      datos: function () { return Indicadores.porCausaRaiz(filtros); },
      columnas: [
        { titulo: "Código", valor: function (m) {
          return '<span class="etq ' + (m.principal ? "etq-bajo" : "etq-rol") + '">' + esc(m.codigo) + "</span>"; },
          csv: function (m) { return m.codigo; } },
        { titulo: "Causa", valor: function (m) {
          return "<strong>" + esc(m.nombre) + "</strong>" +
            (m.definida ? "" : ' <small class="tenue">(por definir)</small>'); },
          csv: function (m) { return m.nombre; } },
        { titulo: "Origen", valor: function (m) { return esc(m.origen); }, csv: function (m) { return m.origen; } },
        { titulo: "kg perdidos", num: true, valor: function (m) { return nf(m.kg); }, csv: function (m) { return m.kg; } },
        { titulo: "% del total", num: true, valor: function (m) { return pct(m.porcentaje); },
          csv: function (m) { return (m.porcentaje * 100).toFixed(2); } },
        { titulo: "% acumulado", num: true, valor: function (m) {
          return '<span class="etq ' + (m.acumulado <= 0.8 ? "etq-bajo" : "etq-ok") + '">' + pct(m.acumulado) + "</span>"; },
          csv: function (m) { return (m.acumulado * 100).toFixed(2); } },
        { titulo: "Valor perdido", num: true, valor: function (m) { return money(m.valorPerdido); },
          csv: function (m) { return m.valorPerdido.toFixed(2); } }
      ]
    },
    circular: {
      titulo: "Economía circular",
      descripcion: "Qué se hace con el descarte y cuánto valor se recupera por cada destino.",
      datos: function () { return Indicadores.porDestino(filtros); },
      columnas: [
        { titulo: "Destino", valor: function (m) { return "<strong>" + esc(m.nombre) + "</strong>"; },
          csv: function (m) { return m.nombre; } },
        { titulo: "Aprovecha", valor: function (m) {
          return m.valoriza ? '<span class="etq etq-ok">Sí</span>' : '<span class="etq etq-bajo">No</span>'; },
          csv: function (m) { return m.valoriza ? "Sí" : "No"; } },
        { titulo: "kg", num: true, valor: function (m) { return nf(m.kg); }, csv: function (m) { return m.kg; } },
        { titulo: "$/kg", num: true, valor: function (m) { return money(m.valorKg) + " " + UI.origen("E"); },
          csv: function (m) { return m.valorKg; } },
        { titulo: "Valor", num: true, valor: function (m) { return money(m.valor); },
          csv: function (m) { return m.valor.toFixed(2); } }
      ]
    },
    lineas: {
      titulo: "Desempeño por línea",
      descripcion: "Tasa de exportable contra meta, eficiencia contra el estudio de tiempos " +
        "y aprovechamiento del descarte, para cada línea de producto.",
      datos: function () { return Indicadores.porLinea(filtros); },
      columnas: [
        { titulo: "Línea", valor: function (m) { return UI.etiquetaLinea(m.lineaId); },
          csv: function (m) { return m.nombre; } },
        { titulo: "Recibidas", num: true, valor: function (m) { return nf(m.cajasRecibidas); },
          csv: function (m) { return m.cajasRecibidas; } },
        { titulo: "Procesadas", num: true, valor: function (m) { return nf(m.cajasProcesadas); },
          csv: function (m) { return m.cajasProcesadas; } },
        { titulo: "Exportables", num: true, valor: function (m) { return nf(m.cajasExportables); },
          csv: function (m) { return m.cajasExportables; } },
        { titulo: "Tasa", num: true, valor: function (m) { return pct(m.tasaExportable); },
          csv: function (m) { return (m.tasaExportable * 100).toFixed(2); } },
        { titulo: "Meta", num: true, valor: function (m) { return pct(m.meta); },
          csv: function (m) { return (m.meta * 100).toFixed(2); } },
        { titulo: "Brecha", num: true, valor: function (m) {
          return '<span class="etq ' + (m.brecha >= 0 ? "etq-ok" : "etq-bajo") + '">' + pctFirmado(m.brecha) + "</span>"; },
          csv: function (m) { return (m.brecha * 100).toFixed(2); } },
        { titulo: "T. estándar", num: true, valor: function (m) { return nf(m.tiempoEstandarMin, 2) + " min"; },
          csv: function (m) { return m.tiempoEstandarMin; } },
        { titulo: "Min/caja real", num: true, valor: function (m) { return nf(m.minutosPorCaja, 2); },
          csv: function (m) { return m.minutosPorCaja.toFixed(2); } },
        { titulo: "Eficiencia", num: true, valor: function (m) { return pct(m.eficiencia); },
          csv: function (m) { return (m.eficiencia * 100).toFixed(2); } },
        { titulo: "Aprovechado", num: true, valor: function (m) { return pct(m.tasaValorizacion); },
          csv: function (m) { return (m.tasaValorizacion * 100).toFixed(2); } }
      ]
    },
    lotes: {
      titulo: "Detalle de lotes",
      descripcion: "Trazabilidad línea por línea, del anuncio del proveedor al cierre.",
      datos: function () { return Indicadores.filtrar(filtros).lotes; },
      columnas: null
    },
    produccion: {
      titulo: "Detalle de producción",
      descripcion: "Cada lote procesado, con su tasa, su merma y su causa principal.",
      datos: function () { return Indicadores.filtrar(filtros).producciones; },
      columnas: null
    }
  };

  function columnasReporte(tipo) {
    if (tipo === "lotes") return columnasLote({ acciones: false });
    if (tipo === "produccion") return columnasProduccion();
    return REPORTES[tipo].columnas;
  }

  function vistaReportes() {
    const def = REPORTES[reporteActual];
    const datos = def.datos();
    const k = Indicadores.calcular(filtros);

    let html = '<div class="vista-cab"><div><h1>Reportes</h1>' +
      '<p class="sub">Consolidados para el documento y para la empresa.</p></div>' +
      '<div class="cab-acciones">' +
      '<button class="btn btn-plano" id="btnCsvReporte">Exportar CSV</button>' +
      '<button class="btn btn-primario" id="btnImprimir">Imprimir / PDF</button></div></div>';

    html += '<div class="selector-reporte" role="tablist">';
    Object.keys(REPORTES).forEach(function (id) {
      html += '<button type="button" role="tab" class="chip chip-grande' +
        (id === reporteActual ? " chip-activo" : "") + '" data-reporte="' + id + '"' +
        ' aria-selected="' + (id === reporteActual) + '">' + esc(REPORTES[id].titulo) + "</button>";
    });
    html += "</div>";

    html += barraFiltros({ calidad: reporteActual === "lotes", estado: reporteActual === "lotes" });

    html += '<section class="hoja" id="hojaReporte">';
    html += '<header class="hoja-cab"><div>' +
      '<p class="hoja-empresa">' + esc(DB.EMPRESA.razonSocial) + "</p>" +
      "<h2>" + esc(def.titulo) + "</h2>" +
      '<p class="sub">' + esc(def.descripcion) + "</p></div>" +
      '<div class="hoja-meta"><p><strong>Período:</strong> ' + UI.fechaLarga(filtros.desde) +
      " — " + UI.fechaLarga(filtros.hasta) + "</p>" +
      "<p><strong>Emitido:</strong> " + UI.fechaLarga(DB.hoy()) + "</p>" +
      "<p><strong>Por:</strong> " + esc(usuario.nombre) + "</p></div></header>";

    html += '<div class="hoja-kpis">' +
      '<div><span>Cajas recibidas</span><strong>' + nf(k.cajasRecibidas) + "</strong></div>" +
      '<div><span>Exportables</span><strong>' + nf(k.cajasExportables) + "</strong></div>" +
      '<div><span>Tasa exportable</span><strong>' + pct(k.tasaExportable) + "</strong></div>" +
      '<div><span>Merma</span><strong>' + pct(k.tasaMerma) + "</strong></div>" +
      '<div><span>Aprovechado</span><strong>' + pct(k.tasaValorizacion) + "</strong></div>" +
      '<div><span>Eficiencia</span><strong>' + pct(k.eficienciaTiempo) + "</strong></div>" +
      '<div><span>Pérdida</span><strong>' + money(k.perdidaEconomica) + "</strong></div>" +
      "</div>";

    if (reporteActual === "causas") {
      html += '<div class="hoja-grafico">' + Graficos.pareto(datos, {
        ejeX: function (d) { return d.codigo; },
        color: function (d) { return d.principal ? "#c0246b" : d.definida ? "#c85a1e" : "#8b96a3"; },
        leyenda: [["Principal", "#c0246b"], ["Definida", "#c85a1e"], ["Por definir", "#8b96a3"]]
      }) + "</div>";
    }

    html += UI.tabla(columnasReporte(reporteActual), datos,
      { vacio: "No hay información para el filtro seleccionado." });

    html += '<footer class="hoja-pie"><p>' + esc(DB.EMPRESA.sistema) + " · " +
      esc(DB.EMPRESA.descripcion) + " · Documento generado el " + UI.fechaLarga(DB.hoy()) + ".</p>" +
      '<p class="hoja-origenes">Origen de los parámetros: ' + UI.origen("M") + " medido · " +
      UI.origen("E") + " estimado · " + UI.origen("S") + " fuente secundaria.</p></footer>";
    html += "</section>";
    return html;
  }

  /* ============================== catálogos =========================== */

  function vistaCatalogos() {
    const p = DB.parametros();

    let html = '<div class="vista-cab"><div><h1>Parámetros del sistema</h1>' +
      '<p class="sub">Los valores que alimentan todos los cálculos. Cada uno declara su origen.</p></div></div>';

    html += '<p class="nota-info"><strong>Origen del dato:</strong> ' +
      UI.origen("M") + " medido en planta · " + UI.origen("E") + " estimado, pendiente de confirmar · " +
      UI.origen("S") + " tomado de fuente secundaria. Los marcados con E deben validarse con la " +
      "empresa antes de usarse en el documento.</p>";

    /* --- líneas --- */
    html += '<section class="panel"><h2>Líneas de producto</h2>' +
      UI.tabla([
        { titulo: "Línea", valor: function (l) { return UI.etiquetaLinea(l.id); } },
        { titulo: "Código", valor: function (l) { return "<code>" + esc(l.codigo) + "</code>"; } },
        { titulo: "T. estándar", num: true, valor: function (l) {
          return nf(l.tiempoEstandarMin, 2) + " min " + UI.origen(l.origenTiempo); } },
        { titulo: "kg/caja", num: true, valor: function (l) {
          return nf(l.pesoCajaKg) + " " + UI.origen(l.origenPeso); } },
        { titulo: "Meta exportable", num: true, valor: function (l) {
          return pct(l.metaExportable) + " " + UI.origen(l.origenMeta); } },
        { titulo: "Precio/caja", num: true, valor: function (l) {
          return money(l.precioCaja) + " " + UI.origen(l.origenPrecio); } },
        { titulo: "Estado", valor: function (l) {
          return '<span class="estado estado-' + (l.activa ? "recibido" : "inactivo") + '">' +
            (l.activa ? "Activa" : "Inactiva") + "</span>"; } },
        { titulo: "", valor: function (l) {
          return '<button class="btn-mini" data-editar-linea="' + esc(l.id) + '">Editar</button>'; } }
      ], DB.all("lineas"), {}) + "</section>";

    /* --- causas raíz --- */
    const sinDefinir = DB.all("causas").filter(function (c) { return !c.definida; }).length;
    html += '<section class="panel"><h2>Causas raíz del diagnóstico</h2>';
    if (sinDefinir > 0) {
      html += '<p class="aviso-inline">Hay <strong>' + sinDefinir + " causas sin definir</strong>. " +
        "El documento del TIC solo nombra CR5 a CR8; las demás debes completarlas tú con " +
        "los nombres reales de tu diagnóstico.</p>";
    }
    html += UI.tabla([
      { titulo: "Código", valor: function (c) {
        return '<span class="etq ' + (c.principal ? "etq-bajo" : "etq-rol") + '">' + esc(c.codigo) + "</span>"; } },
      { titulo: "Nombre", valor: function (c) {
        return c.definida ? "<strong>" + esc(c.nombre) + "</strong>"
          : '<em class="tenue">' + esc(c.nombre) + "</em>"; } },
      { titulo: "Origen", valor: function (c) { return esc(c.origen); } },
      { titulo: "Principal", valor: function (c) {
        return c.principal ? '<span class="etq etq-bajo">Sí</span>' : "—"; } },
      { titulo: "Descripción", valor: function (c) { return '<small>' + esc(c.descripcion) + "</small>"; } },
      { titulo: "", valor: function (c) {
        return '<button class="btn-mini" data-editar-causa="' + esc(c.id) + '">Editar</button>'; } }
    ], DB.all("causas"), {}) + "</section>";

    /* --- destinos --- */
    html += '<section class="panel"><h2>Destinos del descarte</h2>' +
      '<p class="sub panel-sub">La jerarquía de valorización. Todo lo que no va a relleno ' +
      "sanitario cuenta como aprovechado.</p>" +
      UI.tabla([
        { titulo: "Nivel", num: true, valor: function (d) { return nf(d.nivel); } },
        { titulo: "Destino", valor: function (d) { return "<strong>" + esc(d.nombre) + "</strong>"; } },
        { titulo: "Aprovecha", valor: function (d) {
          return d.valoriza ? '<span class="etq etq-ok">Sí</span>' : '<span class="etq etq-bajo">No</span>'; } },
        { titulo: "$/kg", num: true, valor: function (d) {
          return money(d.valorKg) + " " + UI.origen(d.origenValor); } },
        { titulo: "", valor: function (d) {
          return '<button class="btn-mini" data-editar-destino="' + esc(d.id) + '">Editar</button>'; } }
      ], DB.all("destinos"), {}) + "</section>";

    /* --- parámetros de planta --- */
    html += '<section class="panel"><h2>Parámetros de planta</h2>' +
      '<p class="sub panel-sub">Alimentan el planificador diario.</p>' +
      '<div class="conteos">' +
      '<div><span>Horas de turno</span><strong>' + nf(p.horasTurno) + " h " + UI.origen(p.origenHorasTurno) + "</strong></div>" +
      '<div><span>Operarios</span><strong>' + nf(p.operariosDisponibles) + " " + UI.origen(p.origenOperarios) + "</strong></div>" +
      '<div><span>Eficiencia</span><strong>' + pct(p.eficienciaPlanta) + " " + UI.origen(p.origenEficiencia) + "</strong></div>" +
      '<div><span>Suplementos OIT</span><strong>' + pct(p.suplementosOIT) + " " + UI.origen(p.origenSuplementos) + "</strong></div>" +
      '<div><span>Costo hora-hombre</span><strong>' + money(p.costoHoraHombre) + " " + UI.origen(p.origenCostoHora) + "</strong></div>" +
      "</div>" +
      '<div class="acciones-fila"><button class="btn btn-primario" id="btnEditarParametros">Editar parámetros</button></div>' +
      "</section>";

    return html;
  }

  function formLinea(id) {
    const l = DB.linea(id);
    if (!l) return;
    const ops = DB.ORIGENES.map(function (o) { return { valor: o.id, texto: o.id + " — " + o.nombre }; });

    UI.abrirFormulario("Editar " + l.nombre, [
      { nombre: "nombre", etiqueta: "Nombre", tipo: "text", requerido: true, valor: l.nombre, ancho: "mitad" },
      { nombre: "codigo", etiqueta: "Código", tipo: "text", requerido: true, valor: l.codigo, ancho: "mitad" },
      { tipo: "separador", etiqueta: "Estudio de tiempos" },
      { nombre: "tiempoEstandarMin", etiqueta: "Tiempo estándar (min/caja)", tipo: "number",
        requerido: true, min: 0.1, paso: "0.01", valor: l.tiempoEstandarMin, ancho: "mitad" },
      { nombre: "origenTiempo", etiqueta: "Origen", tipo: "select", opciones: ops,
        valor: l.origenTiempo, ancho: "mitad" },
      { tipo: "separador", etiqueta: "Unidad de flujo" },
      { nombre: "pesoCajaKg", etiqueta: "Peso por caja (kg)", tipo: "number", requerido: true,
        min: 0.1, paso: "0.1", valor: l.pesoCajaKg, ancho: "mitad" },
      { nombre: "origenPeso", etiqueta: "Origen", tipo: "select", opciones: ops,
        valor: l.origenPeso, ancho: "mitad" },
      { tipo: "separador", etiqueta: "Metas y precio" },
      { nombre: "metaExportable", etiqueta: "Meta de exportable (0 a 1)", tipo: "number",
        requerido: true, min: 0, max: 1, paso: "0.01", valor: l.metaExportable, ancho: "mitad" },
      { nombre: "origenMeta", etiqueta: "Origen", tipo: "select", opciones: ops,
        valor: l.origenMeta, ancho: "mitad" },
      { nombre: "precioCaja", etiqueta: "Precio por caja ($)", tipo: "number", requerido: true,
        min: 0, paso: "0.01", valor: l.precioCaja, ancho: "mitad" },
      { nombre: "origenPrecio", etiqueta: "Origen", tipo: "select", opciones: ops,
        valor: l.origenPrecio, ancho: "mitad" },
      { nombre: "color", etiqueta: "Color de la línea", tipo: "color", valor: l.color, ancho: "mitad" },
      { nombre: "activa", etiqueta: "", tipo: "checkbox", textoCheck: "Línea activa", valor: l.activa }
    ], function (d) {
      DB.update("lineas", l.id, d);
      DB.registrarBitacora(usuario.id, "Edición de línea", d.nombre);
      UI.aviso("Línea actualizada.");
      render();
    }, { aceptar: "Guardar", ancho: true });
  }

  function formCausa(id) {
    const c = DB.causa(id);
    if (!c) return;
    UI.abrirFormulario("Editar " + c.codigo, [
      { tipo: "html", contenido: '<p class="modal-nota">El código <strong>' + esc(c.codigo) +
        "</strong> es fijo: corresponde a la numeración del diagnóstico del TIC.</p>" },
      { nombre: "nombre", etiqueta: "Nombre de la causa", tipo: "text", requerido: true, valor: c.nombre },
      { nombre: "origen", etiqueta: "Dónde se origina", tipo: "select", valor: c.origen,
        opciones: [{ valor: "Campo", texto: "Campo — depende del proveedor" },
          { valor: "Transporte", texto: "Transporte" },
          { valor: "Proceso", texto: "Proceso — depende de la planta" },
          { valor: "Por clasificar", texto: "Por clasificar" }],
        ayuda: "Las de origen «Campo» son las únicas que el proveedor ve en su portal." },
      { nombre: "descripcion", etiqueta: "Descripción", tipo: "textarea", valor: c.descripcion },
      { nombre: "definida", etiqueta: "", tipo: "checkbox", valor: c.definida,
        textoCheck: "Causa ya definida en el diagnóstico" },
      { nombre: "principal", etiqueta: "", tipo: "checkbox", valor: c.principal,
        textoCheck: "Es una de las causas principales" }
    ], function (d) {
      DB.update("causas", c.id, d);
      DB.registrarBitacora(usuario.id, "Edición de causa raíz", c.codigo + " · " + d.nombre);
      UI.aviso("Causa " + c.codigo + " actualizada.");
      render();
    }, { aceptar: "Guardar" });
  }

  function formDestino(id) {
    const d0 = DB.destino(id);
    if (!d0) return;
    UI.abrirFormulario("Editar destino", [
      { nombre: "nombre", etiqueta: "Nombre", tipo: "text", requerido: true, valor: d0.nombre },
      { nombre: "nivel", etiqueta: "Nivel en la jerarquía", tipo: "number", requerido: true,
        min: 1, max: 10, paso: "1", valor: d0.nivel, ancho: "mitad",
        ayuda: "1 es el de mayor valor recuperado." },
      { nombre: "valorKg", etiqueta: "Valor por kg ($)", tipo: "number", requerido: true,
        paso: "0.01", valor: d0.valorKg, ancho: "mitad",
        ayuda: "Negativo si tiene costo, como el relleno sanitario." },
      { nombre: "origenValor", etiqueta: "Origen del valor", tipo: "select", ancho: "mitad",
        valor: d0.origenValor,
        opciones: DB.ORIGENES.map(function (o) { return { valor: o.id, texto: o.id + " — " + o.nombre }; }) },
      { nombre: "valoriza", etiqueta: "", tipo: "checkbox", valor: d0.valoriza,
        textoCheck: "Cuenta como descarte aprovechado" }
    ], function (d) {
      DB.update("destinos", d0.id, d);
      DB.registrarBitacora(usuario.id, "Edición de destino", d.nombre);
      UI.aviso("Destino actualizado.");
      render();
    }, { aceptar: "Guardar" });
  }

  function formParametros() {
    const p = DB.parametros();
    const ops = DB.ORIGENES.map(function (o) { return { valor: o.id, texto: o.id + " — " + o.nombre }; });
    UI.abrirFormulario("Parámetros de planta", [
      { nombre: "horasTurno", etiqueta: "Horas de turno", tipo: "number", requerido: true,
        min: 1, max: 24, paso: "0.5", valor: p.horasTurno, ancho: "mitad" },
      { nombre: "origenHorasTurno", etiqueta: "Origen", tipo: "select", opciones: ops,
        valor: p.origenHorasTurno, ancho: "mitad" },
      { nombre: "operariosDisponibles", etiqueta: "Operarios disponibles", tipo: "number",
        requerido: true, min: 1, max: 500, paso: "1", valor: p.operariosDisponibles, ancho: "mitad" },
      { nombre: "origenOperarios", etiqueta: "Origen", tipo: "select", opciones: ops,
        valor: p.origenOperarios, ancho: "mitad" },
      { nombre: "eficienciaPlanta", etiqueta: "Eficiencia de planta (0 a 1)", tipo: "number",
        requerido: true, min: 0.1, max: 1, paso: "0.01", valor: p.eficienciaPlanta, ancho: "mitad" },
      { nombre: "origenEficiencia", etiqueta: "Origen", tipo: "select", opciones: ops,
        valor: p.origenEficiencia, ancho: "mitad" },
      { nombre: "suplementosOIT", etiqueta: "Suplementos OIT (0 a 1)", tipo: "number",
        requerido: true, min: 0, max: 0.5, paso: "0.01", valor: p.suplementosOIT, ancho: "mitad",
        ayuda: "Se descuentan del tiempo de turno antes de calcular la capacidad." },
      { nombre: "origenSuplementos", etiqueta: "Origen", tipo: "select", opciones: ops,
        valor: p.origenSuplementos, ancho: "mitad" },
      { nombre: "costoHoraHombre", etiqueta: "Costo hora-hombre ($)", tipo: "number",
        requerido: true, min: 0, paso: "0.01", valor: p.costoHoraHombre, ancho: "mitad" },
      { nombre: "origenCostoHora", etiqueta: "Origen", tipo: "select", opciones: ops,
        valor: p.origenCostoHora, ancho: "mitad" }
    ], function (d) {
      DB.guardarParametros(d);
      DB.registrarBitacora(usuario.id, "Edición de parámetros de planta", "");
      UI.aviso("Parámetros actualizados.");
      render();
    }, { aceptar: "Guardar", ancho: true });
  }

  /* ====================== proveedores / usuarios ====================== */

  function vistaProveedores() {
    const resumen = {};
    Indicadores.porProveedor({ desde: "0000-01-01", hasta: "9999-12-31" }).forEach(function (m) {
      resumen[m.proveedorId] = m;
    });

    let html = '<div class="vista-cab"><div><h1>Proveedores</h1>' +
      '<p class="sub">Padrón único. La variabilidad entre proveedores es la causa raíz CR6.</p></div>' +
      '<div class="cab-acciones">' +
      '<button class="btn btn-primario" id="btnNuevoProveedor">+ Nuevo proveedor</button>' +
      '<button class="btn btn-plano" id="btnCsvProveedores">Exportar CSV</button></div></div>';

    html += UI.tabla([
      { titulo: "Código", valor: function (p) { return "<code>" + esc(p.codigo) + "</code>"; } },
      { titulo: "Proveedor", valor: function (p) { return "<strong>" + esc(p.nombre) + "</strong>"; } },
      { titulo: "Documento", valor: function (p) { return esc(p.documento); } },
      { titulo: "Contacto", valor: function (p) {
        return esc(p.contacto) + '<br><small class="tenue">' + esc(p.telefono) + "</small>"; } },
      { titulo: "Zona", valor: function (p) { return esc(p.zona); } },
      { titulo: "Cajas", num: true, valor: function (p) {
        return nf(resumen[p.id] ? resumen[p.id].cajasRecibidas : 0); } },
      { titulo: "Exactitud", num: true, valor: function (p) {
        const m = resumen[p.id];
        if (!m || !m.cajasAnunPesadas) return '<span class="tenue">—</span>';
        const clase = Math.abs(m.tasaDiferencia) <= 0.01 ? "etq-ok" : Math.abs(m.tasaDiferencia) <= 0.03 ? "etq-B" : "etq-bajo";
        return '<span class="etq ' + clase + '">' + pctFirmado(m.tasaDiferencia) + "</span>"; } },
      { titulo: "Variabilidad", num: true, valor: function (p) {
        const m = resumen[p.id];
        if (!m) return '<span class="tenue">—</span>';
        const clase = m.indiceVariabilidad < 0.06 ? "etq-ok" : m.indiceVariabilidad < 0.14 ? "etq-B" : "etq-bajo";
        return '<span class="etq ' + clase + '">' + nf(m.indiceVariabilidad, 3) + "</span>"; } },
      { titulo: "Estado", valor: function (p) {
        return '<span class="estado estado-' + (p.activo ? "recibido" : "inactivo") + '">' +
          (p.activo ? "Activo" : "Inactivo") + "</span>"; } },
      { titulo: "", valor: function (p) {
        return '<button class="btn-mini" data-editar-prov="' + esc(p.id) + '">Editar</button>' +
          '<button class="btn-mini" data-toggle-prov="' + esc(p.id) + '">' +
          (p.activo ? "Desactivar" : "Activar") + "</button>"; } }
    ], DB.all("proveedores"), {});

    html += '<p class="nota-info">El <strong>índice de variabilidad</strong> combina la ' +
      "desviación al declarar, la tasa de rechazo y el rendimiento de la fruta. Es la CR6 " +
      "hecha número: cuanto más alto, más impredecible es el proveedor.</p>";
    return html;
  }

  function formProveedor(id) {
    const p = id ? DB.get("proveedores", id) : null;
    UI.abrirFormulario(p ? "Editar proveedor" : "Nuevo proveedor", [
      { nombre: "nombre", etiqueta: "Razón social / nombre", tipo: "text", requerido: true, valor: p ? p.nombre : "" },
      { nombre: "documento", etiqueta: "RUC / documento", tipo: "text", requerido: true, ancho: "mitad",
        valor: p ? p.documento : "",
        validar: function (v) { return /^[0-9-]{8,15}$/.test(v) ? null : "Documento no válido (8 a 15 dígitos)."; } },
      { nombre: "zona", etiqueta: "Zona / provincia", tipo: "text", requerido: true, ancho: "mitad", valor: p ? p.zona : "" },
      { nombre: "contacto", etiqueta: "Persona de contacto", tipo: "text", requerido: true, ancho: "mitad", valor: p ? p.contacto : "" },
      { nombre: "telefono", etiqueta: "Teléfono", tipo: "tel", requerido: true, ancho: "mitad", valor: p ? p.telefono : "",
        validar: function (v) { return /^[0-9+\s-]{7,15}$/.test(v) ? null : "Teléfono no válido."; } },
      { nombre: "email", etiqueta: "Correo", tipo: "email", ancho: "mitad", valor: p ? p.email : "",
        validar: function (v) { return !v || /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v) ? null : "Correo no válido."; } },
      { nombre: "activo", etiqueta: "", tipo: "checkbox", textoCheck: "Proveedor activo", valor: p ? p.activo : true }
    ], function (d) {
      if (p) {
        DB.update("proveedores", p.id, d);
        DB.registrarBitacora(usuario.id, "Edición de proveedor", d.nombre);
        UI.aviso("Proveedor actualizado.");
      } else {
        const n = DB.all("proveedores").length + 1;
        DB.insert("proveedores", Object.assign({
          codigo: "PRV-" + String(n).padStart(3, "0"), fechaAlta: DB.hoy()
        }, d));
        DB.registrarBitacora(usuario.id, "Alta de proveedor", d.nombre);
        UI.aviso("Proveedor registrado. Ya puede entrar al portal.");
      }
      render();
    });
  }

  function vistaUsuarios() {
    let html = '<div class="vista-cab"><div><h1>Usuarios</h1>' +
      '<p class="sub">Quién entra a cada aplicación y con qué rol.</p></div></div>';

    html += UI.tabla([
      { titulo: "Nombre", valor: function (u) { return "<strong>" + esc(u.nombre) + "</strong>"; } },
      { titulo: "Aplicación", valor: function (u) {
        return u.rol === "proveedor"
          ? '<span class="etq etq-rol">Portal externo</span>'
          : '<span class="etq etq-ok">Sistema de planta</span>'; } },
      { titulo: "Rol", valor: function (u) {
        const r = DB.ROLES.find(function (x) { return x.id === u.rol; });
        return esc(r ? r.icono + " " + r.nombre : u.rol); } },
      { titulo: "Proveedor", valor: function (u) {
        return u.proveedorId ? esc(Indicadores.nombreProveedor(u.proveedorId)) : "—"; } },
      { titulo: "Estado", valor: function (u) {
        return '<span class="estado estado-' + (u.activo ? "recibido" : "inactivo") + '">' +
          (u.activo ? "Activo" : "Inactivo") + "</span>"; } },
      { titulo: "", valor: function (u) {
        if (u.id === usuario.id) return '<span class="tenue">Sesión actual</span>';
        return '<button class="btn-mini" data-toggle-usr="' + esc(u.id) + '">' +
          (u.activo ? "Desactivar" : "Activar") + "</button>"; } }
    ], DB.all("usuarios"), {});

    html += '<p class="nota-seguridad">⚠️ Prototipo académico: se entra eligiendo rol y ' +
      "escribiendo el nombre, sin contraseña. Antes de un uso real hace falta autenticación " +
      "en el servidor. Ver <code>app/README.md</code>.</p>";
    return html;
  }

  /* ========================= bitácora y datos ========================= */

  function vistaBitacora() {
    let html = '<div class="vista-cab"><div><h1>Bitácora</h1>' +
      '<p class="sub">Quién registró qué y cuándo, en las dos aplicaciones.</p></div></div>';
    html += UI.tabla([
      { titulo: "Fecha y hora", valor: function (b) { return new Date(b.fecha).toLocaleString("es-EC"); } },
      { titulo: "Usuario", valor: function (b) { return esc(Indicadores.nombreUsuario(b.usuarioId)); } },
      { titulo: "Acción", valor: function (b) { return "<strong>" + esc(b.accion) + "</strong>"; } },
      { titulo: "Detalle", valor: function (b) { return esc(b.detalle); } }
    ], DB.all("bitacora"), { vacio: "Todavía no hay movimientos." });
    return html;
  }

  function vistaDatos() {
    const db = DB.load();
    let html = '<div class="vista-cab"><div><h1>Datos del sistema</h1>' +
      '<p class="sub">Respaldo, restauración y reinicio del repositorio.</p></div></div>';

    html += '<section class="panel"><h2>Contenido actual</h2><div class="conteos">';
    [["Proveedores", db.proveedores.length], ["Usuarios", db.usuarios.length],
     ["Líneas", db.lineas.length], ["Causas raíz", db.causas.length],
     ["Destinos", db.destinos.length], ["Lotes", db.lotes.length],
     ["Producciones", db.producciones.length], ["Planes", (db.planes || []).length],
     ["Bitácora", db.bitacora.length]].forEach(function (c) {
      html += "<div><span>" + esc(c[0]) + "</span><strong>" + nf(c[1]) + "</strong></div>";
    });
    html += "</div></section>";

    html += '<section class="panel"><h2>Respaldo y restauración</h2>' +
      "<p>Todo el repositorio se guarda como un único archivo JSON, útil como anexo del TIC.</p>" +
      '<div class="acciones-fila">' +
      '<button class="btn btn-primario" id="btnExportarJSON">Descargar respaldo</button>' +
      '<label class="btn btn-sec" for="inputImportar">Restaurar desde archivo</label>' +
      '<input type="file" id="inputImportar" accept="application/json" hidden>' +
      '<button class="btn btn-peligro" id="btnReiniciar">Reiniciar con datos de demostración</button>' +
      "</div></section>";

    html += '<section class="panel"><h2>Dónde se guardan los datos</h2>';
    if (DB.esCompartido()) {
      html += "<p><strong>Modo compartido.</strong> Las dos aplicaciones —el portal del " +
        "proveedor y este sistema— escriben en el mismo almacén. Lo que el proveedor " +
        "anuncia desde su celular aparece aquí al instante, sin recargar.</p>";
    } else {
      html += "<p><strong>Modo local.</strong> Los datos viven en el <code>localStorage</code> " +
        "de este navegador. Para que las dos aplicaciones se consoliden entre dispositivos, " +
        "usa la versión publicada.</p>";
    }
    html += "</section>";
    return html;
  }

  /* =============================== acceso ============================= */

  function vistaAcceso() {
    let html = '<div class="acceso-capa acceso-interno"><div class="acceso-caja">' +
      '<div class="acceso-marca"><span class="logo" aria-hidden="true">🏭</span>' +
      "<div><strong>" + esc(DB.EMPRESA.sistema) + "</strong><small>" +
      esc(DB.EMPRESA.descripcion) + "</small></div></div>" +
      '<p class="acceso-intro">Sistema interno de planta. Elige tu rol para empezar.</p>' +
      '<form id="formAcceso" novalidate><fieldset class="roles"><legend>¿Cuál es tu rol?</legend>';

    DB.ROLES.filter(function (r) { return ROLES_INTERNOS.indexOf(r.id) !== -1; })
      .forEach(function (r, i) {
        html += '<label class="rol-tarjeta"><input type="radio" name="rol" value="' + esc(r.id) + '"' +
          (i === 0 ? " checked" : "") + '><span class="rol-cuerpo">' +
          '<span class="rol-icono" aria-hidden="true">' + r.icono + "</span>" +
          "<span><strong>" + esc(r.nombre) + "</strong><small>" + esc(r.lema) + "</small></span></span></label>";
      });
    html += "</fieldset>" +
      '<div class="campo"><label for="nombre">Tu nombre</label>' +
      '<input type="text" id="nombre" name="nombre" autocomplete="name" placeholder="Nombre y apellido" required></div>' +
      '<p class="form-error" id="accesoError" role="alert" hidden></p>' +
      '<button type="submit" class="btn btn-primario btn-ancho btn-grande">Entrar</button></form>';

    const demo = DB.all("usuarios").filter(function (u) {
      return ROLES_INTERNOS.indexOf(u.rol) !== -1;
    }).slice(0, 4);
    if (demo.length) {
      html += '<div class="acceso-demo"><p>Personas de la demostración:</p><ul>';
      demo.forEach(function (u) {
        const r = DB.ROLES.find(function (x) { return x.id === u.rol; });
        html += '<li><button type="button" class="demo" data-nombre="' + esc(u.nombre) +
          '" data-rol="' + esc(u.rol) + '">' + esc(u.nombre) + "</button> — " +
          esc(r ? r.nombre : u.rol) + "</li>";
      });
      html += "</ul></div>";
    }

    html += '<p class="acceso-pie">¿Eres proveedor? <a ' + UI.rutaOtraApp("proveedor") + '>Entra al portal</a></p>';
    html += "</div></div>";
    return html;
  }

  /* =============================== render ============================= */

  function render() {
    const app = $("#app");

    if (!usuario) {
      app.innerHTML = vistaAcceso();
      enlazarAcceso();
      return;
    }

    const rol = DB.ROLES.find(function (r) { return r.id === usuario.rol; });
    const compartido = DB.esCompartido();
    const anunciados = DB.all("lotes").filter(function (l) { return l.estado === "Anunciado"; }).length;

    let html = '<div class="capa"><aside class="lateral" id="lateral">' +
      '<div class="marca"><span class="logo" aria-hidden="true">🏭</span>' +
      "<div><strong>" + esc(DB.EMPRESA.sistema) + "</strong><small>" +
      esc(DB.EMPRESA.nombre) + "</small></div></div><nav>";

    menu().forEach(function (m) {
      /* La cola del patio lleva contador: es lo que llega del portal externo. */
      const pendiente = m.id === "recepcion" && anunciados > 0
        ? '<span class="nav-contador">' + anunciados + "</span>" : "";
      html += '<button type="button" class="nav-item' + (m.id === vista ? " activo" : "") +
        '" data-ir="' + m.id + '"' + (m.id === vista ? ' aria-current="page"' : "") + ">" +
        '<span aria-hidden="true">' + m.icono + "</span>" + esc(m.texto) + pendiente + "</button>";
    });

    html += "</nav><div class='lateral-pie'>" +
      '<p class="sincro sincro-' + (compartido ? "on" : "off") + '">' +
      '<span class="sincro-punto" aria-hidden="true"></span>' +
      (compartido ? "Datos compartidos" : "Solo este equipo") + "</p>" +
      '<p class="tenue sincro-ayuda">' + (compartido
        ? "Conectado con el portal del proveedor."
        : "Sin conexión con el portal externo.") + "</p>" +
      "<p class='tenue'>v4.0 · prototipo TIC</p></div></aside>";

    html += '<div class="principal"><header class="barra">' +
      '<button class="menu-btn" id="btnMenu" aria-label="Abrir menú" aria-expanded="false">☰</button>' +
      '<div class="barra-usuario"><div class="avatar" aria-hidden="true">' +
      esc(rol ? rol.icono : "·") + "</div><div><strong>" + esc(usuario.nombre) + "</strong>" +
      "<small>" + esc(rol ? rol.nombre : usuario.rol) + "</small></div>" +
      '<button class="btn btn-plano" id="btnSalir">Salir</button></div></header>';

    html += '<main id="contenido" tabindex="-1">';
    if (vista === "panel") html += vistaPanel();
    else if (vista === "planificador") html += vistaPlanificador();
    else if (vista === "recepcion") html += vistaRecepcion();
    else if (vista === "produccion") html += vistaProduccion();
    else if (vista === "lotes") html += vistaLotes();
    else if (vista === "reportes") html += vistaReportes();
    else if (vista === "catalogos") html += vistaCatalogos();
    else if (vista === "proveedores") html += vistaProveedores();
    else if (vista === "usuarios") html += vistaUsuarios();
    else if (vista === "bitacora") html += vistaBitacora();
    else if (vista === "datos") html += vistaDatos();
    html += "</main></div></div>";

    app.innerHTML = html;
    enlazar();
  }

  /* Cambia el bloque calculado del planificador y vuelve a enganchar sus
     propios botones. El resto de la pagina, y el foco, quedan intactos. */
  function refrescarPlan() {
    const cont = $("#planDinamico");
    if (!cont) return;
    cont.innerHTML = resultadoPlan();
    enlazarBotonesPlan();
  }

  function enlazarBotonesPlan() {
    const btnCsv = $("#btnCsvPlan");
    if (btnCsv) {
      btnCsv.addEventListener("click", function () {
        const r = Indicadores.planificar(planActual);
        UI.descargarCSV("plan_" + planActual.fecha, [
          { titulo: "Línea", csv: function (d) { return d.nombre; } },
          { titulo: "Cajas", csv: function (d) { return d.cajas; } },
          { titulo: "Min por caja", csv: function (d) { return d.tiempoEstandarMin; } },
          { titulo: "Minutos requeridos", csv: function (d) { return Math.round(d.minutosRequeridos); } },
          { titulo: "Takt (min)", csv: function (d) { return d.taktMin.toFixed(2); } },
          { titulo: "Operarios", csv: function (d) { return d.operariosAsignados; } },
          { titulo: "Disponible en cámara", csv: function (d) { return d.disponible; } },
          { titulo: "Faltante", csv: function (d) { return d.faltante; } }
        ], r.detalle);
      });
    }

    $$("[data-cargar-plan]").forEach(function (b) {
      b.addEventListener("click", function () {
        const p = DB.get("planes", b.dataset.cargarPlan);
        if (!p) return;
        planActual = {
          fecha: p.fecha, horasTurno: p.horasTurno, operarios: p.operarios,
          eficiencia: p.eficiencia, lineas: p.lineas.slice()
        };
        UI.aviso("Plan del " + UI.fechaLarga(p.fecha) + " cargado.");
        render();
      });
    });

    $$("[data-borrar-plan]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (!confirm("¿Eliminar este plan guardado?")) return;
        DB.remove("planes", b.dataset.borrarPlan);
        refrescarPlan();
      });
    });
  }

  function enlazarAcceso() {
    const form = $("#formAcceso");
    const error = $("#accesoError");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const rol = form.querySelector("input[name=rol]:checked").value;
      const r = entrar(rol, form.nombre.value);
      if (r.error) { error.textContent = r.error; error.hidden = false; return; }
      render();
      UI.aviso("Bienvenido, " + usuario.nombre + ".");
    });
    $$(".demo").forEach(function (b) {
      b.addEventListener("click", function () {
        form.querySelector('input[name=rol][value="' + b.dataset.rol + '"]').checked = true;
        form.nombre.value = b.dataset.nombre;
        form.querySelector("button[type=submit]").focus();
      });
    });
  }

  function enlazar() {
    $$("[data-ir]").forEach(function (b) {
      b.addEventListener("click", function () {
        ir(b.dataset.ir);
        const lat = $("#lateral"); if (lat) lat.classList.remove("abierto");
      });
    });

    const btnMenu = $("#btnMenu");
    if (btnMenu) {
      btnMenu.addEventListener("click", function () {
        const abierto = $("#lateral").classList.toggle("abierto");
        btnMenu.setAttribute("aria-expanded", String(abierto));
      });
    }
    const btnSalir = $("#btnSalir");
    if (btnSalir) btnSalir.addEventListener("click", salir);

    /* --- filtros --- */
    const ff = $("#formFiltros");
    if (ff) {
      ff.addEventListener("submit", function (e) {
        e.preventDefault();
        const d = new FormData(ff);
        const desde = d.get("desde") || filtros.desde;
        const hasta = d.get("hasta") || filtros.hasta;
        if (desde > hasta) { UI.aviso("«Desde» no puede ser posterior a «Hasta».", "alerta"); return; }
        filtros.desde = desde; filtros.hasta = hasta;
        filtros.proveedorId = d.get("proveedorId") || "";
        filtros.lineaId = d.get("lineaId") || "";
        filtros.calidad = d.get("calidad") || "";
        filtros.estado = d.get("estado") || "";
        render();
      });
    }
    const btnLimpiar = $("#btnLimpiar");
    if (btnLimpiar) {
      btnLimpiar.addEventListener("click", function () {
        filtros = { desde: DB.diasAtras(30), hasta: DB.hoy(), proveedorId: "", lineaId: "", calidad: "", estado: "" };
        render();
      });
    }
    $$("[data-rango]").forEach(function (b) {
      b.addEventListener("click", function () {
        filtros.desde = DB.diasAtras(Number(b.dataset.rango));
        filtros.hasta = DB.hoy();
        render();
      });
    });

    /* --- ciclo del lote --- */
    $$("[data-ficha]").forEach(function (b) {
      b.addEventListener("click", function () { verFicha(b.dataset.ficha); });
    });
    $$("[data-pesar]").forEach(function (b) {
      b.addEventListener("click", function () { formPesar(b.dataset.pesar); });
    });
    $$("[data-rechazar]").forEach(function (b) {
      b.addEventListener("click", function () { formRechazar(b.dataset.rechazar); });
    });
    $$("[data-procesar]").forEach(function (b) {
      b.addEventListener("click", function () { formProcesar(b.dataset.procesar); });
    });
    $$("[data-cerrar]").forEach(function (b) {
      b.addEventListener("click", function () { cerrarLote(b.dataset.cerrar); });
    });
    $$("[data-reabrir]").forEach(function (b) {
      b.addEventListener("click", function () {
        const l = DB.get("lotes", b.dataset.reabrir);
        if (!l) return;
        if (!confirm("¿Reabrir el lote " + l.codigoLote + "? Volverá a Procesado y quedará en la bitácora.")) return;
        DB.update("lotes", l.id, { estado: "Procesado", fechaCierre: null, cerradoPor: null });
        DB.registrarBitacora(usuario.id, "Reapertura de lote", l.codigoLote);
        UI.aviso("Lote " + l.codigoLote + " reabierto.", "alerta");
        render();
      });
    });
    $$("[data-enviar]").forEach(function (b) {
      b.addEventListener("click", function () {
        const l = DB.get("lotes", b.dataset.enviar);
        if (!l) return;
        DB.update("lotes", l.id, { reporteEnviado: true, fechaReporte: DB.hoy() });
        DB.registrarBitacora(usuario.id, "Publicación de reporte",
          l.codigoLote + " · " + Indicadores.nombreProveedor(l.proveedorId));
        UI.aviso("Reporte publicado en el portal del proveedor.");
        render();
      });
    });

    /* --- planificador --- */
    const formPlan = $("#formPlan");
    if (formPlan) {
      formPlan.addEventListener("submit", function (e) {
        e.preventDefault();
        const d = new FormData(formPlan);
        planActual.fecha = d.get("fecha") || planActual.fecha;
        planActual.horasTurno = Number(d.get("horasTurno")) || planActual.horasTurno;
        planActual.operarios = Number(d.get("operarios")) || planActual.operarios;
        planActual.eficiencia = Number(d.get("eficiencia")) || planActual.eficiencia;
        render();
      });
    }
    $$("[data-linea]").forEach(function (input) {
      const actualizar = function () {
        const item = planActual.lineas.find(function (x) { return x.lineaId === input.dataset.linea; });
        if (item) item.cajas = Number(input.value) || 0;
        refrescarPlan();
      };
      input.addEventListener("input", actualizar);
      input.addEventListener("change", actualizar);
    });
    const btnGuardarPlan = $("#btnGuardarPlan");

    if (btnGuardarPlan) {
      btnGuardarPlan.addEventListener("click", function () {
        const r = Indicadores.planificar(planActual);
        if (r.cajasTotales <= 0) { UI.aviso("Escribe las cajas antes de guardar el plan.", "alerta"); return; }
        DB.insert("planes", {
          fecha: planActual.fecha,
          horasTurno: planActual.horasTurno,
          operarios: planActual.operarios,
          eficiencia: planActual.eficiencia,
          lineas: planActual.lineas.slice(),
          cajasTotales: r.cajasTotales,
          carga: r.carga,
          registradoPor: usuario.id,
          creadoEn: new Date().toISOString()
        });
        DB.registrarBitacora(usuario.id, "Plan de producción guardado",
          planActual.fecha + " · " + nf(r.cajasTotales) + " cajas · carga " + pct(r.carga));
        UI.aviso("Plan guardado.");
        render();
      });
    }
    enlazarBotonesPlan();

    /* --- catálogos --- */
    $$("[data-editar-linea]").forEach(function (b) {
      b.addEventListener("click", function () { formLinea(b.dataset.editarLinea); });
    });
    $$("[data-editar-causa]").forEach(function (b) {
      b.addEventListener("click", function () { formCausa(b.dataset.editarCausa); });
    });
    $$("[data-editar-destino]").forEach(function (b) {
      b.addEventListener("click", function () { formDestino(b.dataset.editarDestino); });
    });
    const btnParam = $("#btnEditarParametros");
    if (btnParam) btnParam.addEventListener("click", formParametros);

    /* --- proveedores / usuarios --- */
    const btnNuevoProv = $("#btnNuevoProveedor");
    if (btnNuevoProv) btnNuevoProv.addEventListener("click", function () { formProveedor(null); });
    $$("[data-editar-prov]").forEach(function (b) {
      b.addEventListener("click", function () { formProveedor(b.dataset.editarProv); });
    });
    $$("[data-toggle-prov]").forEach(function (b) {
      b.addEventListener("click", function () {
        const p = DB.get("proveedores", b.dataset.toggleProv);
        if (!p) return;
        DB.update("proveedores", p.id, { activo: !p.activo });
        DB.registrarBitacora(usuario.id, p.activo ? "Desactivación de proveedor" : "Activación de proveedor", p.nombre);
        render();
      });
    });
    $$("[data-toggle-usr]").forEach(function (b) {
      b.addEventListener("click", function () {
        const u = DB.get("usuarios", b.dataset.toggleUsr);
        if (!u) return;
        DB.update("usuarios", u.id, { activo: !u.activo });
        DB.registrarBitacora(usuario.id, u.activo ? "Desactivación de usuario" : "Activación de usuario", u.nombre);
        render();
      });
    });

    /* --- exportaciones --- */
    const btnCsvLotes = $("#btnCsvLotes");
    if (btnCsvLotes) {
      btnCsvLotes.addEventListener("click", function () {
        UI.descargarCSV("lotes", columnasLote({ acciones: false }), Indicadores.filtrar(filtros).lotes);
      });
    }
    const btnCsvProd = $("#btnCsvProduccion");
    if (btnCsvProd) {
      btnCsvProd.addEventListener("click", function () {
        UI.descargarCSV("produccion", columnasProduccion(), Indicadores.filtrar(filtros).producciones);
      });
    }
    const btnCsvRep = $("#btnCsvReporte");
    if (btnCsvRep) {
      btnCsvRep.addEventListener("click", function () {
        UI.descargarCSV("reporte_" + reporteActual, columnasReporte(reporteActual),
          REPORTES[reporteActual].datos());
      });
    }
    const btnCsvProv = $("#btnCsvProveedores");
    if (btnCsvProv) {
      btnCsvProv.addEventListener("click", function () {
        UI.descargarCSV("proveedores", [
          { titulo: "Código", csv: function (p) { return p.codigo; } },
          { titulo: "Proveedor", csv: function (p) { return p.nombre; } },
          { titulo: "Documento", csv: function (p) { return p.documento; } },
          { titulo: "Contacto", csv: function (p) { return p.contacto; } },
          { titulo: "Teléfono", csv: function (p) { return p.telefono; } },
          { titulo: "Correo", csv: function (p) { return p.email; } },
          { titulo: "Zona", csv: function (p) { return p.zona; } },
          { titulo: "Estado", csv: function (p) { return p.activo ? "Activo" : "Inactivo"; } }
        ], DB.all("proveedores"));
      });
    }
    $$("[data-reporte]").forEach(function (b) {
      b.addEventListener("click", function () { reporteActual = b.dataset.reporte; render(); });
    });
    const btnImprimir = $("#btnImprimir");
    if (btnImprimir) btnImprimir.addEventListener("click", function () { window.print(); });

    /* --- datos --- */
    const btnExp = $("#btnExportarJSON");
    if (btnExp) {
      btnExp.addEventListener("click", function () {
        UI.descargar(new Blob([DB.exportar()], { type: "application/json" }),
          "flp_respaldo_" + DB.hoy() + ".json");
      });
    }
    const inputImp = $("#inputImportar");
    if (inputImp) {
      inputImp.addEventListener("change", function () {
        const archivo = inputImp.files[0];
        if (!archivo) return;
        const lector = new FileReader();
        lector.onload = function () {
          try { DB.importar(lector.result); UI.aviso("Datos restaurados."); render(); }
          catch (err) { UI.aviso("No se pudo restaurar: " + err.message, "error"); }
        };
        lector.readAsText(archivo);
      });
    }
    const btnReset = $("#btnReiniciar");
    if (btnReset) {
      btnReset.addEventListener("click", function () {
        if (!confirm("Se borrarán todos los registros" +
          (DB.esCompartido() ? " para todos los dispositivos" : "") +
          " y se cargarán los datos de demostración. ¿Continuar?")) return;
        btnReset.disabled = true;
        btnReset.textContent = "Reiniciando…";
        Promise.resolve(DB.reset()).then(function () {
          UI.aviso("Sistema reiniciado.");
          render();
        }).catch(function () {
          UI.aviso("No se pudo reiniciar.", "error");
          render();
        });
      });
    }
  }

  /* ============================== arranque ============================ */

  /* Un cambio llegado de otro dispositivo no debe reconstruir la pantalla
     encima de alguien que está escribiendo: se perdería lo tecleado. Se
     posterga hasta que el campo suelte el foco, y en la pantalla de acceso
     no se repinta en absoluto, porque ahí no hay nada que sincronizar. */
  let repintado = null;

  function repintarPorSincronizacion() {
    if (!usuario) return;
    if (repintado) return;
    repintado = setTimeout(function () {
      repintado = null;
      /* La sesión se vuelve a comprobar aquí: pudo cerrarse entre que se
         programó el repintado y el momento en que dispara. */
      if (!usuario) return;
      const activo = document.activeElement;
      if (activo && /^(INPUT|SELECT|TEXTAREA)$/.test(activo.tagName)) {
        activo.addEventListener("blur", repintarPorSincronizacion, { once: true });
        return;
      }
      render();
    }, 200);
  }

  function iniciar() {
    UI.prepararGuardado();
    DB.load();
    restaurar();
    render();

    DB.alFallarEscritura(function (codigo) {
      UI.aviso(codigo === "quota_exceeded"
        ? "El almacén está lleno. Reinicia los datos desde Datos del sistema."
        : "No se pudo guardar el cambio.", "error");
    });

    DB.conectar(repintarPorSincronizacion).then(function (m) {
      render();
      if (m === "compartido") UI.aviso("Conectado con el portal del proveedor.");
    });
  }

  /* Se expone en vez de arrancar sola: la página propia la inicia, y el
     paquete de las dos aplicaciones decide cuál montar. */
  window.PlantaFLP = { iniciar: function () { UI.alArrancar(iniciar); } };
})();
