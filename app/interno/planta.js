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
  const SESION = "acopia.planta.sesion";

  let usuario = null;
  let vista = "panel";
  let reporteActual = "proveedor";
  /* Escenario del simulador de mejora: vive mientras dure la sesión. */
  let escenario = null;
  /* La campana está abierta o cerrada; se cierra sola al repintar. */
  let novedadesAbiertas = false;

  let filtros = {
    desde: DB.diasAtras(30), hasta: DB.hoy(),
    proveedorId: "", lineaId: "", calidad: "", estado: "", texto: ""
  };

  const ROLES_INTERNOS = ["recepcion", "produccion", "supervisor"];

  const PERMISOS = {
    recepcion: ["pesar", "rechazar", "ver_lotes", "corregir_pesaje"],
    produccion: ["procesar", "ver_lotes", "corregir_produccion"],
    supervisor: ["pesar", "rechazar", "procesar", "ver_lotes", "cerrar", "reabrir",
      "enviar_reporte", "planificar", "administrar",
      "corregir_pesaje", "corregir_produccion"]
  };

  function puede(accion) {
    return !!usuario && (PERMISOS[usuario.rol] || []).indexOf(accion) !== -1;
  }

  /* ============================== sesión ============================== */

  async function entrar(acceso, clave, recordar) {
    const login = String(acceso).trim();
    if (!login) return { error: "Escribe tu usuario." };
    if (!clave) return { error: "Escribe tu contraseña o PIN." };

    const espera = Auth.bloqueo(login);
    if (espera > 0) {
      return { error: "Demasiados intentos fallidos. Espera " + espera + " segundos." };
    }

    const u = DB.buscarPorAcceso(login);
    const generico = "Usuario o contraseña incorrectos.";

    if (!u || ROLES_INTERNOS.indexOf(u.rol) === -1) {
      const espera = Auth.anotarFallo(login);
      return { error: espera > 0
        ? "Demasiados intentos fallidos. Espera " + espera + " segundos."
        : generico };
    }
    if (!u.credencial) {
      return { error: "Esa cuenta aún no tiene contraseña. Pídesela a Supervisión." };
    }
    if (!(await Auth.verificar(clave, u.credencial))) {
      const espera = Auth.anotarFallo(login);
      return { error: espera > 0
        ? "Demasiados intentos fallidos. Espera " + espera + " segundos."
        : generico };
    }
    if (!u.activo) return { error: "Tu usuario está inactivo. Habla con Supervisión." };

    Auth.limpiarFallos(login);
    usuario = u;
    novedadesAbiertas = false;
    DB.update("usuarios", u.id, { ultimoAcceso: new Date().toISOString() });
    UI.abrirSesion(SESION, u.id, recordar);
    DB.registrarBitacora(u.id, "Inicio de sesión", u.nombre + " · " + u.rol);
    return { ok: true, debeCambiar: !!u.debeCambiar };
  }

  function salir() {
    if (usuario) DB.registrarBitacora(usuario.id, "Cierre de sesión", usuario.nombre);
    usuario = null;
    /* El panel abierto no puede sobrevivir al cambio de persona: se
       quedaba abierto y le enseñaba a la siguiente los avisos de la
       anterior en cuanto entraba. */
    novedadesAbiertas = false;
    if (repintado) { clearTimeout(repintado); repintado = null; }
    vista = "panel";
    UI.cerrarSesion(SESION);
    render();
  }

  function restaurar() {
    const id = UI.sesionAbierta(SESION);
    if (!id) return;
    const u = DB.get("usuarios", id);
    if (u && ROLES_INTERNOS.indexOf(u.rol) !== -1 && u.activo) usuario = u;
  }

  /* ============================== navegación ========================== */

  /* Quince entradas en una lista plana son quince cosas que leer antes de
     dar con la que se busca, y la última se salía de la pantalla en un
     portátil. Van agrupadas por el momento en que se usan: primero lo del
     turno, después lo que se mira para decidir, y al final lo que se toca
     una vez al mes. El orden del arreglo es el orden en pantalla. */
  function menu() {
    return [
      { id: "panel", texto: "Indicadores", icono: "grafico", roles: "*" },

      { grupo: "El turno", id: "planificador", texto: "Planificación diaria",
        icono: "calendario", roles: ["supervisor"] },
      { grupo: "El turno", id: "recepcion", texto: "Recepción y pesaje",
        icono: "balanza", roles: ["recepcion", "supervisor"] },
      { grupo: "El turno", id: "produccion", texto: "Producción",
        icono: "planta", roles: ["produccion", "supervisor"] },
      { grupo: "El turno", id: "lotes", texto: "Lotes", icono: "caja", roles: "*" },

      { grupo: "Análisis", id: "tiempos", texto: "Estudio de tiempos",
        icono: "cronometro", roles: ["supervisor"] },
      { grupo: "Análisis", id: "costeo", texto: "Costeo y mejora",
        icono: "dinero", roles: ["supervisor"] },
      { grupo: "Análisis", id: "reportes", texto: "Reportes", icono: "reporte", roles: "*" },

      { grupo: "Proveedores", id: "proveedores", texto: "Fincas y cooperativas",
        icono: "brote", roles: ["supervisor"] },
      { grupo: "Proveedores", id: "liquidacion", texto: "Liquidaciones",
        icono: "recibo", roles: ["supervisor"] },

      { grupo: "Administración", id: "catalogos", texto: "Parámetros",
        icono: "engranaje", roles: ["supervisor"] },
      { grupo: "Administración", id: "usuarios", texto: "Usuarios",
        icono: "personas", roles: ["supervisor"] },
      { grupo: "Administración", id: "bitacora", texto: "Bitácora",
        icono: "reloj", roles: ["supervisor"] },
      { grupo: "Administración", id: "datos", texto: "Datos del sistema",
        icono: "archivo", roles: ["supervisor"] },
      { grupo: "Administración", id: "guia", texto: "Guía de uso",
        icono: "libro", roles: "*" }
    ].filter(function (m) { return m.roles === "*" || m.roles.indexOf(usuario.rol) !== -1; });
  }

  function ir(v) {
    vista = v; render();
    const m = $("#contenido"); if (m) m.focus();
  }

  /* ============================== filtros ============================= */

  function barraFiltros(o) {
    o = o || {};
    let html = "";

    /* El buscador va fuera del formulario de filtros y filtra mientras se
       escribe: buscar un lote por su código no debería costar un clic en
       «Aplicar». */
    if (o.buscar !== false) {
      html += '<div class="buscador"><label class="sr" for="buscarLote">Buscar lote</label>' +
        '<input type="search" id="buscarLote" value="' + esc(filtros.texto || "") + '" ' +
        'placeholder="Buscar por código, proveedor, línea o estado…" autocomplete="off">' +
        (filtros.texto ? '<button type="button" class="btn btn-plano btn-sm" id="btnLimpiarBusca">Limpiar</button>' : "") +
        "</div>";
    }

    html += '<form class="filtros" id="formFiltros">';
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
    html += UI.kpi("Gavetas recibidas", nf(k.gavetasRecibidas),
      k.numLotes + " lotes · " + nf(k.kgRecibidos) + " kg", "linea1");
    html += UI.kpi("Diferencia al declarar", pctFirmado(k.tasaDiferenciaGavetas),
      nf(k.diferenciaGavetas) + " gavetas entre lo anunciado y lo pesado",
      Math.abs(k.tasaDiferenciaGavetas) <= 0.01 ? "bien" : Math.abs(k.tasaDiferenciaGavetas) <= 0.03 ? "regular" : "mal");
    html += UI.kpi("Diferencia de peso", pctFirmado(k.tasaDiferenciaKg),
      nf(k.diferenciaKg) + " kg entre lo declarado y la báscula",
      Math.abs(k.tasaDiferenciaKg) <= 0.02 ? "bien" : Math.abs(k.tasaDiferenciaKg) <= 0.05 ? "regular" : "mal");
    html += UI.kpi("Cajas exportables", nf(k.cajasExportables),
      pct(k.tasaExportable) + " de lo procesado", "bien");
    html += UI.kpi("Tasa de exportable", pct(k.tasaExportable),
      "Meta " + pct(k.metaRendimiento) + " · cumplimiento " + pct(k.cumplimientoMeta),
      k.cumplimientoMeta >= 1 ? "bien" : k.cumplimientoMeta >= 0.9 ? "regular" : "mal");
    html += UI.kpi("Merma", pct(k.tasaMerma), nf(k.kgMerma) + " kg descartados",
      k.tasaMerma > 0.25 ? "mal" : "regular");
    html += UI.kpi("Pérdida económica", money(k.perdidaEconomica),
      nf(k.kgPerdidos) + " kg que no llegaron a exportación", "mal");
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

    /* --- balance de masa en cascada --- */
    const bal = Indicadores.balanceMasa(filtros);
    const etapas = Indicadores.porEtapa(filtros);
    html += '<section class="panel"><h2>¿Dónde se pierde la fruta?</h2>' +
      '<p class="sub panel-sub">El balance de masa, de la báscula a la caja. El pesaje ' +
      "solo comprueba cantidad; la fruta se cae después, y cada etapa tiene su dueño: " +
      "retirar al recibir es un problema del proveedor, caerse en selección es un " +
      "problema de método.</p>";

    if (bal.kgRecibidos <= 0) {
      html += '<p class="vacio">No hay fruta recibida en este período.</p></section>';
    } else {
      html += '<ol class="cascada">';
      bal.pasos.forEach(function (p, i) {
        const ancho = bal.kgRecibidos > 0 ? (p.kg / bal.kgRecibidos) * 100 : 0;
        const perdido = bal.kgRecibidos > 0 ? (p.perdida / bal.kgRecibidos) * 100 : 0;
        html += '<li class="cascada-paso">' +
          '<div class="cascada-cab"><strong>' + esc(p.nombre) + "</strong>" +
          (p.perdida > 0
            ? '<span class="cascada-perdida">−' + nf(p.perdida) + " kg · " +
              pct(p.perdida / bal.kgRecibidos) + "</span>"
            : '<span class="tenue">punto de partida</span>') + "</div>" +
          '<div class="cascada-barra"><span style="width:' + ancho.toFixed(1) + '%"></span>' +
          (perdido > 0
            ? '<span class="cascada-fuga" style="width:' + perdido.toFixed(1) + '%"></span>' : "") +
          "</div>" +
          '<div class="cascada-pie">' + nf(p.kg) + " kg siguen · " +
          pct(bal.kgRecibidos > 0 ? p.kg / bal.kgRecibidos : 0) + " de lo recibido</div></li>";
      });
      html += "</ol>";

      html += '<div class="kpis">' +
        UI.kpi("Rendimiento global", pct(bal.rendimientoGlobal),
          "de la báscula a la caja", bal.rendimientoGlobal >= 0.9 ? "bien" : "regular") +
        UI.kpi("Rendimiento de proceso", pct(bal.rendimientoProceso),
          "sin contar lo retirado al recibir") +
        UI.kpi("Retirado al recibir", pct(bal.tasaRetiro),
          nf(etapas[0].kg) + " kg que nunca entraron",
          bal.tasaRetiro <= 0.02 ? "bien" : "mal") +
        UI.kpi("Pérdida total", nf(bal.perdidaTotal) + " kg",
          pct(bal.kgRecibidos > 0 ? bal.perdidaTotal / bal.kgRecibidos : 0) + " de lo recibido", "mal") +
        "</div>";

      html += UI.tabla([
        { titulo: "Etapa", valor: function (e) {
          return "<strong>" + esc(e.nombre) + "</strong><br><small class='tenue'>" +
            esc(e.ayuda) + "</small>"; } },
        { titulo: "Kilos", num: true, valor: function (e) { return nf(e.kg); } },
        { titulo: "% de la pérdida", num: true, valor: function (e) {
          return '<span class="barra-mini barra-ancha"><span style="width:' +
            (e.porcentaje * 100).toFixed(1) + '%"></span></span> ' + pct(e.porcentaje, 0); } },
        { titulo: "Sobre lo recibido", num: true, valor: function (e) {
          return pct(bal.kgRecibidos > 0 ? e.kg / bal.kgRecibidos : 0); } },
        { titulo: "Valor perdido", num: true, valor: function (e) {
          return money(e.valorPerdido); } }
      ], etapas, {});
      html += "</section>";
    }

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
      Graficos.dona(Indicadores.porCalidad(filtros), { titulo: "Gavetas por calidad" }) + "</section>";
    html += "</div>";

    /* --- Bloque 3: proceso --- */
    html += '<h2 class="seccion-titulo">Proceso</h2><section class="kpis">';
    html += UI.kpi("Eficiencia de tiempo", pct(k.eficienciaTiempo),
      "Tiempo estándar ÷ tiempo real",
      k.eficienciaTiempo >= 0.95 ? "bien" : k.eficienciaTiempo >= 0.85 ? "regular" : "mal");
    html += UI.kpi("Minutos por gaveta", nf(k.minutosPorGaveta, 2) + " min-persona",
      "Promedio real del período", "neutro");
    html += UI.kpi("Productividad", nf(k.productividad, 2) + " gavetas/HH",
      nf(k.horasHombre, 1) + " horas-hombre", "linea3");
    html += UI.kpi("Ciclo del lote", nf(k.cicloPromedio, 1) + " días",
      "Del anuncio al cierre · " + k.numCerrados + " cerrados", "neutro");
    html += "</section>";

    html += '<div class="grid-2">';
    html += '<section class="panel"><h2>Tendencia</h2>' +
      Graficos.lineas(Indicadores.serie(filtros, gran), {
        titulo: "Gavetas por período",
        series: [
          { campo: "recibido", nombre: "Recibido", color: "#2f6f8f" },
          { campo: "procesado", nombre: "Procesado", color: "#c85a1e" },
          { campo: "exportable", nombre: "Exportable", color: "#5b8c3a" }
        ]
      }) + "</section>";
    html += '<section class="panel"><h2>Volumen por línea</h2>' +
      Graficos.barras(Indicadores.porLinea(filtros), { campo: "gavetasRecibidas", sufijo: " gavetas" }) +
      "</section>";
    html += "</div>";

    html += '<section class="panel"><h2>Desempeño por línea de producto</h2>' +
      UI.tabla([
        { titulo: "Línea", valor: function (m) { return UI.etiquetaLinea(m.lineaId); } },
        { titulo: "Contenido", num: true, valor: function (m) {
          const e = Indicadores.estudioTiempos(m.lineaId);
          return e ? nf(e.contenidoGavetaMin, 2) + " min-pers/gav " + UI.origen("M") : "—"; } },
        { titulo: "Real/gaveta", num: true, valor: function (m) { return nf(m.minutosPorGaveta, 2) + " min-pers"; } },
        { titulo: "Eficiencia", num: true, valor: function (m) {
          return '<span class="etq ' + (m.eficiencia >= 0.95 ? "etq-ok" : "etq-bajo") + '">' +
            pct(m.eficiencia) + "</span>"; } },
        { titulo: "Gavetas recibidas", num: true, valor: function (m) { return nf(m.gavetasRecibidas); } },
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
      jornadaMin: p.jornadaMin,
      pausasMin: p.pausasMin,
      operarios: p.operariosDisponibles,
      eficiencia: p.eficienciaPlanta,
      lineas: DB.all("lineas").filter(function (l) { return l.activa; })
        .map(function (l) { return { lineaId: l.id, gavetas: 0 }; })
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
      '<div class="campo"><label for="pHoras">Jornada (min)</label>' +
      '<input type="number" inputmode="numeric" id="pHoras" name="jornadaMin" min="60" max="1440" step="10" value="' +
      planActual.jornadaMin + '"></div>' +
      '<div class="campo"><label for="pPausas">Pausas (min)</label>' +
      '<input type="number" inputmode="numeric" id="pPausas" name="pausasMin" min="0" max="240" step="5" value="' +
      planActual.pausasMin + '"></div>' +
      '<div class="campo"><label for="pOper">Operarios disponibles</label>' +
      '<input type="number" inputmode="numeric" id="pOper" name="operarios" min="1" max="200" step="1" value="' +
      planActual.operarios + '"></div>' +
      '<div class="campo"><label for="pEf">Eficiencia de planta</label>' +
      '<input type="number" inputmode="decimal" id="pEf" name="eficiencia" min="0.3" max="1" step="0.01" value="' +
      planActual.eficiencia + '"></div>' +
      '<div class="campo campo-acciones"><button type="submit" class="btn btn-sec">Recalcular</button></div>' +
      "</form>" +
      '<p class="nota-info">El reparto usa el <strong>contenido de trabajo</strong> ' +
      "(minutos-persona por gaveta), no el tiempo de ciclo: una actividad atendida por " +
      "dos personas tarda lo mismo y consume el doble de mano de obra. Los suplementos de " +
      "la OIT ya están dentro de cada tiempo estándar, así que aquí no se vuelven a restar.</p>" +
      "</section>";

    /* --- demanda por línea --- */
    html += '<section class="panel"><h2>¿Qué hay que sacar hoy?</h2>' +
      '<p class="sub panel-sub">Escribe las <strong>gavetas</strong> comprometidas de cada ' +
      "línea —que es lo que entra del campo y lo que hay en cámara. Las cajas de exportación " +
      "salen de ahí, según el rendimiento de cada línea.</p>" +
      '<form id="formDemanda"><div class="demanda">';
    planActual.lineas.forEach(function (item) {
      const l = DB.linea(item.lineaId);
      if (!l) return;
      const disp = r.detalle.find(function (d) { return d.lineaId === item.lineaId; });
      html += '<div class="demanda-fila" style="--linea:' + esc(l.color) + '">' +
        '<label for="dem_' + esc(l.id) + '"><span class="linea-punto" aria-hidden="true"></span>' +
        esc(l.nombre) + '<small>' + nf(disp ? disp.contenidoGavetaMin : 0, 2) +
        " min-persona/gaveta " + UI.origen("M") + " · " +
        nf(disp ? disp.cajas / (disp.gavetas || 1) : 0, 2) + " cajas/gaveta</small></label>" +
        '<input type="number" inputmode="numeric" id="dem_' + esc(l.id) + '" data-linea="' + esc(l.id) +
        '" min="0" step="1" value="' + (item.gavetas || "") + '" placeholder="0">' +
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
    html += UI.kpi("Gavetas planificadas", nf(r.gavetasTotales),
      nf(r.cajasTotales) + " cajas · " + nf(r.kgTotales) + " kg · " + money(r.valorTotal), "linea1");
    html += UI.kpi("Carga del turno", pct(r.carga),
      UI.minutos(r.minutosRequeridos) + " de " + UI.minutos(r.capacidadTotalMin) + " disponibles", tono);
    html += UI.kpi("Operarios necesarios", nf(r.operariosNecesarios, 1),
      r.operariosFaltantes > 0 ? "Faltan " + nf(r.operariosFaltantes) + " para cumplir"
        : "Alcanza con los " + nf(r.operarios) + " disponibles",
      r.operariosFaltantes > 0 ? "mal" : "bien");
    html += UI.kpi("Takt time", r.taktPromedio > 0 ? nf(r.taktPromedio, 2) + " min" : "—",
      "Una gaveta debe salir cada este tiempo", "neutro");
    html += "</section>";

    if (r.gavetasTotales > 0) {
      html += '<section class="panel panel-' + tono + '"><h2>' +
        (r.alcanza ? "El plan cabe en el turno" : "El plan NO cabe en el turno") + "</h2>" +
        Graficos.medidor(r.carga, 1, "Carga sobre la capacidad disponible",
          "100 % = " + nf(r.operarios) + " operarios × " + UI.minutos(r.disponibleMin) +
          " disponibles (" +
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
          { titulo: "Gavetas", num: true, valor: function (d) { return nf(d.gavetas); },
            csv: function (d) { return d.gavetas; } },
          { titulo: "Cajas", num: true, valor: function (d) { return nf(d.cajas); },
            csv: function (d) { return Math.round(d.cajas); } },
          { titulo: "Ciclo", num: true, valor: function (d) { return nf(d.cicloGavetaMin, 2) + " min"; },
            csv: function (d) { return d.cicloGavetaMin.toFixed(2); } },
          { titulo: "Contenido", num: true, valor: function (d) {
            return nf(d.contenidoGavetaMin, 2) + " min-pers"; },
            csv: function (d) { return d.contenidoGavetaMin.toFixed(2); } },
          { titulo: "Manda", valor: function (d) {
            return esc(d.cuello) + ' <small class="tenue">' + pct(d.cuelloParticipacion, 0) + "</small>"; },
            csv: function (d) { return d.cuello; } },
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
        ], r.detalle, { vacio: "Escribe las gavetas de cada línea para ver el reparto." }) +
        '<div class="acciones-fila"><button class="btn btn-plano" id="btnCsvPlan">Exportar plan a CSV</button></div>' +
        "</section>";
    } else {
      html += '<p class="vacio">Escribe cuántas gavetas hay que procesar de cada línea para ver el plan.</p>';
    }

    /* Planes guardados. */
    const planes = DB.all("planes").slice().sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });
    if (planes.length) {
      html += '<section class="panel"><h2>Planes guardados</h2>' +
        UI.tabla([
          { titulo: "Fecha", valor: function (x) { return UI.fechaLarga(x.fecha); } },
          { titulo: "Gavetas", num: true, valor: function (x) { return nf(x.gavetasTotales); } },
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

  /* Compara antes y después y devuelve el detalle de lo que cambió. Una
     corrección sin rastro es indistinguible de falsear el dato: por eso se
     escribe qué valor había y quién lo cambió. */
  function diferencias(antes, despues, campos) {
    const cambios = [];
    Object.keys(campos).forEach(function (k) {
      const a = antes[k], b = despues[k];
      if (String(a === null || a === undefined ? "" : a) === String(b)) return;
      cambios.push({
        campo: campos[k],
        antes: a === null || a === undefined || a === "" ? "vacío" : a,
        despues: b === null || b === undefined || b === "" ? "vacío" : b
      });
    });
    return cambios;
  }

  function textoCambios(cambios) {
    return cambios.map(function (c) {
      return c.campo + ": " + c.antes + " → " + c.despues;
    }).join(" · ");
  }

  /* ============================= recepción ============================ */

  function vistaRecepcion() {
    const pendientes = DB.all("lotes").filter(function (l) { return l.estado === "Anunciado"; })
      .sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
    /* El turno de quien pesa no se mira por rango de fechas: se mira hoy. */
    const pesados = DB.all("lotes")
      .filter(function (l) { return l.gavetasRecibidas !== null; })
      .sort(function (a, b) { return a.fechaRecepcion < b.fechaRecepcion ? 1 : -1; });

    let html = '<div class="vista-cab"><div><h1>Recepción y pesaje</h1>' +
      '<p class="sub">Cuenta las gavetas y pesa lo que llega. Lo anunciado viene del portal del proveedor.</p></div></div>';

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
        { titulo: "Gavetas anunciadas", num: true, valor: function (l) { return nf(l.gavetasAnunciadas); } },
        { titulo: "Calidad", valor: function (l) {
          return '<span class="etq etq-' + esc(l.calidadDeclarada) + '">' + esc(l.calidadDeclarada) + "</span>"; } },
        { titulo: "", valor: function (l) {
          if (!puede("pesar")) return "—";
          return '<button class="btn-mini btn-mini-accion" data-pesar="' + esc(l.id) + '">Pesar</button>' +
            '<button class="btn-mini btn-mini-peligro" data-rechazar="' + esc(l.id) + '">Rechazar</button>'; } }
      ], pendientes, {});
    }
    html += "</section>";

    /* Abajo iba el historial completo, con las mismas nueve columnas que la
       pantalla de Lotes: dos sitios distintos enseñando exactamente lo
       mismo. Aquí basta con el propio turno —para repasar lo hecho y
       corregir un dedazo—; el histórico, y buscarlo, es cosa de Lotes. */
    /* Si hoy todavía no se ha pesado nada, la pantalla no se queda muerta:
       enseña los últimos pesajes, que es lo que se querría repasar. */
    const hoy = DB.hoy();
    const deHoy = pesados.filter(function (l) { return l.fechaRecepcion === hoy; });
    const delDia = deHoy.length ? deHoy : pesados.slice(0, 10);

    html += '<h2 class="seccion-titulo">' +
      (deHoy.length ? "Lo que has pesado hoy" : "Últimos pesajes") + "</h2>";

    const anun = delDia.reduce(function (a, l) { return a + l.gavetasAnunciadas; }, 0);
    const real = delDia.reduce(function (a, l) { return a + l.gavetasRecibidas; }, 0);
    html += '<p class="resumen-linea"><strong>' + nf(delDia.length) + "</strong> lotes · anunciadas <strong>" +
      nf(anun) + "</strong> gavetas · pesadas <strong>" + nf(real) + "</strong> · diferencia <strong>" +
      pctFirmado(anun > 0 ? (real - anun) / anun : 0) + "</strong></p>";

    html += UI.tabla([
      { titulo: "Lote", valor: function (l) { return "<code>" + esc(l.codigoLote) + "</code>"; } },
      { titulo: "Proveedor", valor: function (l) { return esc(Indicadores.nombreProveedor(l.proveedorId)); } },
      { titulo: "Anunciadas", num: true, valor: function (l) { return nf(l.gavetasAnunciadas); } },
      { titulo: "Pesadas", num: true, valor: function (l) { return nf(l.gavetasRecibidas); } },
      { titulo: "Kilos", num: true, valor: function (l) { return nf(l.kgRecibidos) + " kg"; } },
      { titulo: "Diferencia", num: true, valor: function (l) {
        if (!l.gavetasAnunciadas) return '<span class="tenue">—</span>';
        const d = (l.gavetasRecibidas - l.gavetasAnunciadas) / l.gavetasAnunciadas;
        const clase = Math.abs(d) <= 0.01 ? "etq-ok" : Math.abs(d) <= 0.03 ? "etq-B" : "etq-bajo";
        return '<span class="etq ' + clase + '">' + pctFirmado(d) + "</span>"; } },
      { titulo: "", valor: function (l) {
        return '<button class="btn-mini" data-ficha="' + esc(l.id) + '">Ficha</button>' +
          (puede("corregir_pesaje")
            ? '<button class="btn-mini" data-corregir-pesaje="' + esc(l.id) + '">Corregir</button>' : ""); } }
    ], delDia, { vacio: "Todavía no se ha pesado ningún lote." });

    html += '<p class="ir-a">¿Buscas un lote de otro día? Está en ' +
      '<button type="button" class="enlace" data-ir="lotes">Lotes</button>, ' +
      "con buscador por código y proveedor.</p>";

    return html;
  }



  function formPesar(loteId, corregir) {
    const l = DB.get("lotes", loteId);
    if (!l) return;
    if (!corregir && l.estado !== "Anunciado") {
      UI.aviso("Ese lote ya no está pendiente.", "alerta"); return;
    }
    if (corregir && l.estado === "Cerrado") {
      UI.aviso("El lote está cerrado. Supervisión debe reabrirlo primero.", "alerta"); return;
    }
    const linea = DB.linea(l.lineaId);

    const campos = [
      { tipo: "html", contenido: fichaMini(l) },
      { nombre: "fechaRecepcion", etiqueta: "Fecha de llegada", tipo: "date",
        valor: corregir ? l.fechaRecepcion : DB.hoy(),
        requerido: true, ancho: "mitad",
        validar: function (v) {
          if (v > DB.hoy()) return "La fecha no puede ser futura.";
          if (v < l.fecha) return "La fruta no puede llegar antes de que el proveedor la enviara (" +
            UI.fechaLarga(l.fecha) + ").";
          return null;
        } },
      { nombre: "gavetasRecibidas", etiqueta: "Gavetas contadas", tipo: "number", requerido: true,
        min: 0, max: 10000, paso: "1", ancho: "mitad",
        valor: corregir ? l.gavetasRecibidas : l.gavetasAnunciadas,
        ayuda: "El proveedor anunció " + nf(l.gavetasAnunciadas) + "." },
      { nombre: "kgRecibidos", etiqueta: "Peso real en báscula (kg)", tipo: "number", requerido: true,
        min: 0, max: 200000, paso: "0.1", ancho: "mitad",
        valor: corregir ? l.kgRecibidos : (l.kgAnunciados || ""),
        ayuda: "El proveedor declaró " + nf(l.kgAnunciados || 0) + " kg (" +
          nf(l.pesoGavetaDeclarado || 0, 1) + " kg/gaveta). Corrige con lo que marque la báscula." },
      { nombre: "calidadVerificada", etiqueta: "Calidad verificada", tipo: "select", requerido: true,
        ancho: "mitad", valor: corregir ? l.calidadVerificada : l.calidadDeclarada,
        opciones: DB.CALIDADES.map(function (c) { return { valor: c.id, texto: c.nombre }; }),
        ayuda: "El proveedor declaró " + l.calidadDeclarada + "." },
      { nombre: "difCalc", etiqueta: "Contraste con lo anunciado", tipo: "calculado" },
      { tipo: "separador", etiqueta: "¿Se retiró fruta al descargar?" },
      { nombre: "kgRetirados", etiqueta: "Kilos retirados (si los hubo)", tipo: "number",
        min: 0, paso: "0.1", ancho: "mitad",
        valor: corregir ? (l.kgRetirados || "") : "",
        ayuda: "Fruta que no entra a proceso: bajo calibre, golpeada, podrida. " +
          "Déjalo vacío si entró todo." },
      { nombre: "causaRetiro", etiqueta: "¿Por qué se retiró?", tipo: "select", ancho: "mitad",
        vacio: "—", valor: corregir ? (l.causaRetiro || "") : "",
        opciones: DB.all("causas").filter(function (c) { return c.origen === "Campo" || !c.definida; })
          .map(function (c) { return { valor: c.id, texto: c.codigo + " · " + c.nombre }; }) },
      { nombre: "destinoRetiro", etiqueta: "¿A dónde va lo retirado?", tipo: "select",
        ancho: "mitad", vacio: "—", valor: corregir ? (l.destinoRetiro || "") : "",
        opciones: DB.all("destinos").map(function (d) {
          return { valor: d.id, texto: d.nombre };
        }) },
      { nombre: "observacionesRecepcion", etiqueta: "Observaciones", tipo: "textarea",
        valor: corregir ? l.observacionesRecepcion : "",
        marcador: "Temperatura, estado de los envases, novedades del transporte." },
      { nombre: "motivo", etiqueta: "Motivo de la corrección", tipo: "text",
        requerido: !!corregir,
        marcador: "Por qué se corrige: error al teclear, recuento repetido…",
        ayuda: corregir ? "Queda escrito en la bitácora junto a los valores anteriores." : "" }
    ].filter(function (c) { return corregir || c.nombre !== "motivo"; });

    UI.abrirFormulario((corregir ? "Corregir pesaje de " : "Pesar lote ") + l.codigoLote,
      campos, function (d) {
      if (corregir) {
        const cambios = diferencias(l, d, {
          fechaRecepcion: "Fecha", gavetasRecibidas: "Gavetas", kgRecibidos: "Kilogramos",
          calidadVerificada: "Calidad", observacionesRecepcion: "Observaciones"
        });
        if (!cambios.length) return { error: "No cambiaste ningún dato." };

        DB.update("lotes", l.id, {
          fechaRecepcion: d.fechaRecepcion,
          gavetasRecibidas: Number(d.gavetasRecibidas),
          kgRecibidos: Number(d.kgRecibidos),
          kgRetirados: Number(d.kgRetirados) || 0,
          causaRetiro: Number(d.kgRetirados) > 0 ? (d.causaRetiro || null) : null,
          destinoRetiro: Number(d.kgRetirados) > 0 ? (d.destinoRetiro || null) : null,
          calidadVerificada: d.calidadVerificada,
          observacionesRecepcion: d.observacionesRecepcion || "",
          corregidoPor: usuario.id,
          fechaCorreccion: new Date().toISOString(),
          correcciones: (l.correcciones || 0) + 1
        });
        DB.registrarBitacora(usuario.id, "Corrección de pesaje",
          l.codigoLote + " · " + textoCambios(cambios) + " · motivo: " + d.motivo);
        UI.aviso("Pesaje corregido. El cambio quedó en la bitácora.");
        render();
        return;
      }

      DB.update("lotes", l.id, {
        fechaRecepcion: d.fechaRecepcion,
        gavetasRecibidas: Number(d.gavetasRecibidas),
        kgRecibidos: Number(d.kgRecibidos),
        kgRetirados: Number(d.kgRetirados) || 0,
        causaRetiro: Number(d.kgRetirados) > 0 ? (d.causaRetiro || null) : null,
        destinoRetiro: Number(d.kgRetirados) > 0 ? (d.destinoRetiro || null) : null,
        calidadVerificada: d.calidadVerificada,
        observacionesRecepcion: d.observacionesRecepcion || "",
        recibidoPor: usuario.id,
        estado: "Recibido"
      });
      const dif = Number(d.gavetasRecibidas) - l.gavetasAnunciadas;
      DB.registrarBitacora(usuario.id, "Pesaje de lote",
        l.codigoLote + " · " + nf(d.gavetasRecibidas) + " gavetas (" +
        (dif >= 0 ? "+" : "") + nf(dif) + " contra lo anunciado)");
      UI.aviso("Lote " + l.codigoLote + " recibido. Producción ya puede procesarlo.");
      render();
    }, {
      aceptar: "Confirmar recepción",
      alCambiar: function (d, form) {
        const out = $("#difCalc", form);
        if (!out) return;
        const c = Number(d.gavetasRecibidas);
        const kg = Number(d.kgRecibidos);
        if (!c) { out.textContent = "—"; out.className = ""; return; }
        const dif = c - l.gavetasAnunciadas;
        const tasa = dif / l.gavetasAnunciadas;
        const kgGaveta = kg > 0 ? kg / c : 0;
        const difKg = kg - (l.kgAnunciados || 0);
        const tasaKg = l.kgAnunciados ? difKg / l.kgAnunciados : 0;

        /* Dos contrastes distintos: pueden venir todas las gavetas y aun así
           pesar menos, si el proveedor las llenó por debajo de lo declarado. */
        out.innerHTML =
          "<strong>" + (dif >= 0 ? "+" : "") + nf(dif) + " gavetas</strong> (" + pctFirmado(tasa) + ")" +
          (kg > 0
            ? '<br><strong>' + (difKg >= 0 ? "+" : "") + nf(difKg) + " kg</strong> (" +
              pctFirmado(tasaKg) + ') <span class="tenue">· ' + nf(kgGaveta, 2) +
              " kg/gaveta contra " + nf(l.pesoGavetaDeclarado || linea.pesoGavetaKg, 1) +
              " declarados</span>" : "");
        const peor = Math.max(Math.abs(tasa), Math.abs(tasaKg));
        out.className = peor <= 0.01 ? "ok" : peor <= 0.03 ? "" : "bajo";
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
        gavetasRecibidas: 0, kgRecibidos: 0, calidadVerificada: "C",
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
        { titulo: "Gavetas", num: true, valor: function (l) { return nf(l.gavetasRecibidas); } },
        { titulo: "T. estimado", num: true, valor: function (l) {
          const ln = DB.linea(l.lineaId);
          const e = ln ? Indicadores.estudioTiempos(ln.id) : null;
          return e ? UI.minutos(l.gavetasRecibidas * e.contenidoGavetaMin) : "—"; } },
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

    const proc = lista.reduce(function (a, p) { return a + p.gavetasProcesadas; }, 0);
    const exp = lista.reduce(function (a, p) { return a + p.cajasExportables; }, 0);
    /* El rendimiento se mide en kilos. Cajas entre gavetas no es una tasa:
       daba 391%, que es el número que delata la mezcla de unidades. */
    const kgProc = lista.reduce(function (a, p) { return a + (Number(p.kgProcesados) || 0); }, 0);
    const kgExp = lista.reduce(function (a, p) { return a + (Number(p.kgExportable) || 0); }, 0);
    html += '<p class="resumen-linea"><strong>' + nf(lista.length) + "</strong> lotes · <strong>" +
      nf(proc) + "</strong> gavetas procesadas · <strong>" + nf(exp) +
      "</strong> cajas empacadas · rendimiento <strong>" +
      pct(kgProc > 0 ? kgExp / kgProc : 0) + "</strong> <span class='tenue'>(" +
      nf(kgExp) + " de " + nf(kgProc) + " kg)</span></p>";

    html += UI.tabla(columnasProduccion(), lista, { vacio: "No hay producción en este período." });
    html += '<p class="ir-a">Esta tabla es el registro de <strong>lo producido</strong>. ' +
      "El recorrido completo de cada pedido —anuncio, pesaje, cierre— está en " +
      '<button type="button" class="enlace" data-ir="lotes">Lotes</button>.</p>';
    return html;
  }

  /* El estándar está en minutos-persona, así que el tiempo real también:
     el reloj multiplicado por la gente que estuvo en la línea. Dividir por
     el reloj a secas daba eficiencias del 600%. */
  function eficienciaProd(p) {
    const real = (Number(p.tiempoRealMin) || 0) * (Number(p.operarios) || 1);
    return real > 0 ? Indicadores.tiempoEstandar(p) / real : 0;
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
      { titulo: "Procesadas", num: true, valor: function (p) { return nf(p.gavetasProcesadas); },
        csv: function (p) { return p.gavetasProcesadas; } },
      { titulo: "Exportables", num: true, valor: function (p) { return nf(p.cajasExportables); },
        csv: function (p) { return p.cajasExportables; } },
      { titulo: "Tasa", num: true, valor: function (p) {
        const t = p.kgProcesados > 0 ? p.kgExportable / p.kgProcesados : 0;
        const l = DB.linea(p.lineaId);
        const meta = l ? l.metaRendimiento : 0.98;
        return '<span class="etq ' + (t >= meta ? "etq-ok" : "etq-bajo") + '">' + pct(t) + "</span>"; },
        csv: function (p) { return p.kgProcesados > 0 ? ((p.kgExportable / p.kgProcesados) * 100).toFixed(2) : 0; } },
      { titulo: "Merma kg", num: true, valor: function (p) { return nf(Indicadores.totalMerma(p)); },
        csv: function (p) { return Indicadores.totalMerma(p); } },
      { titulo: "Aprovechado", num: true, valor: function (p) {
        const t = Indicadores.totalMerma(p);
        return t > 0 ? pct(Indicadores.mermaValorizada(p) / t) : "—"; },
        csv: function (p) {
          const t = Indicadores.totalMerma(p);
          return t > 0 ? ((Indicadores.mermaValorizada(p) / t) * 100).toFixed(1) : ""; } },
      { titulo: "Eficiencia", num: true, valor: function (p) {
        const e = eficienciaProd(p);
        return '<span class="etq ' + (e >= 0.95 ? "etq-ok" : "etq-bajo") + '">' + pct(e) + "</span>"; },
        csv: function (p) { return (eficienciaProd(p) * 100).toFixed(1); } },
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

  function formProcesar(loteId, corregir) {
    const l = DB.get("lotes", loteId);
    if (!l) return;
    const prodPrevia = corregir
      ? DB.all("producciones").find(function (x) { return x.loteId === l.id; }) : null;
    if (corregir && !prodPrevia) { UI.aviso("Ese lote no tiene producción registrada.", "alerta"); return; }
    if (corregir && l.estado === "Cerrado") {
      UI.aviso("El lote está cerrado. Supervisión debe reabrirlo primero.", "alerta"); return;
    }
    if (!corregir && l.estado !== "Recibido") { UI.aviso("Ese lote no está disponible.", "alerta"); return; }
    const linea = DB.linea(l.lineaId);
    const estudio = Indicadores.estudioTiempos(linea.id);
    /* Estándar del lote en minutos-PERSONA: es con lo que se compara el
       tiempo que de verdad consumió la gente, no con el reloj de pared. */
    const tEstandar = l.gavetasRecibidas * estudio.contenidoGavetaMin;
    /* Kilos que entran por gaveta en ESTE lote, según lo que pesó la
       báscula: no se usa el peso nominal, que casi nunca se cumple. */
    /* Lo que de verdad llega a la mesa: lo pesado menos lo retirado al
       descargar, que nunca entró a selección. */
    const kgAProceso = (l.kgRecibidos || 0) - (l.kgRetirados || 0);
    const kgPorGaveta = l.gavetasRecibidas > 0 ? kgAProceso / l.gavetasRecibidas : linea.pesoGavetaKg;

    const campos = [
      { tipo: "html", contenido: fichaMini(l) },
      { nombre: "fecha", etiqueta: "Fecha de proceso", tipo: "date",
        valor: corregir ? prodPrevia.fecha : DB.hoy(),
        requerido: true, ancho: "mitad",
        validar: function (v) {
          if (v > DB.hoy()) return "La fecha no puede ser futura.";
          if (v < l.fechaRecepcion) return "No se puede procesar antes de recibir el lote (" +
            UI.fechaLarga(l.fechaRecepcion) + ").";
          return null;
        } },
      { nombre: "turno", etiqueta: "Turno", tipo: "select", ancho: "mitad",
        valor: corregir ? prodPrevia.turno : "Matutino",
        opciones: DB.TURNOS.map(function (t) { return { valor: t, texto: t }; }) },
      { nombre: "gavetasProcesadas", etiqueta: "Gavetas ingresadas a proceso", tipo: "number",
        requerido: true, min: 1, max: l.gavetasRecibidas, paso: "1", ancho: "mitad",
        valor: corregir ? prodPrevia.gavetasProcesadas : l.gavetasRecibidas,
        ayuda: "El lote trajo " + nf(l.gavetasRecibidas) + " gavetas." },
      { nombre: "cajasExportables", etiqueta: "Cajas exportables obtenidas", tipo: "number",
        requerido: true, min: 0, paso: "1", ancho: "mitad",
        valor: corregir ? prodPrevia.cajasExportables : "",
        /* Se dice cuántas deberían salir: quien registra compara en vez de
           calcular, y una diferencia grande salta sola. */
        ayudaHTML: "Cajas de " + nf(linea.pesoCajaKg, 1) + " kg. Con este lote deberían salir " +
          "unas <strong>" + nf(l.gavetasRecibidas * estudio.cajasPorGaveta) + "</strong>.",
        validar: function (v, d) {
          const kgProc = (Number(d.gavetasProcesadas) || 0) * kgPorGaveta;
          return kgProc > 0 && v * linea.pesoCajaKg > kgProc
            ? "Lo empacado pesa más que lo que entró a proceso." : null;
        } },
      { nombre: "operarios", etiqueta: "Operarios en la línea", tipo: "number", requerido: true,
        min: 1, max: 100, paso: "1", ancho: "mitad",
        valor: corregir ? prodPrevia.operarios : 4 },
      { nombre: "tiempoRealMin", etiqueta: "¿Cuánto tardó la línea? (minutos de reloj)",
        tipo: "number", requerido: true, min: 1, paso: "1", ancho: "mitad",
        valor: corregir ? prodPrevia.tiempoRealMin : "",
        /* El estándar está en minutos-persona y el campo pide minutos de
           reloj: decirlo evita que alguien escriba el número equivocado,
           que era fácil y silencioso. */
        ayudaHTML: '<span id="pistaTiempo">Lo que marcó el reloj, de principio a fin.</span>' },
      { nombre: "operador", etiqueta: "Responsable de línea", tipo: "text", requerido: true,
        valor: corregir ? prodPrevia.operador : usuario.nombre, ancho: "mitad" },
      { nombre: "tasaCalc", etiqueta: "Rendimiento (kg empacados / kg procesados)", tipo: "calculado", ancho: "mitad" },
      { nombre: "eficienciaCalc", etiqueta: "Eficiencia de la mano de obra", tipo: "calculado", ancho: "mitad" },
      { nombre: "mermas", etiqueta: "¿Dónde se perdió la fruta?", tipo: "repetible",
        textoAgregar: "Agregar pérdida",
        ayuda: "Cada kilo perdido dice en qué etapa se cayó, por qué y a dónde fue. " +
          "La suma debe cuadrar con lo que entró a la mesa menos lo que se empacó.",
        columnas: [
          { nombre: "etapa", etiqueta: "Etapa", tipo: "select",
            opciones: function () {
              return DB.ETAPAS.filter(function (e) { return e.id !== "recepcion"; })
                .map(function (e) {
                  return { valor: e.id, texto: DB.nombreEtapa(linea.id, e.id) };
                });
            } },
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
          const proc = Number(d.gavetasProcesadas) || 0;
          const expo = Number(d.cajasExportables) || 0;
          const objetivo = proc * kgPorGaveta - expo * linea.pesoCajaKg;
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
        valor: corregir ? prodPrevia.observaciones : "",
        marcador: "Paradas de línea, novedades, incidencias del lote." },
      { nombre: "motivo", etiqueta: "Motivo de la corrección", tipo: "text",
        requerido: !!corregir,
        marcador: "Por qué se corrige: error al teclear, recuento repetido…",
        ayuda: corregir ? "Queda escrito en la bitácora junto a los valores anteriores." : "" }
    ].filter(function (c) { return corregir || c.nombre !== "motivo"; });

    UI.abrirFormulario((corregir ? "Corregir producción de " : "Procesar lote ") + l.codigoLote,
      campos, function (d) {
      if (corregir) {
        const cambios = diferencias(prodPrevia, d, {
          fecha: "Fecha", turno: "Turno",
          gavetasProcesadas: "Gavetas procesadas", cajasExportables: "Cajas exportables",
          operarios: "Operarios", tiempoRealMin: "Tiempo real", operador: "Responsable"
        });
        const clave = function (lista) {
          return JSON.stringify((lista || []).map(function (m) {
            return [m.causaId, m.kg, m.destinoId];
          }));
        };
        const mermaCambio = clave(prodPrevia.mermas) !== clave(d.mermas);
        if (!cambios.length && !mermaCambio) return { error: "No cambiaste ningún dato." };
        if (mermaCambio) cambios.push({ campo: "Reparto de merma", antes: "—", despues: "revisado" });

        DB.update("producciones", prodPrevia.id, {
          fecha: d.fecha, turno: d.turno,
          gavetasProcesadas: Number(d.gavetasProcesadas),
          kgProcesados: Math.round(Number(d.gavetasProcesadas) * kgPorGaveta),
          cajasExportables: Number(d.cajasExportables),
          kgExportable: Math.round(Number(d.cajasExportables) * linea.pesoCajaKg),
          mermas: d.mermas, operarios: Number(d.operarios),
          tiempoRealMin: Number(d.tiempoRealMin), operador: d.operador,
          observaciones: d.observaciones || "",
          corregidoPor: usuario.id, fechaCorreccion: new Date().toISOString(),
          correcciones: (prodPrevia.correcciones || 0) + 1
        });
        DB.registrarBitacora(usuario.id, "Corrección de producción",
          prodPrevia.folio + " · " + textoCambios(cambios) + " · motivo: " + d.motivo);
        UI.aviso("Producción corregida. El cambio quedó en la bitácora.");
        render();
        return;
      }

      const prod = DB.insert("producciones", {
        folio: DB.siguienteFolio("producciones", "PRD"),
        fecha: d.fecha,
        loteId: l.id,
        codigoLote: l.codigoLote,
        lineaId: l.lineaId,
        turno: d.turno,
        gavetasProcesadas: Number(d.gavetasProcesadas),
        kgProcesados: Math.round(Number(d.gavetasProcesadas) * kgPorGaveta),
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
        pct(prod.gavetasProcesadas > 0 ? prod.cajasExportables / prod.gavetasProcesadas : 0));
      UI.aviso("Listo: el lote " + l.codigoLote + " pasó a Procesado. " +
        "Ahora Supervisión lo cierra.");
      render();
    }, {
      aceptar: "Registrar producción",
      ancho: true,
      filasIniciales: {
        mermas: corregir ? (prodPrevia.mermas || []).map(function (m) {
          return { etapa: m.etapa || "seleccion", causaId: m.causaId, kg: m.kg,
                   destinoId: m.destinoId };
        }) : [
          { etapa: "seleccion", causaId: "CR5", destinoId: "ds_subproducto" },
          { etapa: "seleccion", causaId: "CR6", destinoId: "ds_segunda" },
          { etapa: "empaque", causaId: "CR8", destinoId: "ds_animal" }
        ]
      },
      alCambiar: function (d, form) {
        const proc = Number(d.gavetasProcesadas) || 0;
        const expo = Number(d.cajasExportables) || 0;
        const real = Number(d.tiempoRealMin) || 0;

        const outT = $("#tasaCalc", form);
        if (outT) {
          if (proc <= 0 || expo <= 0) { outT.textContent = "—"; outT.className = ""; }
          else {
            /* Rendimiento en KILOS: cajas sobre gavetas no es una tasa. */
            const t = (expo * linea.pesoCajaKg) / (proc * kgPorGaveta);
            outT.textContent = pct(t) + (t >= linea.metaRendimiento ? " · sobre la meta" : " · bajo la meta");
            outT.className = t >= linea.metaRendimiento ? "ok" : "bajo";
          }
        }

        /* El estándar se enseña traducido al reloj con la gente que se
           acaba de escribir: así se compara con lo que la persona va a
           teclear, en vez de obligarla a dividir mentalmente. */
        const gente = Number(d.operarios) || 0;
        const estPersona = proc * estudio.contenidoGavetaMin;
        const pista = $("#pistaTiempo", form);
        if (pista) {
          pista.innerHTML = proc > 0 && gente > 0
            ? "Con <strong>" + nf(gente) + "</strong> operarios, el estándar para estas " +
              nf(proc) + " gavetas es <strong>" + nf(estPersona / gente, 0) +
              " min</strong> de reloj."
            : "Lo que marcó el reloj, de principio a fin.";
        }

        const outE = $("#eficienciaCalc", form);
        if (outE) {
          if (proc <= 0 || real <= 0 || gente <= 0) { outE.textContent = "—"; outE.className = ""; }
          else {
            /* Minutos-persona contra minutos-persona: el reloj por la gente. */
            const ef = estPersona / (real * gente);
            outE.textContent = pct(ef) + " · estándar " + nf(estPersona / gente, 0) +
              " min de reloj con " + nf(gente) + " operarios";
            outE.className = ef >= 0.95 ? "ok" : "bajo";
          }
        }

        const balance = $("[data-balance]", form);
        if (balance) {
          const objetivo = proc * kgPorGaveta - expo * linea.pesoCajaKg;
          const suma = UI.leerRepetible(form, "mermas", [
            { nombre: "etapa", tipo: "select" },
            { nombre: "causaId", tipo: "select" }, { nombre: "kg", tipo: "number" },
            { nombre: "destinoId", tipo: "select" }
          ]).reduce(function (a, m) { return a + m.kg; }, 0);
          if (objetivo <= 0) {
            balance.className = "balance";
            balance.innerHTML = "Escribe primero las gavetas procesadas y las cajas obtenidas.";
          } else {
            const falta = objetivo - suma;
            const ok = Math.abs(falta) <= Math.max(1, objetivo * 0.005);
            balance.className = "balance " + (ok ? "balance-ok" : "balance-pendiente");
            balance.innerHTML = "Se perdieron <strong>" + nf(objetivo, 1) + " kg</strong> " +
              '<span class="tenue">(' + nf(proc * kgPorGaveta, 0) + " kg entraron a la mesa" +
              (l.kgRetirados ? ", ya sin los " + nf(l.kgRetirados, 0) + " retirados al recibir" : "") +
              " − " + nf(expo * linea.pesoCajaKg, 0) + " kg se empacaron)</span> · repartidos: " +
              "<strong>" + nf(suma, 1) + " kg</strong> · " +
              (ok ? "balance de masa cuadrado"
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
      { titulo: "Anunciadas", num: true, valor: function (l) { return nf(l.gavetasAnunciadas); },
        csv: function (l) { return l.gavetasAnunciadas; } },
      { titulo: "Pesadas", num: true, valor: function (l) {
        return l.gavetasRecibidas === null ? '<span class="tenue">—</span>' : nf(l.gavetasRecibidas); },
        csv: function (l) { return l.gavetasRecibidas === null ? "" : l.gavetasRecibidas; } },
      { titulo: "Diferencia", num: true, valor: function (l) {
        if (l.gavetasRecibidas === null || !l.gavetasAnunciadas) return '<span class="tenue">—</span>';
        const d = (l.gavetasRecibidas - l.gavetasAnunciadas) / l.gavetasAnunciadas;
        const clase = Math.abs(d) <= 0.01 ? "etq-ok" : Math.abs(d) <= 0.03 ? "etq-B" : "etq-bajo";
        return '<span class="etq ' + clase + '">' + pctFirmado(d) + "</span>"; },
        csv: function (l) {
          if (l.gavetasRecibidas === null || !l.gavetasAnunciadas) return "";
          return (((l.gavetasRecibidas - l.gavetasAnunciadas) / l.gavetasAnunciadas) * 100).toFixed(2); } },
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
    if (l.gavetasRecibidas !== null && l.estado !== "Cerrado" && l.estado !== "Rechazado" &&
        puede("corregir_pesaje")) {
      b += '<button class="btn-mini" data-corregir-pesaje="' + esc(l.id) + '">Corregir pesaje</button>';
    }
    if (l.estado === "Procesado" && puede("corregir_produccion")) {
      b += '<button class="btn-mini" data-corregir-prod="' + esc(l.id) + '">Corregir producción</button>';
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

  /* Ya procesados y todavía abiertos: el pedido está terminado en planta
     pero nadie ha dado el cierre. No se filtran por fecha a propósito —un
     pedido olvidado de hace tres semanas tiene que seguir saltando a la
     vista aunque el filtro mire solo esta semana. */
  function lotesPorCerrar() {
    return DB.all("lotes").filter(function (l) { return l.estado === "Procesado"; })
      .sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
  }

  function vistaLotes() {
    const lista = Indicadores.filtrar(filtros).lotes
      .sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });
    const porCerrar = lotesPorCerrar();
    /* La fecha de proceso vive en el registro de producción, no en el lote. */
    const fechaProceso = {};
    DB.all("producciones").forEach(function (p) { fechaProceso[p.loteId] = p.fecha; });

    let html = '<div class="vista-cab"><div><h1>Lotes</h1>' +
      '<p class="sub">Recorrido completo, del anuncio del proveedor al cierre.</p></div>' +
      '<div class="cab-acciones"><button class="btn btn-plano" id="btnCsvLotes">Exportar CSV</button></div></div>';

    /* Mientras se busca algo concreto, la cola de cierre sobra: quien
       escribe un código quiere ver ese lote, no otra tabla encima. */
    if (puede("cerrar") && !filtros.texto) {
      html += '<section class="panel panel-destacado"><h2>Terminados, esperando el cierre (' +
        nf(porCerrar.length) + ")</h2>" +
        '<p class="sub panel-sub">Producción ya registró estos pedidos. Al cerrarlos ' +
        "quedan sin más cambios y el proveedor recibe su reporte.</p>";
      if (!porCerrar.length) {
        html += '<p class="vacio">Ningún pedido pendiente de cierre. Todo al día.</p>';
      } else {
        html += UI.tabla([
          { titulo: "Lote", valor: function (l) { return "<code>" + esc(l.codigoLote) + "</code>"; } },
          { titulo: "Proveedor", valor: function (l) { return esc(Indicadores.nombreProveedor(l.proveedorId)); } },
          { titulo: "Línea", valor: function (l) { return UI.etiquetaLinea(l.lineaId); } },
          { titulo: "Procesado", valor: function (l) {
            return UI.fechaCorta(fechaProceso[l.id] || l.fechaRecepcion || l.fecha); } },
          { titulo: "Días abierto", num: true, valor: function (l) {
            const d = Math.round((new Date(DB.hoy()) - new Date(l.fecha)) / 86400000);
            return d > 7 ? '<strong class="dias-alerta">' + nf(d) + "</strong>" : nf(d); } },
          { titulo: "Cajas", num: true, valor: function (l) { return nf(l.gavetasRecibidas); } },
          { titulo: "", valor: function (l) {
            return '<button class="btn-mini" data-ficha="' + esc(l.id) + '">Ficha</button>' +
              '<button class="btn-mini btn-mini-accion" data-cerrar="' + esc(l.id) +
              '">Cerrar pedido</button>'; } }
        ], porCerrar, {});
      }
      html += "</section>";
      html += '<h2 class="seccion-titulo">Todos los lotes</h2>';
    }

    html += barraFiltros({ calidad: true, estado: true });

    const anun = lista.reduce(function (a, l) { return a + l.gavetasAnunciadas; }, 0);
    const rec = lista.reduce(function (a, l) { return a + (l.gavetasRecibidas || 0); }, 0);
    html += '<p class="resumen-linea"><strong>' + nf(lista.length) + "</strong> lotes · anunciadas <strong>" +
      nf(anun) + "</strong> gavetas · pesadas <strong>" + nf(rec) + "</strong></p>";

    html += UI.tabla(columnasLote({}), lista, { vacio: "No hay lotes en este período." });
    return html;
  }

  /* ----------------------------------------------------- ficha del lote */

  function fichaMini(l) {
    return '<div class="ficha-mini">' +
      "<div><span>Lote</span><strong>" + esc(l.codigoLote) + "</strong></div>" +
      "<div><span>Proveedor</span><strong>" + esc(Indicadores.nombreProveedor(l.proveedorId)) + "</strong></div>" +
      "<div><span>Línea</span><strong>" + esc(Indicadores.nombreLinea(l.lineaId)) + "</strong></div>" +
      "<div><span>Anunciadas</span><strong>" + nf(l.gavetasAnunciadas) + " gavetas</strong></div>" +
      "<div><span>Peso declarado</span><strong>" + nf(l.pesoGavetaDeclarado || 0, 1) +
      " kg/gaveta</strong></div>" +
      "<div><span>Total declarado</span><strong>" + nf(l.kgAnunciados || 0) + " kg</strong></div>" +
      (l.gavetasRecibidas !== null
        ? "<div><span>Pesadas</span><strong>" + nf(l.gavetasRecibidas) + " gavetas</strong></div>" : "") +
      "</div>";
  }

  /* La pregunta que de verdad se hace quien abre una ficha es «y ahora
     qué». Ningún estado se marca a mano: cada uno se alcanza haciendo el
     trabajo, y aquí se dice cuál es y a quién le toca. */
  function SIGUIENTE(l) {
    if (l.estado === "Rechazado") {
      return { texto: "El lote no entró a planta. El proveedor ya ve el motivo en su portal.",
               quien: "Nada pendiente", icono: "veto", tono: "alerta" };
    }
    if (l.estado === "Anunciado") {
      return { texto: "Falta contarlo y pesarlo. Se hace desde Recepción y pesaje, " +
                      "con el botón Pesar.",
               quien: "Le toca a Recepción", icono: "balanza", ir: "recepcion",
               puede: puede("pesar") };
    }
    if (l.estado === "Recibido") {
      return { texto: "No hay que marcarlo como procesado: el lote pasa solo a Procesado " +
                      "cuando se registra el trabajo, desde Producción, con el botón " +
                      "Registrar producción.",
               quien: "Le toca a Producción", icono: "planta", ir: "produccion",
               puede: puede("procesar") };
    }
    if (l.estado === "Procesado") {
      return { texto: "Ya está trabajado. Falta cerrarlo, desde Lotes, en el bloque " +
                      "«Terminados, esperando el cierre».",
               quien: "Le toca a Supervisión", icono: "listo", ir: "lotes",
               puede: puede("cerrar") };
    }
    return { texto: l.reporteEnviado
               ? "Terminado. El proveedor ya tiene su reporte."
               : "Terminado, pero el reporte todavía no se publicó al proveedor.",
             quien: "Nada pendiente", icono: "bandera", tono: "ok" };
  }

  function siguientePaso(l) {
    const s = SIGUIENTE(l);
    return '<div class="siguiente siguiente-' + (s.tono || "normal") + '">' +
      '<span class="siguiente-icono" aria-hidden="true">' + UI.icono(s.icono) + "</span>" +
      '<div><strong>¿Qué sigue? · ' + esc(s.quien) + "</strong>" +
      "<small>" + esc(s.texto) + "</small></div>" +
      (s.ir && s.puede
        ? '<button type="button" class="btn btn-sec btn-sm" data-ir="' + esc(s.ir) +
          '">Ir allá</button>'
        : "") + "</div>";
  }

  function fichaCompleta(f) {
    if (!f) return "<p>Lote no encontrado.</p>";
    const l = f.lote, p = f.produccion;
    let html = '<div class="ficha"><div class="ficha-linea">';

    [["Anunciado", l.fecha, true, Indicadores.nombreUsuario(l.anunciadoPor)],
     [l.estado === "Rechazado" ? "Rechazado" : "Pesado", l.fechaRecepcion,
      l.gavetasRecibidas !== null, Indicadores.nombreUsuario(l.recibidoPor)],
     ["Procesado", p ? p.fecha : null, !!p, p ? p.operador : ""],
     ["Cerrado", l.fechaCierre, l.estado === "Cerrado", Indicadores.nombreUsuario(l.cerradoPor)]
    ].forEach(function (h, i) {
      html += '<div class="ficha-hito' + (h[2] ? " hito-hecho" : "") + '">' +
        '<span class="hito-punto">' + (i + 1) + "</span><strong>" + esc(h[0]) + "</strong>" +
        "<small>" + (h[1] ? UI.fechaLarga(h[1]) + "<br>" + esc(h[3] || "") : "Pendiente") + "</small></div>";
    });
    html += "</div>" + siguientePaso(l) + "<div class='ficha-bloques'>";

    html += "<section><h4>Identificación</h4><dl>" +
      "<dt>Lote</dt><dd><code>" + esc(l.codigoLote) + "</code></dd>" +
      "<dt>Folio</dt><dd>" + esc(l.folio) + "</dd>" +
      "<dt>Proveedor</dt><dd>" + esc(f.proveedor ? f.proveedor.nombre : "—") + "</dd>" +
      "<dt>Línea</dt><dd>" + esc(f.linea ? f.linea.nombre : "—") + "</dd>" +
      "<dt>Transporte</dt><dd>" + esc(l.transporte) + "</dd>" +
      "<dt>Estado</dt><dd>" + UI.insignia(l.estado) + "</dd>" +
      (l.correcciones
        ? "<dt>Correcciones</dt><dd>" + nf(l.correcciones) + " · última por " +
          esc(Indicadores.nombreUsuario(l.corregidoPor)) + "</dd>"
        : "") + "</dl></section>";

    html += "<section><h4>Gavetas y calidad</h4><dl>" +
      "<dt>Anunciadas</dt><dd>" + nf(l.gavetasAnunciadas) + " (calidad " + esc(l.calidadDeclarada) + ")</dd>" +
      "<dt>Pesadas</dt><dd>" + (l.gavetasRecibidas === null ? "—" :
        nf(l.gavetasRecibidas) + " (calidad " + esc(l.calidadVerificada) + ")") + "</dd>" +
      "<dt>Peso declarado</dt><dd>" + nf(l.pesoGavetaDeclarado || 0, 1) + " kg/gaveta · " +
      nf(l.kgAnunciados || 0) + " kg</dd>" +
      "<dt>Peso real</dt><dd>" + (l.kgRecibidos === null ? "—" :
        nf(l.kgRecibidos) + " kg · " + nf(f.pesoGavetaReal || 0, 2) + " kg/gaveta") + "</dd>" +
      "<dt>Dif. de peso</dt><dd>" + (f.tasaDiferenciaKg === null ? "—" :
        '<span class="etq ' + (Math.abs(f.tasaDiferenciaKg) <= 0.02 ? "etq-ok" : "etq-bajo") + '">' +
        (f.diferenciaKg >= 0 ? "+" : "") + nf(f.diferenciaKg) + " kg · " +
        pctFirmado(f.tasaDiferenciaKg) + "</span>") + "</dd>" +
      "<dt>Diferencia</dt><dd>" + (f.diferenciaGavetas === null ? "—" :
        '<span class="etq ' + (Math.abs(f.tasaDiferencia) <= 0.01 ? "etq-ok" : "etq-bajo") + '">' +
        (f.diferenciaGavetas >= 0 ? "+" : "") + nf(f.diferenciaGavetas) + " · " +
        pctFirmado(f.tasaDiferencia) + "</span>") + "</dd>" +
      "<dt>Precio</dt><dd>" + money(l.precioKg) + " / kg</dd>" +
      "<dt>A liquidar</dt><dd><strong>" + money(f.valor) + "</strong></dd></dl></section>";

    if (p) {
      html += "<section><h4>Resultado del proceso</h4><dl>" +
        "<dt>Procesadas</dt><dd>" + nf(p.gavetasProcesadas) + " gavetas</dd>" +
        "<dt>Exportables</dt><dd><strong>" + nf(p.cajasExportables) + " cajas</strong></dd>" +
        "<dt>Tasa</dt><dd>" + '<span class="etq ' + (f.tasaExportable >= f.meta ? "etq-ok" : "etq-bajo") +
        '">' + pct(f.tasaExportable) + "</span> (meta " + pct(f.meta) + ")</dd>" +
        "<dt>Tiempo real</dt><dd>" + UI.minutos(p.tiempoRealMin) + "</dd>" +
        "<dt>Estándar</dt><dd>" + UI.minutos(f.tiempoEstandarMin) + " persona</dd>" +
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
            esc(d ? d.nombre : "—") + (d && !d.valoriza ? " (sin valorizar)" : "") + "</small></span>" +
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
    /* Quien abre la ficha de un pedido terminado casi siempre viene a
       cerrarlo: el botón tiene que estar ahí, no en otra pantalla. */
    const cerrable = f.lote.estado === "Procesado" && puede("cerrar");
    abrirPanel("Ficha del lote " + f.lote.codigoLote, fichaCompleta(f), true,
      cerrable ? { texto: "Cerrar pedido", accion: function () { cerrarLote(loteId); } } : null);
  }

  function abrirPanel(titulo, cuerpo, imprimible, principal) {
    const capa = document.createElement("div");
    capa.className = "modal-capa";
    capa.innerHTML = '<div class="modal modal-ancho" role="dialog" aria-modal="true" aria-labelledby="panelTitulo">' +
      '<header class="modal-cab"><h2 id="panelTitulo">' + esc(titulo) + "</h2>" +
      '<button type="button" class="modal-x" aria-label="Cerrar">&times;</button></header>' +
      '<div class="modal-cuerpo modal-cuerpo-libre">' + cuerpo + "</div>" +
      '<footer class="modal-pie modal-pie-fijo">' +
      '<button type="button" class="btn btn-plano" data-cancelar>Salir</button>' +
      (imprimible ? '<button type="button" class="btn btn-sec" id="btnImprimirFicha">Imprimir</button>' : "") +
      (principal ? '<button type="button" class="btn btn-primario" id="btnPanelPrincipal">' +
        esc(principal.texto) + "</button>" : "") +
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
    /* El «ir allá» del bloque «¿qué sigue?» vive dentro del modal, que se
       monta después de enlazar la página: hay que atarlo aquí. */
    $$("[data-ir]", capa).forEach(function (b) {
      b.addEventListener("click", function () {
        const destino = b.dataset.ir;
        cerrar();
        ir(destino);
      });
    });

    const btnPrincipal = $("#btnPanelPrincipal", capa);
    if (btnPrincipal) {
      btnPrincipal.addEventListener("click", function () { cerrar(); principal.accion(); });
    }
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
    }, { aceptar: "Cerrar pedido", ancho: true,
         nota: "Al cerrarlo, el pedido <strong>queda terminado y no admite más cambios</strong> " +
           "de ningún rol. Si hace falta corregir algo después, Supervisión puede reabrirlo " +
           "desde Lotes y queda anotado en la bitácora." });
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
        { titulo: "Anunciadas", num: true, valor: function (m) { return nf(m.gavetasAnunciadas); },
          csv: function (m) { return m.gavetasAnunciadas; } },
        { titulo: "Pesadas", num: true, valor: function (m) { return nf(m.gavetasRecibidas); },
          csv: function (m) { return m.gavetasRecibidas; } },
        { titulo: "Exactitud", num: true, valor: function (m) {
          const clase = Math.abs(m.tasaDiferencia) <= 0.01 ? "etq-ok" : "etq-bajo";
          return '<span class="etq ' + clase + '">' + pctFirmado(m.tasaDiferencia) + "</span>"; },
          csv: function (m) { return (m.tasaDiferencia * 100).toFixed(2); } },
        { titulo: "Dif. peso", num: true, valor: function (m) {
          const clase = Math.abs(m.tasaDiferenciaKg) <= 0.02 ? "etq-ok" : "etq-bajo";
          return '<span class="etq ' + clase + '">' + pctFirmado(m.tasaDiferenciaKg) + "</span>"; },
          csv: function (m) { return (m.tasaDiferenciaKg * 100).toFixed(2); } },
        { titulo: "kg/gaveta real", num: true, valor: function (m) { return nf(m.pesoGavetaReal, 2); },
          csv: function (m) { return m.pesoGavetaReal.toFixed(2); } },
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
        { titulo: "Recibidas", num: true, valor: function (m) { return nf(m.gavetasRecibidas); },
          csv: function (m) { return m.gavetasRecibidas; } },
        { titulo: "Procesadas", num: true, valor: function (m) { return nf(m.gavetasProcesadas); },
          csv: function (m) { return m.gavetasProcesadas; } },
        { titulo: "Exportables", num: true, valor: function (m) { return nf(m.cajasExportables); },
          csv: function (m) { return m.cajasExportables; } },
        { titulo: "Tasa", num: true, valor: function (m) { return pct(m.tasaExportable); },
          csv: function (m) { return (m.tasaExportable * 100).toFixed(2); } },
        { titulo: "Meta", num: true, valor: function (m) { return pct(m.meta); },
          csv: function (m) { return (m.meta * 100).toFixed(2); } },
        { titulo: "Brecha", num: true, valor: function (m) {
          return '<span class="etq ' + (m.brecha >= 0 ? "etq-ok" : "etq-bajo") + '">' + pctFirmado(m.brecha) + "</span>"; },
          csv: function (m) { return (m.brecha * 100).toFixed(2); } },
        { titulo: "Contenido", num: true, valor: function (m) {
          const e = Indicadores.estudioTiempos(m.lineaId);
          return e ? nf(e.contenidoGavetaMin, 2) + " min-pers" : "—"; },
          csv: function (m) {
            const e = Indicadores.estudioTiempos(m.lineaId);
            return e ? e.contenidoGavetaMin.toFixed(2) : ""; } },
        { titulo: "Min-pers/gaveta real", num: true, valor: function (m) { return nf(m.minutosPorGaveta, 2); },
          csv: function (m) { return m.minutosPorGaveta.toFixed(2); } },
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
      '<p class="hoja-empresa">' + esc(DB.nombreEmpresa(true)) + "</p>" +
      "<h2>" + esc(def.titulo) + "</h2>" +
      '<p class="sub">' + esc(def.descripcion) + "</p></div>" +
      '<div class="hoja-meta"><p><strong>Período:</strong> ' + UI.fechaLarga(filtros.desde) +
      " — " + UI.fechaLarga(filtros.hasta) + "</p>" +
      "<p><strong>Emitido:</strong> " + UI.fechaLarga(DB.hoy()) + "</p>" +
      "<p><strong>Por:</strong> " + esc(usuario.nombre) + "</p></div></header>";

    html += '<div class="hoja-kpis">' +
      '<div><span>Cajas recibidas</span><strong>' + nf(k.gavetasRecibidas) + "</strong></div>" +
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

    html += '<footer class="hoja-pie"><p>' + esc(DB.MARCA.producto) + " · " +
      esc(DB.MARCA.descripcion) + " · Documento generado el " + UI.fechaLarga(DB.hoy()) + ".</p>" +
      '<p class="hoja-origenes">Origen de los parámetros: ' + UI.origen("M") + " medido · " +
      UI.origen("E") + " estimado · " + UI.origen("S") + " fuente secundaria.</p></footer>";
    html += "</section>";
    return html;
  }

  /* ============================== novedades =========================== */

  function novedadesActuales() {
    const lista = Novedades.listar(usuario);
    /* Se marcan vistas al mostrarlas, no al pulsarlas: si la persona las
       leyó y no hizo nada, ya se enteró, y volver a avisarle es ruido. */
    Novedades.marcarVistos(usuario, lista);
    return lista;
  }

  function enlazarNovedades() {
    const btn = $("#btnCampana");
    if (btn) {
      btn.addEventListener("click", function () {
        novedadesAbiertas = !novedadesAbiertas;
        render();
      });
    }
    const cerrar = $("#cerrarNovedades");
    if (cerrar) {
      cerrar.addEventListener("click", function () { novedadesAbiertas = false; render(); });
    }
    $$("[data-novedad]").forEach(function (b) {
      b.addEventListener("click", function () {
        novedadesAbiertas = false;
        const lote = b.dataset.novedadLote;
        vista = b.dataset.novedad;
        render();
        if (lote) verFicha(lote);
      });
    });
  }

  /* ========================== liquidaciones ===========================
     El documento con el que se paga al proveedor. Es lo que cierra el
     ciclo: él anuncia, la planta pesa, y esto resulta de ese pesaje.
     =================================================================== */

  let provLiquidacion = null;

  function vistaLiquidacion() {
    const todas = Indicadores.liquidaciones(filtros);

    let html = '<div class="vista-cab"><div><h1>Liquidaciones</h1>' +
      '<p class="sub">Lo que hay que pagarle a cada proveedor por el período, ' +
      "sobre el kilo de báscula.</p></div>" +
      '<div class="cab-acciones">' +
      '<button class="btn btn-plano" id="btnCsvLiquidacion">Exportar CSV</button>' +
      '<button class="btn btn-primario" id="btnImprimir">Imprimir / PDF</button></div></div>';

    html += barraFiltros({ buscar: false });

    if (!todas.length) {
      return html + '<p class="vacio">Ningún proveedor entregó fruta en este período.</p>';
    }

    const total = todas.reduce(function (a, x) { return a + x.importe; }, 0);
    const kg = todas.reduce(function (a, x) { return a + x.kg; }, 0);
    const enProceso = todas.reduce(function (a, x) { return a + x.enProceso; }, 0);

    html += '<div class="kpis">' +
      UI.kpi("A pagar en el período", money(total),
        nf(todas.length) + " proveedores · " + nf(kg) + " kg", "bien") +
      UI.kpi("Precio promedio", money(kg > 0 ? total / kg : 0) + "/kg",
        "ponderado por kilo entregado") +
      UI.kpi("Lotes todavía en planta", nf(enProceso),
        enProceso > 0 ? "ya pesados: se pagan igual" : "todo cerrado",
        enProceso > 0 ? "regular" : "bien") +
      "</div>";

    html += '<section class="panel"><h2>Resumen por proveedor</h2>' +
      UI.tabla([
        { titulo: "Proveedor", valor: function (x) {
          return "<strong>" + esc(x.proveedor.nombre) + "</strong>" +
            '<br><small class="tenue">' + esc(x.proveedor.documento) + "</small>"; },
          csv: function (x) { return x.proveedor.nombre; } },
        { titulo: "Lotes", num: true, valor: function (x) {
          return nf(x.lotesPagables) + (x.lotesRechazados
            ? ' <small class="tenue">+' + nf(x.lotesRechazados) + " rech.</small>" : ""); },
          csv: function (x) { return x.lotesPagables; } },
        { titulo: "Gavetas", num: true, valor: function (x) { return nf(x.gavetas); },
          csv: function (x) { return x.gavetas; } },
        { titulo: "Kilos", num: true, valor: function (x) { return nf(x.kg) + " kg"; },
          csv: function (x) { return x.kg.toFixed(1); } },
        { titulo: "Dif. con lo declarado", num: true, valor: function (x) {
          const c = Math.abs(x.tasaDiferencia) <= 0.01 ? "etq-ok"
            : Math.abs(x.tasaDiferencia) <= 0.03 ? "etq-B" : "etq-bajo";
          return '<span class="etq ' + c + '">' + pctFirmado(x.tasaDiferencia) + "</span>"; },
          csv: function (x) { return (x.tasaDiferencia * 100).toFixed(2); } },
        { titulo: "$/kg", num: true, valor: function (x) { return money(x.precioPromedio); },
          csv: function (x) { return x.precioPromedio.toFixed(3); } },
        { titulo: "A pagar", num: true, valor: function (x) {
          return "<strong>" + money(x.importe) + "</strong>"; },
          csv: function (x) { return x.importe.toFixed(2); } },
        { titulo: "", valor: function (x) {
          return '<button class="btn-mini btn-mini-accion" data-liquidar="' +
            esc(x.proveedor.id) + '">Ver documento</button>'; },
          csv: function () { return ""; } }
      ], todas, {}) + "</section>";

    html += '<p class="nota-info">Se liquida sobre el <strong>kilo de báscula</strong>, ' +
      "no sobre lo que el proveedor declaró ni sobre bultos: es el único dato que las dos " +
      "partes vieron. Un lote pesado se paga aunque todavía esté en planta —lo que se " +
      "liquida es lo que entró, no lo que salió— y los rechazados aparecen con importe " +
      "cero y su motivo.</p>";

    return html;
  }

  /* El documento en sí, imprimible y con sus firmas. */
  function hojaLiquidacion(liq) {
    let html = '<div class="hoja hoja-liquidacion">' +
      '<header class="hoja-cab"><div>' +
      '<p class="hoja-empresa">' + esc(DB.nombreEmpresa(true)) + "</p>" +
      "<h2>Liquidación de entrega</h2>" +
      '<p class="sub">' + esc(liq.proveedor.nombre) + " · " + esc(liq.proveedor.documento) +
      "</p></div>" +
      '<div class="hoja-meta"><p><strong>Documento:</strong> <code>' + esc(liq.folio) + "</code></p>" +
      "<p><strong>Período:</strong> " + UI.fechaLarga(liq.desde) + " — " + UI.fechaLarga(liq.hasta) + "</p>" +
      "<p><strong>Emitido:</strong> " + UI.fechaLarga(DB.hoy()) + "</p></div></header>";

    html += '<div class="hoja-kpis">' +
      "<div><span>Lotes pagables</span><strong>" + nf(liq.lotesPagables) + "</strong></div>" +
      "<div><span>Gavetas</span><strong>" + nf(liq.gavetas) + "</strong></div>" +
      "<div><span>Kilos de báscula</span><strong>" + nf(liq.kg) + "</strong></div>" +
      "<div><span>Precio promedio</span><strong>" + money(liq.precioPromedio) + "/kg</strong></div>" +
      "<div><span>Total a pagar</span><strong>" + money(liq.importe) + "</strong></div>" +
      "</div>";

    html += UI.tabla([
      { titulo: "Fecha", valor: function (d) { return UI.fechaCorta(d.fecha); } },
      { titulo: "Lote", valor: function (d) { return "<code>" + esc(d.codigoLote) + "</code>"; } },
      { titulo: "Producto", valor: function (d) { return esc(d.linea); } },
      { titulo: "Calidad", valor: function (d) {
        return '<span class="etq etq-' + esc(d.calidad) + '">' + esc(d.calidad) + "</span>"; } },
      { titulo: "Gavetas", num: true, valor: function (d) { return d.rechazado ? "—" : nf(d.gavetas); } },
      { titulo: "Kilos", num: true, valor: function (d) { return d.rechazado ? "—" : nf(d.kg); } },
      { titulo: "$/kg", num: true, valor: function (d) { return d.rechazado ? "—" : money(d.precioKg); } },
      { titulo: "Importe", num: true, valor: function (d) {
        return d.rechazado
          ? '<span class="etq etq-bajo">Rechazado</span>'
          : "<strong>" + money(d.importe) + "</strong>" +
            (d.enProceso ? ' <small class="tenue">en planta</small>' : ""); } }
    ], liq.detalle, {});

    html += '<div class="liq-total"><span>Total a pagar</span><strong>' +
      money(liq.importe) + "</strong></div>";

    const rech = liq.detalle.filter(function (d) { return d.rechazado; });
    if (rech.length) {
      html += '<section class="liq-rechazos"><h4>Lotes no recibidos</h4><ul>';
      rech.forEach(function (d) {
        html += "<li><code>" + esc(d.codigoLote) + "</code> · " + UI.fechaCorta(d.fecha) +
          " — " + esc(d.motivo) + "</li>";
      });
      html += "</ul></section>";
    }

    html += '<div class="liq-firmas">' +
      "<div><span></span><small>Por " + esc(DB.nombreEmpresa()) + "</small></div>" +
      "<div><span></span><small>" + esc(liq.proveedor.contacto || liq.proveedor.nombre) +
      "<br>" + esc(liq.proveedor.documento) + "</small></div></div>";

    html += '<footer class="hoja-pie"><p>Liquidación calculada sobre el peso registrado en ' +
      "la báscula de planta. Las diferencias con lo declarado por el proveedor están en el " +
      "detalle de cada lote.</p></footer></div>";
    return html;
  }

  function verLiquidacion(proveedorId) {
    const liq = Indicadores.liquidacion(proveedorId, filtros);
    if (!liq) return;
    provLiquidacion = proveedorId;
    abrirPanel("Liquidación · " + liq.proveedor.nombre, hojaLiquidacion(liq), true);
  }

  function enlazarLiquidacion() {
    $$("[data-liquidar]").forEach(function (b) {
      b.addEventListener("click", function () { verLiquidacion(b.dataset.liquidar); });
    });
    const csv = $("#btnCsvLiquidacion");
    if (csv) {
      csv.addEventListener("click", function () {
        const filas = [];
        Indicadores.liquidaciones(filtros).forEach(function (liq) {
          liq.detalle.forEach(function (d) {
            filas.push({
              proveedor: liq.proveedor.nombre, documento: liq.proveedor.documento,
              folio: liq.folio, fecha: d.fecha, lote: d.codigoLote, producto: d.linea,
              calidad: d.calidad, gavetas: d.gavetas, kg: d.kg, precioKg: d.precioKg,
              importe: d.importe, estado: d.rechazado ? "Rechazado" : (d.enProceso ? "En planta" : "Cerrado"),
              motivo: d.motivo
            });
          });
        });
        UI.descargarCSV("liquidaciones_" + filtros.desde + "_" + filtros.hasta, [
          { titulo: "Proveedor", csv: function (x) { return x.proveedor; } },
          { titulo: "RUC", csv: function (x) { return x.documento; } },
          { titulo: "Documento", csv: function (x) { return x.folio; } },
          { titulo: "Fecha", csv: function (x) { return x.fecha; } },
          { titulo: "Lote", csv: function (x) { return x.lote; } },
          { titulo: "Producto", csv: function (x) { return x.producto; } },
          { titulo: "Calidad", csv: function (x) { return x.calidad; } },
          { titulo: "Gavetas", csv: function (x) { return x.gavetas; } },
          { titulo: "Kilos", csv: function (x) { return x.kg.toFixed(1); } },
          { titulo: "Precio por kilo", csv: function (x) { return x.precioKg.toFixed(3); } },
          { titulo: "Importe", csv: function (x) { return x.importe.toFixed(2); } },
          { titulo: "Estado", csv: function (x) { return x.estado; } },
          { titulo: "Motivo del rechazo", csv: function (x) { return x.motivo; } }
        ], filas);
      });
    }
  }

  /* ========================= estudio de tiempos ========================
     La pantalla que sostiene la parte de ingeniería del documento: de la
     lectura con cronómetro al tiempo estándar, y de ahí a cuánta gente
     hace falta en cada estación.
     =================================================================== */

  let lineaTiempos = null;

  function vistaTiempos() {
    const lineas = DB.all("lineas").filter(function (l) { return l.activa; });
    if (!lineas.length) return '<p class="vacio">No hay líneas activas.</p>';
    if (!lineaTiempos || !DB.linea(lineaTiempos)) lineaTiempos = lineas[0].id;

    const e = Indicadores.estudioTiempos(lineaTiempos);
    const p = DB.parametros();

    let html = '<div class="vista-cab"><div><h1>Estudio de tiempos y asignación</h1>' +
      '<p class="sub">Del cronómetro al tiempo estándar, y del tiempo estándar a ' +
      "cuánta gente hace falta en cada estación.</p></div>" +
      '<div class="cab-acciones">' +
      '<button class="btn btn-plano" id="btnCsvTiempos">Exportar CSV</button>' +
      '<button class="btn btn-primario" id="btnImprimir">Imprimir / PDF</button></div></div>';

    /* --- comparativa de las tres líneas --- */
    html += '<section class="panel"><h2>Las tres líneas</h2>' +
      '<p class="sub panel-sub">Dos relojes distintos. El <strong>ciclo</strong> es lo que ' +
      "tarda una gaveta en recorrer la línea; el <strong>contenido de trabajo</strong> es la " +
      "mano de obra que consume. Difieren en las actividades atendidas por más de una " +
      "persona, y confundirlos es lo que hace que la asignación salga mal.</p>" +
      UI.tabla([
        { titulo: "Línea", valor: function (x) { return UI.etiquetaLinea(x.linea.id); },
          csv: function (x) { return x.linea.nombre; } },
        { titulo: "Ciclo", num: true, valor: function (x) {
          return nf(x.cicloGavetaMin, 2) + ' <small class="tenue">min/gav</small>'; },
          csv: function (x) { return x.cicloGavetaMin.toFixed(3); } },
        { titulo: "Contenido", num: true, valor: function (x) {
          return "<strong>" + nf(x.contenidoGavetaMin, 2) +
            '</strong> <small class="tenue">min-pers/gav</small>'; },
          csv: function (x) { return x.contenidoGavetaMin.toFixed(3); } },
        { titulo: "Cajas/gaveta", num: true, valor: function (x) { return nf(x.cajasPorGaveta, 2); },
          csv: function (x) { return x.cajasPorGaveta.toFixed(3); } },
        { titulo: "Min/caja", num: true, valor: function (x) { return nf(x.cicloCajaMin, 2); },
          csv: function (x) { return x.cicloCajaMin.toFixed(3); } },
        { titulo: "Min-pers/kg", num: true, valor: function (x) { return nf(x.contenidoKgMin, 2); },
          csv: function (x) { return x.contenidoKgMin.toFixed(3); } },
        { titulo: "Takt", num: true, valor: function (x) { return nf(x.taktMin, 2) + " min"; },
          csv: function (x) { return x.taktMin.toFixed(3); } },
        { titulo: "Operarios", num: true, valor: function (x) {
          return "<strong>" + nf(x.operariosMinimos) + "</strong>"; },
          csv: function (x) { return x.operariosMinimos; } },
        { titulo: "MO/caja", num: true, valor: function (x) { return money(x.costoManoObraCaja); },
          csv: function (x) { return x.costoManoObraCaja.toFixed(3); } },
        { titulo: "Manda", valor: function (x) {
          return x.cuello ? esc(x.cuello.estacion) + ' <small class="tenue">' +
            pct(x.cuello.participacion, 0) + "</small>" : "—"; },
          csv: function (x) { return x.cuello ? x.cuello.estacion : ""; } }
      ], Indicadores.estudioTodas(), {}) +
      '<p class="nota-info">Takt calculado con ' + nf(p.jornadaMin) + " min de jornada menos " +
      nf(p.pausasMin) + " min de pausas = <strong>" + nf(p.jornadaMin - p.pausasMin) +
      " min disponibles</strong>, y el ingreso diario de cada línea. Mano de obra a " +
      money(p.costoHoraHombre) + "/hora " + UI.origen(p.origenCostoHora) + ".</p></section>";

    /* --- selector de línea --- */
    html += '<div class="selector-reporte" role="tablist">';
    lineas.forEach(function (l) {
      html += '<button type="button" role="tab" class="chip chip-grande' +
        (l.id === lineaTiempos ? " chip-activo" : "") + '" data-linea-tiempos="' + esc(l.id) + '"' +
        ' aria-selected="' + (l.id === lineaTiempos) + '">' + esc(l.nombre) + "</button>";
    });
    html += "</div>";

    /* --- cadena del cálculo --- */
    html += '<section class="panel"><h2>' + esc(e.linea.nombre) +
      ': de la lectura al estándar</h2>' +
      '<p class="sub panel-sub">TN = TO × valoración · TE = TN × (1 + suplemento). ' +
      "El tiempo estándar no se teclea: se calcula. Cuando se cronometren ciclos nuevos, " +
      "basta cambiar el TO y se recalculan el takt, los operarios y el costo.</p>" +
      UI.tabla(columnasActividad(), e.detalle, {}) + "</section>";

    /* --- asignación por estación --- */
    html += '<section class="panel"><h2>Cuánta gente, y dónde</h2>' +
      '<div class="kpis">' +
      UI.kpi("Contenido de trabajo", nf(e.contenidoGavetaMin, 2) + " min-pers",
        "por gaveta · ciclo " + nf(e.cicloGavetaMin, 2) + " min") +
      UI.kpi("Takt time", nf(e.taktMin, 2) + " min",
        nf(e.gavetasDia, 0) + " gavetas/día desde " + nf(e.ingresoDiarioKg) + " kg") +
      UI.kpi("Operarios mínimos", nf(e.operariosMinimos),
        "contenido ÷ takt = " + nf(e.operariosExactos, 2), "bien") +
      UI.kpi("Costo de mano de obra", money(e.costoManoObraCaja) + "/caja",
        money(e.costoManoObraKg) + "/kg · " + money(e.costoManoObraGaveta) + "/gaveta") +
      "</div>";

    html += UI.tabla([
      { titulo: "Estación", valor: function (x) { return "<strong>" + esc(x.estacion) + "</strong>"; },
        csv: function (x) { return x.estacion; } },
      { titulo: "Actividades", num: true, valor: function (x) { return nf(x.actividades); },
        csv: function (x) { return x.actividades; } },
      { titulo: "Ciclo", num: true, valor: function (x) { return nf(x.ciclo, 2) + " min"; },
        csv: function (x) { return x.ciclo.toFixed(3); } },
      { titulo: "Contenido", num: true, valor: function (x) { return nf(x.contenido, 2) + " min-pers"; },
        csv: function (x) { return x.contenido.toFixed(3); } },
      { titulo: "% del total", num: true, valor: function (x) {
        return '<span class="barra-mini barra-ancha"><span style="width:' +
          (x.participacion * 100).toFixed(1) + '%;background:' + esc(e.linea.color) + '"></span></span> ' +
          pct(x.participacion, 0); },
        csv: function (x) { return (x.participacion * 100).toFixed(1); } },
      { titulo: "Operarios", num: true, valor: function (x) {
        return "<strong>" + nf(x.operariosEnteros) + "</strong> " +
          '<small class="tenue">(' + nf(x.operarios, 2) + ")</small>"; },
        csv: function (x) { return x.operariosEnteros; } }
    ], e.estaciones, { filaClase: function (x) {
      return e.cuello && x.estacion === e.cuello.estacion ? "fila-vital" : ""; } });

    html += '<p class="nota-info"><strong>' + esc(e.cuello ? e.cuello.estacion : "—") +
      "</strong> concentra el " + pct(e.cuello ? e.cuello.participacion : 0, 0) +
      " del contenido de trabajo: es la estación que manda, y donde cualquier mejora " +
      "de método se nota más. Redondear operarios por estación deja la línea con " +
      pct(e.eficienciaBalance) + " de aprovechamiento; la diferencia es gente esperando.</p>";

    html += "</section>";
    return html;
  }

  function columnasActividad() {
    return [
      { titulo: "Código", valor: function (a) { return "<code>" + esc(a.codigo) + "</code>"; },
        csv: function (a) { return a.codigo; } },
      { titulo: "Actividad", valor: function (a) {
        return esc(a.nombre) + '<br><small class="tenue">' + esc(a.estacion) + "</small>"; },
        csv: function (a) { return a.nombre; } },
      { titulo: "Tipo", valor: function (a) { return simboloDAP(a.simbolo); },
        csv: function (a) { return a.simbolo; } },
      { titulo: "Unidad", valor: function (a) { return esc(a.unidad); },
        csv: function (a) { return a.unidad; } },
      { titulo: "TO", num: true, valor: function (a) {
        return nf(a.to, 3) + " " + UI.origen(a.origen); },
        csv: function (a) { return a.to.toFixed(4); } },
      { titulo: "V", num: true, valor: function (a) { return nf(a.v, 2); },
        csv: function (a) { return a.v; } },
      { titulo: "TN", num: true, valor: function (a) { return nf(a.tn, 3); },
        csv: function (a) { return a.tn.toFixed(4); } },
      { titulo: "Supl.", num: true, valor: function (a) { return pct(a.suplemento, 0); },
        csv: function (a) { return a.suplemento; } },
      { titulo: "TE", num: true, valor: function (a) { return "<strong>" + nf(a.te, 3) + "</strong>"; },
        csv: function (a) { return a.te.toFixed(4); } },
      { titulo: "Pers.", num: true, valor: function (a) {
        return a.personas > 1 ? '<span class="etq etq-B">' + nf(a.personas, 1) + "</span>" : nf(a.personas, 1); },
        csv: function (a) { return a.personas; } },
      { titulo: "TE/gaveta", num: true, valor: function (a) { return nf(a.tePorGaveta, 3); },
        csv: function (a) { return a.tePorGaveta.toFixed(4); } },
      { titulo: "Min-pers/gav", num: true, valor: function (a) {
        return "<strong>" + nf(a.minPersonaPorGaveta, 3) + "</strong>"; },
        csv: function (a) { return a.minPersonaPorGaveta.toFixed(4); } },
      { titulo: "% carga", num: true, valor: function (a) { return pct(a.participacion, 1); },
        csv: function (a) { return (a.participacion * 100).toFixed(1); } }
    ];
  }

  /* Los símbolos del DAP: operación, transporte, inspección, demora y
     almacenamiento. Se dibujan, porque es como se leen en el diagrama. */
  function simboloDAP(s) {
    const mapa = { O: ["○", "Operación"], T: ["⇨", "Transporte"], I: ["□", "Inspección"],
                   D: ["D", "Demora"], A: ["▽", "Almacenamiento"] };
    const m = mapa[s] || ["·", s];
    return '<span class="dap dap-' + esc(s) + '" title="' + esc(m[1]) + '">' + m[0] + "</span>";
  }

  function enlazarTiempos() {
    $$("[data-linea-tiempos]").forEach(function (b) {
      b.addEventListener("click", function () {
        lineaTiempos = b.dataset.lineaTiempos;
        render();
      });
    });
    const csv = $("#btnCsvTiempos");
    if (csv) {
      csv.addEventListener("click", function () {
        const e = Indicadores.estudioTiempos(lineaTiempos);
        UI.descargarCSV("estudio_tiempos_" + e.linea.codigo, columnasActividad(), e.detalle);
      });
    }
  }

  /* ================================ guía =============================== */

  function vistaGuia() {
    return '<div class="vista-cab"><div><h1>Guía de uso</h1>' +
      '<p class="sub">Escrita para quien usa el sistema, no para quien lo programó.</p></div>' +
      '<div class="cab-acciones">' +
      '<button class="btn btn-primario" id="btnImprimir">Imprimir / PDF</button></div></div>' +
      '<section class="panel">' + Guia.planta(usuario.rol) + "</section>";
  }

  /* ========================== costeo y simulador ======================
     Traduce la pérdida a dinero y deja probar escenarios "con mejora".
     Es la pieza que convierte el diagnóstico en una propuesta defendible:
     inversión, ahorro anual, payback y VAN.
     =================================================================== */

  function escenarioPorDefecto() {
    /* Arranca con las cuatro medidas del diagnóstico activadas: es la
       propuesta completa, y desde ahí se quita lo que no se quiera. */
    const e = Indicadores.escenarioDeMedidas(
      Indicadores.ESCENARIOS.map(function (m) { return m.id; }), filtros);
    e.medidas = Indicadores.ESCENARIOS.map(function (m) { return m.id; });
    return e;
  }

  function vistaCosteo() {
    if (!escenario) escenario = escenarioPorDefecto();
    escenario.filtros = filtros;
    const c = Indicadores.costeo(filtros);

    let html = '<div class="vista-cab"><div><h1>Costeo y mejora</h1>' +
      '<p class="sub">Cuánto cuesta cada causa raíz al año y qué pasaría si se ataca.</p></div>' +
      '<div class="cab-acciones">' +
      '<button class="btn btn-plano" id="btnCsvCosteo">Exportar CSV</button>' +
      '<button class="btn btn-primario" id="btnImprimir">Imprimir / PDF</button></div></div>';

    html += barraFiltros({});

    if (c.lista.length === 0) {
      html += '<p class="vacio">Todavía no hay mermas registradas en este período, ' +
        "así que no hay nada que costear.</p>";
      return html;
    }

    /* --- lo que cuesta hoy --- */
    html += '<section class="panel"><h2>Lo que cuesta hoy</h2>' +
      '<p class="sub panel-sub">' + nf(c.dias) + " días con registros dentro del filtro. " +
      "La proyección anual supone que el resto del año se comporta igual que este " +
      "período " + UI.origen("S") + ".</p>" +
      '<div class="kpis">' +
      UI.kpi("Costo del período", money(c.costoTotal), nf(c.kg) + " kg de merma") +
      UI.kpi("Por día", money(c.costoDiario), "promedio del período") +
      UI.kpi("Proyección anual", money(c.costoAnual), "×" + nf(c.factorAnual, 1) + " el período", "alerta") +
      UI.kpi("Causas vitales", nf(c.vitales), "concentran el 80% del dinero") +
      "</div>";

    /* De dónde sale el número: las tres partes del costo. */
    html += '<div class="costo-partes">' +
      '<div><span>Fruta que no se exportó</span><strong>' + money(c.valorFruta) + "</strong>" +
      "<small>valor de exportación perdido</small></div>" +
      '<div><span>Recuperado por destino</span><strong>' +
      (c.valorRecuperado < 0 ? "−" : "") + money(Math.abs(c.valorRecuperado)) + "</strong>" +
      "<small>" + (c.valorRecuperado < 0
        ? "se paga por llevar al relleno" : "vuelve por segunda, subproducto o compost") + "</small></div>" +
      '<div><span>Horas-hombre invertidas</span><strong>' + money(c.costoTransformacion) + "</strong>" +
      "<small>a " + money(c.costoHoraHombre) + "/hora, ya gastadas</small></div>" +
      '<div class="costo-partes-total"><span>Costo total</span><strong>' + money(c.costoTotal) + "</strong>" +
      "<small>" + money(c.costoTotal / (c.kg || 1)) + " por kilo perdido</small></div>" +
      "</div>";

    if (c.sinClasificar > 0) {
      html += '<p class="nota-aviso">' + money(c.sinClasificar) + " del costo del período (" +
        pct(c.sinClasificar / c.costoTotal) + ") está en causas todavía sin definir. " +
        "Clasificarlas en Parámetros es lo que más rápido mejora esta priorización.</p>";
    }

    html += '<div class="hoja-grafico">' + Graficos.pareto(c.lista, {
      titulo: "Pareto económico por causa raíz",
      valor: function (d) { return d.costoTotal; },
      unidad: " USD",
      ejeX: function (d) { return d.codigo; },
      color: function (d) { return d.vital ? "#c0246b" : d.definida ? "#c85a1e" : "#8b96a3"; },
      leyenda: [["Vital (80%)", "#c0246b"], ["Secundaria", "#c85a1e"], ["Por definir", "#8b96a3"]]
    }) + "</div>";

    html += UI.tabla(columnasCosteo(), c.lista, { filaClase: function (x) {
      return x.vital ? "fila-vital" : "";
    } }) + "</section>";

    /* --- simulador --- */
    html += '<section class="panel"><h2>Simulador: ¿y si lo arreglamos?</h2>' +
      '<p class="sub panel-sub">Activa las medidas del diagnóstico o mueve cada ' +
      "porcentaje a mano. Todo lo de aquí es un supuesto " + UI.origen("S") +
      ", no un dato medido.</p>";

    html += '<div class="medidas">';
    Indicadores.ESCENARIOS.forEach(function (m) {
      const puesta = escenario.medidas && escenario.medidas.indexOf(m.id) !== -1;
      html += '<button type="button" class="medida' + (puesta ? " medida-on" : "") +
        '" data-medida="' + esc(m.id) + '" aria-pressed="' + puesta + '">' +
        '<span class="medida-marca" aria-hidden="true">' + UI.icono(puesta ? "check" : "mas") + "</span>" +
        "<strong>" + esc(m.nombre) + "</strong>" +
        "<small>" + esc(m.detalle) + "</small>" +
        '<span class="medida-cifras">' + esc(m.causas.join(", ")) + " · −" + pct(m.reduccion, 0) +
        " · " + money(m.inversion) + "</span></button>";
    });
    html += "</div>";

    html += '<form id="formSim" class="sim-campos">' +
      '<div class="campo"><label for="sInv">Inversión inicial (USD)</label>' +
      '<input type="number" id="sInv" name="inversion" min="0" step="50" value="' +
      Math.round(escenario.inversion) + '"></div>' +
      '<div class="campo"><label for="sRec">Costo anual que se suma (USD)</label>' +
      '<input type="number" id="sRec" name="recurrenteAnual" min="0" step="50" value="' +
      Math.round(escenario.recurrenteAnual) + '"></div>' +
      '<div class="campo"><label for="sVal">Del residuo que hoy va al relleno, se valoriza</label>' +
      '<input type="number" id="sVal" name="valorizacion" min="0" max="100" step="5" value="' +
      Math.round((escenario.valorizacion || 0) * 100) + '"><small class="campo-ayuda">%</small></div>' +
      "</form>";

    html += '<div class="sim-causas">';
    c.lista.forEach(function (x) {
      const r = Math.round((escenario.reducciones[x.causaId] || 0) * 100);
      html += '<div class="sim-causa' + (x.vital ? " sim-causa-vital" : "") + '">' +
        '<label for="red_' + esc(x.causaId) + '"><strong>' + esc(x.etiqueta) + "</strong>" +
        "<small>" + money(x.costoAnual) + " al año</small></label>" +
        '<input type="range" id="red_' + esc(x.causaId) + '" data-red="' + esc(x.causaId) +
        '" min="0" max="80" step="5" value="' + r + '">' +
        '<output id="out_' + esc(x.causaId) + '">−' + r + "%</output></div>";
    });
    html += "</div></section>";

    /* El resultado se repinta solo, sin tocar los deslizadores. */
    html += '<div id="costeoDinamico">' + resultadoSimulacion() + "</div>";
    return html;
  }

  function columnasCosteo() {
    return [
      { titulo: "Causa raíz", valor: function (x) {
        return "<strong>" + esc(x.codigo) + "</strong> " + esc(x.nombre) +
          (x.definida ? "" : ' <span class="insignia-neutra">por definir</span>'); } },
      { titulo: "Origen", valor: function (x) { return esc(x.origen); } },
      { titulo: "kg", num: true, valor: function (x) { return nf(x.kg); } },
      { titulo: "Gavetas eq.", num: true, valor: function (x) { return nf(x.gavetasEquivalentes); } },
      { titulo: "Fruta", num: true, valor: function (x) { return money(x.valorFruta); } },
      { titulo: "Recuperado", num: true, valor: function (x) { return money(x.valorRecuperado); } },
      { titulo: "Horas-hombre", num: true, valor: function (x) { return money(x.costoTransformacion); } },
      { titulo: "Costo", num: true, valor: function (x) {
        return "<strong>" + money(x.costoTotal) + "</strong>"; } },
      { titulo: "$/kg", num: true, valor: function (x) { return money(x.costoPorKg); } },
      { titulo: "Anual", num: true, valor: function (x) { return money(x.costoAnual); } },
      { titulo: "% / acum.", num: true, valor: function (x) {
        return pct(x.porcentaje) + " <small>" + pct(x.acumulado) + "</small>"; } }
    ];
  }

  function resultadoSimulacion() {
    const s = Indicadores.simular(escenario);
    const i = s.indicadores;

    let html = '<section class="panel panel-resultado"><h2>Escenario con mejora</h2>';

    html += '<div class="kpis">' +
      UI.kpi("Ahorro neto al año", money(s.ahorroNeto),
        s.recurrenteAnual > 0 ? "ya descontados " + money(s.recurrenteAnual) + " de costo anual" : "sobre el costo actual",
        s.ahorroNeto > 0 ? "ok" : "alerta") +
      UI.kpi("Inversión", money(s.inversion), "una sola vez") +
      UI.kpi("Se recupera en", s.paybackMeses === null ? "nunca"
        : s.paybackMeses === 0 ? "de inmediato" : nf(s.paybackMeses, 1) + " meses",
        s.paybackMeses === null ? "el ahorro no cubre el costo anual"
          : "payback simple", s.paybackMeses !== null && s.paybackMeses <= 24 ? "ok" : "alerta") +
      UI.kpi("VAN a " + s.aniosVan + " años", money(s.van),
        "descontado al " + pct(s.tasaDescuento, 0) + " anual " + UI.origen("S"),
        s.van > 0 ? "ok" : "alerta") +
      "</div>";

    html += '<p class="' + (s.viable ? "nota-ok" : "nota-aviso") + '">' + (s.viable
      ? "<strong>La propuesta se paga sola.</strong> Con " + money(s.inversion) +
        " se evitan " + nf(s.kgEvitadosAnual) + " kg de pérdida al año y se recuperan " +
        money(s.ahorroNeto) + ", equivalentes a " + money(s.ahorroMensual) + " al mes."
      : "<strong>Así planteada, la propuesta no se sostiene.</strong> Con estos supuestos " +
        "el ahorro anual (" + money(s.ahorroBruto) + ") no compensa el costo que se suma (" +
        money(s.recurrenteAnual) + ") ni la inversión. Sube la reducción esperada o baja el costo.") +
      "</p>";

    /* De dónde viene el ahorro. */
    html += '<div class="costo-partes">' +
      '<div><span>Pérdida evitada</span><strong>' + money(s.ahorroCausas) + "</strong>" +
      "<small>" + nf(s.kgEvitadosAnual) + " kg al año que ya no se pierden</small></div>" +
      '<div><span>Residuo valorizado</span><strong>' + money(s.ahorroValorizacion) + "</strong>" +
      "<small>" + nf(s.kgValorizadosAnual) + " kg a " + money(s.valorKgObjetivo) + "/kg · " +
      esc(s.destinoObjetivo) + "</small></div>" +
      '<div><span>Costo que se suma</span><strong>−' + money(s.recurrenteAnual) + "</strong>" +
      "<small>operación de la mejora, cada año</small></div>" +
      '<div class="costo-partes-total"><span>Ahorro neto anual</span><strong>' +
      money(s.ahorroNeto) + "</strong><small>" +
      (s.beneficioCosto === null ? "sin inversión asociada"
        : nf(s.beneficioCosto, 2) + " USD ganados por USD invertido en " + s.aniosVan + " años") +
      "</small></div></div>";

    /* Antes y después, causa por causa. */
    html += UI.tabla([
      { titulo: "Causa raíz", valor: function (x) { return esc(x.etiqueta); } },
      { titulo: "Reducción", num: true, valor: function (x) {
        return x.reduccion > 0 ? "−" + pct(x.reduccion, 0) : "—"; } },
      { titulo: "Costo hoy", num: true, valor: function (x) { return money(x.costoAnual); } },
      { titulo: "Con mejora", num: true, valor: function (x) { return money(x.costoAnualConMejora); } },
      { titulo: "Ahorro", num: true, valor: function (x) {
        return x.ahorroAnual > 0 ? "<strong>" + money(x.ahorroAnual) + "</strong>" : "—"; } },
      { titulo: "kg evitados", num: true, valor: function (x) { return nf(x.kgEvitadosAnual); } }
    ], s.detalle.slice().sort(function (a, b) { return b.ahorroAnual - a.ahorroAnual; }));

    /* Cómo quedarían los indicadores del período. */
    html += '<h3 class="sub-titulo">Los indicadores, antes y después</h3>' +
      '<div class="comparativo">' +
      filaComparativo("Tasa exportable", i.tasaExportable, i.tasaExportableConMejora, true,
        "meta ponderada " + pct(i.metaRendimiento)) +
      filaComparativo("Merma sobre lo procesado", i.tasaMerma, i.tasaMermaConMejora, false, "") +
      filaComparativo("Descarte aprovechado", i.tasaValorizacion, i.tasaValorizacionConMejora, true, "") +
      "</div>";

    html += '<p class="nota-info">Recupera ' + nf(i.kgRecuperados) + " kg y"
      " cajas exportables en el período mostrado. El costo de la fruta, el precio por caja y " +
      "el costo hora-hombre vienen de Parámetros; las reducciones y la tasa de descuento son " +
      "supuestos " + UI.origen("S") + " que deben discutirse con la empresa.</p>";

    html += "</section>";
    return html;
  }

  function filaComparativo(etiqueta, antes, despues, subirEsBueno, pie) {
    const dif = despues - antes;
    const mejora = subirEsBueno ? dif > 0.0005 : dif < -0.0005;
    return '<div class="comparativo-fila">' +
      "<span>" + esc(etiqueta) + (pie ? " <small>" + esc(pie) + "</small>" : "") + "</span>" +
      '<span class="comparativo-antes">' + pct(antes) + "</span>" +
      '<span class="comparativo-flecha" aria-hidden="true">→</span>' +
      '<span class="comparativo-despues ' + (mejora ? "mejor" : "igual") + '">' + pct(despues) + "</span>" +
      '<span class="comparativo-dif">' + (Math.abs(dif) < 0.0005 ? "sin cambio"
        : (dif > 0 ? "+" : "−") + pct(Math.abs(dif))) + "</span></div>";
  }

  function refrescarSimulacion() {
    const cont = $("#costeoDinamico");
    if (!cont) return;
    cont.innerHTML = resultadoSimulacion();
  }

  function enlazarCosteo() {
    /* Las medidas rearman el escenario completo: reducciones, inversión y
       costo anual salen de lo que cada medida supone. */
    $$("[data-medida]").forEach(function (b) {
      b.addEventListener("click", function () {
        const id = b.dataset.medida;
        const puestas = (escenario.medidas || []).slice();
        const i = puestas.indexOf(id);
        if (i === -1) puestas.push(id); else puestas.splice(i, 1);
        escenario = Indicadores.escenarioDeMedidas(puestas, filtros);
        escenario.medidas = puestas;
        render();
      });
    });

    $$("[data-red]").forEach(function (r) {
      r.addEventListener("input", function () {
        const id = r.dataset.red;
        escenario.reducciones[id] = Number(r.value) / 100;
        /* Ya no es una de las medidas del catálogo: se ajustó a mano. */
        escenario.medidas = [];
        const out = $("#out_" + id);
        if (out) out.textContent = "−" + r.value + "%";
        marcarMedidasManuales();
        refrescarSimulacion();
      });
    });

    const form = $("#formSim");
    if (form) {
      UI.vigilarFormulario(form);
      form.addEventListener("input", function () {
        escenario.inversion = Number($("#sInv").value) || 0;
        escenario.recurrenteAnual = Number($("#sRec").value) || 0;
        escenario.valorizacion = Math.max(0, Math.min(100, Number($("#sVal").value) || 0)) / 100;
        refrescarSimulacion();
      });
      form.addEventListener("submit", function (ev) { ev.preventDefault(); });
    }

    const csv = $("#btnCsvCosteo");
    if (csv) {
      csv.addEventListener("click", function () {
        const c = Indicadores.costeo(filtros);
        const s = Indicadores.simular(escenario);
        const porCausa = {};
        s.detalle.forEach(function (d) { porCausa[d.causaId] = d; });
        UI.descargarCSV("costeo_causas_" + filtros.desde + "_" + filtros.hasta, [
          { titulo: "Causa", csv: function (x) { return x.codigo + " " + x.nombre; } },
          { titulo: "Origen", csv: function (x) { return x.origen; } },
          { titulo: "kg", csv: function (x) { return x.kg.toFixed(1); } },
          { titulo: "Valor fruta USD", csv: function (x) { return x.valorFruta.toFixed(2); } },
          { titulo: "Recuperado USD", csv: function (x) { return x.valorRecuperado.toFixed(2); } },
          { titulo: "Horas-hombre USD", csv: function (x) { return x.costoTransformacion.toFixed(2); } },
          { titulo: "Costo periodo USD", csv: function (x) { return x.costoTotal.toFixed(2); } },
          { titulo: "Costo anual USD", csv: function (x) { return x.costoAnual.toFixed(2); } },
          { titulo: "% del total", csv: function (x) { return (x.porcentaje * 100).toFixed(1); } },
          { titulo: "Reduccion simulada %", csv: function (x) {
            return ((porCausa[x.causaId] ? porCausa[x.causaId].reduccion : 0) * 100).toFixed(0); } },
          { titulo: "Ahorro anual USD", csv: function (x) {
            return (porCausa[x.causaId] ? porCausa[x.causaId].ahorroAnual : 0).toFixed(2); } }
        ], c.lista);
      });
    }
  }

  /* Si se movió un deslizador, las medidas dejan de estar "activas": el
     escenario ya no es el del catálogo y la pantalla no debe mentir. */
  function marcarMedidasManuales() {
    $$("[data-medida]").forEach(function (b) {
      b.classList.remove("medida-on");
      b.setAttribute("aria-pressed", "false");
      const marca = b.querySelector(".medida-marca");
      if (marca) marca.textContent = "+";
    });
  }

  /* ============================== catálogos =========================== */

  function vistaCatalogos() {
    const p = DB.parametros();

    let html = '<div class="vista-cab"><div><h1>Parámetros del sistema</h1>' +
      '<p class="sub">Los valores que alimentan todos los cálculos. Cada uno declara su origen.</p></div></div>';

    /* --- identidad de quien usa el sistema ---
       El sistema no lleva el nombre de nadie escrito en el código: se
       configura aquí. Y nace en modo confidencial, porque el caso de
       estudio con el que se construyó está bajo acuerdo de
       confidencialidad y un documento no puede filtrarlo por descuido. */
    const idn = DB.identidad();
    html += '<section class="panel panel-identidad"><h2>Identidad de la planta</h2>' +
      '<p class="sub panel-sub">Lo que aparece en la cabecera de los reportes, en las ' +
      "liquidaciones y en la guía impresa. " + esc(DB.MARCA.producto) + " es el nombre del " +
      "sistema y no cambia; esto es el nombre de quien lo usa.</p>" +
      '<div class="conteos">' +
      "<div><span>Razón social</span><strong>" +
        (idn.razonSocial ? esc(idn.razonSocial) : '<em class="tenue">sin configurar</em>') +
        "</strong></div>" +
      "<div><span>Nombre corto</span><strong>" +
        (idn.nombreCorto ? esc(idn.nombreCorto) : '<em class="tenue">—</em>') + "</strong></div>" +
      "<div><span>RUC o identificación</span><strong>" +
        (idn.identificacion ? esc(idn.identificacion) : '<em class="tenue">—</em>') + "</strong></div>" +
      "<div><span>Ciudad</span><strong>" +
        (idn.ciudad ? esc(idn.ciudad) : '<em class="tenue">—</em>') + "</strong></div>" +
      "<div><span>En los documentos sale</span><strong>" + esc(DB.nombreEmpresa(true)) +
        "</strong></div>" +
      "</div>";
    html += idn.confidencial
      ? '<p class="nota-info"><strong>Modo confidencial activo.</strong> Ningún reporte, ' +
        "liquidación ni guía imprime el nombre real: todos dicen " +
        "«" + esc(idn.aliasConfidencial || "la Empresa") + "», que es como se cita una empresa " +
        "bajo acuerdo de confidencialidad en un trabajo académico. Desactívalo solo si la " +
        "planta autorizó por escrito que su nombre aparezca.</p>"
      : '<p class="aviso-inline"><strong>Modo confidencial desactivado.</strong> Los documentos ' +
        "que generes imprimen la razón social. Asegúrate de tener la autorización.</p>";
    html += '<div class="acciones-fila"><button class="btn btn-primario" id="btnEditarIdentidad">' +
      "Editar identidad</button></div></section>";

    html += '<p class="nota-info"><strong>Origen del dato:</strong> ' +
      UI.origen("M") + " medido en planta · " + UI.origen("E") + " estimado, pendiente de confirmar · " +
      UI.origen("S") + " tomado de fuente secundaria. Los marcados con E deben validarse con la " +
      "empresa antes de usarse en el documento.</p>";

    /* --- líneas --- */
    html += '<section class="panel"><h2>Líneas de producto</h2>' +
      UI.tabla([
        { titulo: "Línea", valor: function (l) { return UI.etiquetaLinea(l.id); } },
        { titulo: "Código", valor: function (l) { return "<code>" + esc(l.codigo) + "</code>"; } },
        { titulo: "kg/gaveta", num: true, valor: function (l) {
          return nf(l.pesoGavetaKg) + " " + UI.origen(l.origenPesoGaveta); } },
        { titulo: "kg/caja", num: true, valor: function (l) {
          return nf(l.pesoCajaKg, 1) + " " + UI.origen(l.origenPesoCaja); } },
        { titulo: "Cajas/gaveta", num: true, valor: function (l) {
          return nf(DB.cajasPorGaveta(l), 2); } },
        { titulo: "Rendimiento", num: true, valor: function (l) {
          return pct(l.rendimientoExportable) + " " + UI.origen(l.origenRendimiento) +
            ' <small class="tenue">meta ' + pct(l.metaRendimiento) + "</small>"; } },
        { titulo: "$/kg productor", num: true, valor: function (l) {
          return money(l.valorKgProductor) + " " + UI.origen(l.origenValorKg); } },
        { titulo: "Ingreso/día", num: true, valor: function (l) {
          return nf(l.ingresoDiarioKg) + " kg " + UI.origen(l.origenIngreso); } },
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
      '<p class="sub panel-sub">Alimentan el planificador, el estudio de tiempos y el costeo. ' +
      "Los suplementos de la OIT ya no están aquí: cada actividad lleva el suyo, que es " +
      "como los define la norma.</p>" +
      '<div class="conteos">' +
      '<div><span>Jornada</span><strong>' + nf(p.jornadaMin) + " min " + UI.origen(p.origenJornada) + "</strong></div>" +
      '<div><span>Pausas</span><strong>' + nf(p.pausasMin) + " min " + UI.origen(p.origenPausas) + "</strong></div>" +
      '<div><span>Disponible</span><strong>' + nf(p.jornadaMin - p.pausasMin) + " min " + UI.origen("E") + "</strong></div>" +
      '<div><span>Días al año</span><strong>' + nf(p.diasOperativos) + " " + UI.origen(p.origenDias) + "</strong></div>" +
      '<div><span>Operarios</span><strong>' + nf(p.operariosDisponibles) + " " + UI.origen(p.origenOperarios) + "</strong></div>" +
      '<div><span>Eficiencia</span><strong>' + pct(p.eficienciaPlanta) + " " + UI.origen(p.origenEficiencia) + "</strong></div>" +
      '<div><span>Salario básico</span><strong>' + money(p.salarioBasico) + " " + UI.origen(p.origenSalario) + "</strong></div>" +
      '<div><span>Costo hora-operario</span><strong>' + money(p.costoHoraHombre) + " " + UI.origen(p.origenCostoHora) + "</strong></div>" +
      "</div>" +
      '<div class="acciones-fila"><button class="btn btn-primario" id="btnEditarParametros">Editar parámetros</button></div>' +
      "</section>";

    return html;
  }

  function formIdentidad() {
    const i = DB.identidad();
    UI.abrirFormulario("Identidad de la planta", [
      { nombre: "razonSocial", etiqueta: "Razón social", tipo: "text", valor: i.razonSocial,
        ayuda: "El nombre legal completo, tal como debe salir en una liquidación." },
      { nombre: "nombreCorto", etiqueta: "Nombre corto", tipo: "text", valor: i.nombreCorto,
        ancho: "mitad", ayuda: "El que cabe en la barra lateral." },
      { nombre: "identificacion", etiqueta: "RUC o identificación", tipo: "text",
        valor: i.identificacion, ancho: "mitad" },
      { nombre: "ciudad", etiqueta: "Ciudad", tipo: "text", valor: i.ciudad, ancho: "mitad" },
      { tipo: "separador", etiqueta: "Confidencialidad" },
      { nombre: "confidencial", etiqueta: "", tipo: "checkbox", valor: i.confidencial,
        textoCheck: "No imprimir el nombre real en ningún documento",
        ayuda: "Déjalo marcado mientras el acuerdo de confidencialidad esté vigente." },
      { nombre: "aliasConfidencial", etiqueta: "Cómo citarla entonces", tipo: "text",
        valor: i.aliasConfidencial, ancho: "mitad",
        ayuda: "Por ejemplo: la Empresa, la planta exportadora, Empresa A." }
    ], function (d) {
      DB.guardarIdentidad({
        razonSocial: String(d.razonSocial || "").trim(),
        nombreCorto: String(d.nombreCorto || "").trim(),
        identificacion: String(d.identificacion || "").trim(),
        ciudad: String(d.ciudad || "").trim(),
        confidencial: !!d.confidencial,
        aliasConfidencial: String(d.aliasConfidencial || "").trim() || "la Empresa"
      });
      DB.registrarBitacora(usuario.id, "Edición de identidad",
        d.confidencial ? "modo confidencial activo" : "nombre real visible en documentos");
      UI.aviso("Identidad actualizada.");
      render();
    }, { aceptar: "Guardar", ancho: true });
  }

  function formLinea(id) {
    const l = DB.linea(id);
    if (!l) return;
    const ops = DB.ORIGENES.map(function (o) { return { valor: o.id, texto: o.id + " — " + o.nombre }; });

    UI.abrirFormulario("Editar " + l.nombre, [
      { nombre: "nombre", etiqueta: "Nombre", tipo: "text", requerido: true, valor: l.nombre, ancho: "mitad" },
      { nombre: "codigo", etiqueta: "Código", tipo: "text", requerido: true, valor: l.codigo, ancho: "mitad" },
      { tipo: "separador", etiqueta: "Estudio de tiempos" },
      { nombre: "pesoGavetaKg", etiqueta: "Peso por gaveta (kg)", tipo: "number", requerido: true,
        min: 0.1, paso: "0.1", valor: l.pesoGavetaKg, ancho: "mitad",
        ayuda: "Lo que llega del campo." },
      { nombre: "origenPesoGaveta", etiqueta: "Origen", tipo: "select", opciones: ops,
        valor: l.origenPesoGaveta, ancho: "mitad" },
      { nombre: "pesoCajaKg", etiqueta: "Peso por caja de exportación (kg)", tipo: "number",
        requerido: true, min: 0.1, paso: "0.1", valor: l.pesoCajaKg, ancho: "mitad",
        ayuda: "Lo que sale al contenedor." },
      { nombre: "origenPesoCaja", etiqueta: "Origen", tipo: "select", opciones: ops,
        valor: l.origenPesoCaja, ancho: "mitad" },
      { tipo: "separador", etiqueta: "Rendimiento y valor" },
      { nombre: "rendimientoExportable", etiqueta: "Rendimiento actual (0 a 1)", tipo: "number",
        requerido: true, min: 0, max: 1, paso: "0.001", valor: l.rendimientoExportable, ancho: "mitad",
        ayuda: "kg empacados ÷ kg que entran a proceso, del balance de masa." },
      { nombre: "metaRendimiento", etiqueta: "Meta de rendimiento (0 a 1)", tipo: "number",
        requerido: true, min: 0, max: 1, paso: "0.01", valor: l.metaRendimiento, ancho: "mitad" },
      { nombre: "origenMeta", etiqueta: "Origen", tipo: "select", opciones: ops,
        valor: l.origenMeta, ancho: "mitad" },
      { nombre: "valorKgProductor", etiqueta: "Valor al productor ($/kg)", tipo: "number",
        requerido: true, min: 0, paso: "0.01", valor: l.valorKgProductor, ancho: "mitad" },
      { nombre: "valorKgLocal", etiqueta: "Valor en mercado local ($/kg)", tipo: "number",
        requerido: true, min: 0, paso: "0.01", valor: l.valorKgLocal, ancho: "mitad" },
      { nombre: "ingresoDiarioKg", etiqueta: "Ingreso diario a planta (kg)", tipo: "number",
        requerido: true, min: 0, paso: "10", valor: l.ingresoDiarioKg, ancho: "mitad",
        ayuda: "Con esto se calcula el takt time." },
      { nombre: "origenValorKg", etiqueta: "Origen", tipo: "select", opciones: ops,
        valor: l.origenValorKg, ancho: "mitad" },
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
      { nombre: "jornadaMin", etiqueta: "Jornada (min)", tipo: "number", requerido: true,
        min: 60, max: 1440, paso: "10", valor: p.jornadaMin, ancho: "mitad" },
      { nombre: "pausasMin", etiqueta: "Almuerzo y pausas (min)", tipo: "number", requerido: true,
        min: 0, max: 240, paso: "5", valor: p.pausasMin, ancho: "mitad" },
      { nombre: "diasOperativos", etiqueta: "Días operativos al año", tipo: "number",
        requerido: true, min: 1, max: 366, paso: "1", valor: p.diasOperativos, ancho: "mitad" },
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
      { nombre: "salarioBasico", etiqueta: "Salario básico unificado ($/mes)", tipo: "number",
        requerido: true, min: 0, paso: "1", valor: p.salarioBasico, ancho: "mitad",
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
        return nf(resumen[p.id] ? resumen[p.id].gavetasRecibidas : 0); } },
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
      { titulo: "Acceso al portal", valor: function (p) {
        const acc = DB.all("usuarios").find(function (u) {
          return u.rol === "proveedor" && u.proveedorId === p.id;
        });
        if (!acc) return '<span class="etq etq-bajo">Sin acceso</span>';
        return "<code>" + esc(acc.usuario) + "</code> " +
          (acc.credencial
            ? '<span class="etq etq-ok">activa</span>'
            : '<span class="etq etq-B">sin activar</span>'); } },
      { titulo: "Estado", valor: function (p) {
        return '<span class="estado estado-' + (p.activo ? "recibido" : "inactivo") + '">' +
          (p.activo ? "Activo" : "Inactivo") + "</span>"; } },
      { titulo: "", valor: function (p) {
        const acc = DB.all("usuarios").find(function (u) {
          return u.rol === "proveedor" && u.proveedorId === p.id;
        });
        let b = '<button class="btn-mini" data-editar-prov="' + esc(p.id) + '">Editar</button>';
        if (acc) {
          b += '<button class="btn-mini" data-invitar="' + esc(acc.id) + '">Ver acceso</button>';
          if (acc.credencial) {
            b += '<button class="btn-mini" data-clave-usr="' + esc(acc.id) + '">Reactivar</button>';
          }
        }
        b += '<button class="btn-mini" data-toggle-prov="' + esc(p.id) + '">' +
          (p.activo ? "Desactivar" : "Activar") + "</button>";
        return b; } }
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
        render();
      } else {
        /* El alta crea el proveedor y su código de acceso. No se genera
           ninguna contraseña: el proveedor la crea él mismo al activar, así
           no hay claves que dictar ni que se queden circulando. */
        const n = DB.all("proveedores").length + 1;
        const codigo = "PRV-" + String(n).padStart(3, "0");
        const prov = DB.insert("proveedores", Object.assign({
          codigo: codigo, fechaAlta: DB.hoy()
        }, d));

        DB.insert("usuarios", {
          nombre: d.contacto, usuario: codigo, rol: "proveedor",
          proveedorId: prov.id, activo: true, credencial: null,
          pendienteActivacion: true, debeCambiar: false,
          fechaAlta: DB.hoy(), creadoPor: usuario.id
        });
        DB.registrarBitacora(usuario.id, "Alta de proveedor",
          d.nombre + " · código " + codigo);
        mostrarInvitacion(prov, codigo);
        render();
      }
    });
  }

  /* La clave temporal se enseña una sola vez, para dictarla o imprimirla.
     Después solo queda su hash, así que no hay forma de recuperarla. */
  /* Lo que se entrega al proveedor no es una clave, son instrucciones: su
     código y con qué identificarse. Puede repetirse cuantas veces haga
     falta, porque no hay nada secreto que se gaste. */
  function mostrarInvitacion(prov, codigo) {
    abrirPanel("Proveedor registrado", '<div class="credencial">' +
      "<p>Entrega estos datos a <strong>" + esc(prov.nombre) + "</strong>. " +
      "Él creará su propia contraseña la primera vez que entre — aquí no se " +
      "genera ninguna.</p>" +
      '<dl class="credencial-datos">' +
      "<dt>Código de proveedor</dt><dd><code>" + esc(codigo) + "</code></dd>" +
      "<dt>Se identifica con</dt><dd><code>" + esc(prov.documento) + "</code>" +
      '<br><small class="tenue">su RUC o cédula, el mismo que registraste</small></dd>' +
      "</dl>" +
      '<p class="credencial-nota">En el portal elige <strong>«Activa tu cuenta ' +
      "aquí»</strong>, escribe esos dos datos y define su contraseña. " +
      "Puedes volver a consultar el código cuando quieras: no es secreto.</p></div>", true);
  }

  /* La clave temporal de un usuario interno sí se enseña una sola vez: se
     entrega en persona, dentro de la planta. */
  function mostrarCredencial(titular, acceso, clave, rol) {
    const pol = Auth.politica(rol);
    abrirPanel("Acceso creado", '<div class="credencial">' +
      "<p>Entrega estos datos a <strong>" + esc(titular) + "</strong>. " +
      "Esta es la <strong>única vez</strong> que se muestran: el sistema guarda " +
      "solo una huella de la clave, no la clave.</p>" +
      '<dl class="credencial-datos">' +
      "<dt>Usuario</dt><dd><code>" + esc(acceso) + "</code></dd>" +
      "<dt>" + esc(pol.nombre) + " temporal</dt><dd><code>" + esc(clave) + "</code></dd>" +
      "</dl>" +
      '<p class="credencial-nota">Al entrar por primera vez deberá cambiarla ' +
      "obligatoriamente.</p></div>", true);
  }

  function formUsuarioInterno() {
    UI.abrirFormulario("Nuevo usuario interno", [
      { nombre: "nombre", etiqueta: "Nombre completo", tipo: "text", requerido: true },
      { nombre: "usuario", etiqueta: "Usuario de acceso", tipo: "text", requerido: true,
        ancho: "mitad", ayuda: "Corto y sin espacios, como «dandrade».",
        validar: function (v) {
          if (!/^[a-z0-9._-]{3,20}$/i.test(v)) return "Entre 3 y 20 caracteres, sin espacios.";
          return DB.accesoLibre(v) ? null : "Ese usuario ya está en uso.";
        } },
      { nombre: "rol", etiqueta: "Rol", tipo: "select", requerido: true, ancho: "mitad",
        vacio: "Selecciona…",
        opciones: DB.ROLES.filter(function (r) { return ROLES_INTERNOS.indexOf(r.id) !== -1; })
          .map(function (r) { return { valor: r.id, texto: r.nombre }; }),
        ayuda: "Recepción y Producción reciben un PIN; Supervisión, una contraseña." }
    ], function (d) {
      const temporal = Auth.claveTemporal(d.rol);
      return Auth.crearCredencial(temporal).then(function (cred) {
        DB.insert("usuarios", {
          nombre: d.nombre, usuario: d.usuario.toLowerCase(), rol: d.rol,
          proveedorId: null, activo: true, credencial: cred, debeCambiar: true,
          fechaAlta: DB.hoy(), creadoPor: usuario.id
        });
        DB.registrarBitacora(usuario.id, "Alta de usuario interno",
          d.nombre + " · " + d.rol);
        mostrarCredencial(d.nombre, d.usuario.toLowerCase(), temporal, d.rol);
        render();
      });
    }, { aceptar: "Crear usuario" });
  }

  function restablecerClave(usuarioId) {
    const u = DB.get("usuarios", usuarioId);
    if (!u) return;

    /* Al proveedor no se le inventa una clave: se le permite volver a
       activarse y elegir la suya. Una clave menos que dictar por teléfono. */
    if (u.rol === "proveedor") {
      const prov = DB.get("proveedores", u.proveedorId);
      if (!confirm("¿Permitir que " + (prov ? prov.nombre : u.nombre) +
        " vuelva a crear su contraseña? La actual dejará de servir.")) return;
      DB.update("usuarios", u.id, { credencial: null, pendienteActivacion: true });
      DB.registrarBitacora(usuario.id, "Reactivación habilitada",
        (prov ? prov.nombre : u.nombre) + " · " + u.usuario);
      if (prov) mostrarInvitacion(prov, u.usuario);
      render();
      return;
    }

    if (!confirm("¿Generar una clave temporal nueva para " + u.nombre +
      "? La anterior dejará de servir.")) return;
    const temporal = Auth.claveTemporal(u.rol);
    Auth.crearCredencial(temporal).then(function (cred) {
      DB.update("usuarios", u.id, { credencial: cred, debeCambiar: true });
      DB.registrarBitacora(usuario.id, "Restablecimiento de clave", u.nombre);
      mostrarCredencial(u.nombre, u.usuario, temporal, u.rol);
      render();
    });
  }

  function vistaUsuarios() {
    let html = '<div class="vista-cab"><div><h1>Usuarios</h1>' +
      '<p class="sub">Quién entra a cada aplicación, con qué rol y con qué acceso.</p></div>' +
      '<button class="btn btn-primario" id="btnNuevoUsuario">+ Nuevo usuario interno</button></div>';

    html += UI.tabla([
      { titulo: "Nombre", valor: function (u) { return "<strong>" + esc(u.nombre) + "</strong>"; } },
      { titulo: "Usuario", valor: function (u) {
        return u.usuario ? "<code>" + esc(u.usuario) + "</code>" : '<span class="tenue">—</span>'; } },
      { titulo: "Acceso", valor: function (u) {
        if (!u.credencial) {
          return u.rol === "proveedor"
            ? '<span class="etq etq-B">Pendiente de activar</span>'
            : '<span class="etq etq-bajo">Sin clave</span>';
        }
        if (u.debeCambiar) return '<span class="etq etq-B">Clave temporal</span>';
        return '<span class="etq etq-ok">Activa</span>'; } },
      { titulo: "Último ingreso", valor: function (u) {
        return u.ultimoAcceso ? UI.fechaCorta(u.ultimoAcceso.slice(0, 10))
          : '<span class="tenue">nunca</span>'; } },
      { titulo: "Aplicación", valor: function (u) {
        return u.rol === "proveedor"
          ? '<span class="etq etq-rol">Portal externo</span>'
          : '<span class="etq etq-ok">Sistema de planta</span>'; } },
      { titulo: "Rol", valor: function (u) {
        const r = DB.ROLES.find(function (x) { return x.id === u.rol; });
        return r ? UI.icono(r.icono) + " " + esc(r.nombre) : esc(u.rol); } },
      { titulo: "Proveedor", valor: function (u) {
        return u.proveedorId ? esc(Indicadores.nombreProveedor(u.proveedorId)) : "—"; } },
      { titulo: "Estado", valor: function (u) {
        return '<span class="estado estado-' + (u.activo ? "recibido" : "inactivo") + '">' +
          (u.activo ? "Activo" : "Inactivo") + "</span>"; } },
      { titulo: "", valor: function (u) {
        let b = '<button class="btn-mini" data-clave-usr="' + esc(u.id) + '">Restablecer clave</button>';
        if (u.id === usuario.id) return b + ' <span class="tenue">Sesión actual</span>';
        b += '<button class="btn-mini" data-toggle-usr="' + esc(u.id) + '">' +
          (u.activo ? "Desactivar" : "Activar") + "</button>";
        return b; } }
    ], DB.all("usuarios"), {});

    html += '<p class="nota-info"><strong>Cómo se guardan las claves.</strong> No se guardan: ' +
      "se guarda el resultado de derivarlas con PBKDF2-SHA256 y una sal distinta por persona, " +
      "así que desde el almacén no se puede llegar a la clave. Por eso una clave olvidada se " +
      "<em>restablece</em>, nunca se consulta.</p>";
    html += '<p class="nota-seguridad">' + UI.icono("alerta") + ' Límite del prototipo: la comprobación ocurre en el ' +
      "navegador, no en un servidor. Quien pueda leer el almacén ve los hashes y podría " +
      "intentar adivinarlos sin conexión. Es suficiente para que nadie entre haciéndose pasar " +
      "por otro en planta, pero un despliegue real debe verificar la clave en el servidor. " +
      "Ver <code>app/README.md</code> §11.</p>";
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

  /* Pide los datos de quien queda como única cuenta, y obliga a escribir
     una palabra antes de borrar: es irreversible y afecta a todos los
     dispositivos a la vez, así que un «aceptar» no basta. */
  function formArrancarLimpio() {
    UI.abrirFormulario("Empezar de cero con datos reales", [
      { tipo: "html", contenido:
        '<p class="nota-aviso">Se borran <strong>todos</strong> los lotes, producciones, ' +
        "planes, proveedores y usuarios, en todos los dispositivos. Se conservan las " +
        "líneas, el estudio de tiempos, las causas raíz, los destinos y los parámetros.</p>" },
      { nombre: "nombre", etiqueta: "Tu nombre completo", tipo: "text", requerido: true,
        valor: usuario.nombre, ancho: "mitad",
        ayuda: "Quedarás como supervisor, con la única cuenta del sistema." },
      { nombre: "acceso", etiqueta: "Tu usuario para entrar", tipo: "text", requerido: true,
        valor: usuario.usuario, ancho: "mitad",
        validar: function (v) {
          return /^[A-Za-z0-9._-]{3,}$/.test(String(v).trim())
            ? null : "Usa al menos 3 caracteres, sin espacios ni acentos.";
        } },
      { nombre: "confirmacion", etiqueta: "Escribe EMPEZAR para confirmar", tipo: "text",
        requerido: true, marcador: "EMPEZAR",
        validar: function (v) {
          return String(v).trim().toUpperCase() === "EMPEZAR"
            ? null : "Escribe la palabra EMPEZAR, en mayúsculas o minúsculas.";
        } }
    ], async function (d) {
      const clave = Auth.claveTemporal("supervisor");
      const credencial = await Auth.crearCredencial(clave);
      const nuevo = {
        id: "us_" + Date.now().toString(36),
        nombre: String(d.nombre).trim(),
        usuario: String(d.acceso).trim(),
        rol: "supervisor",
        proveedorId: null,
        activo: true,
        debeCambiar: true,
        credencial: credencial,
        creadoEn: new Date().toISOString()
      };
      await DB.arrancarLimpio(nuevo);
      /* La sesión anterior apuntaba a un usuario que ya no existe. */
      UI.cerrarSesion(SESION);
      usuario = null;
      vista = "panel";
      render();
      mostrarCredencial(nuevo.nombre, nuevo.usuario, clave, "supervisor");
    }, { aceptar: "Borrar y empezar", peligro: true, ancho: true,
         nota: "Al terminar se te mostrará tu clave temporal <strong>una sola vez</strong>. " +
           "Anótala antes de cerrar: el sistema no la guarda." });
  }

  /* Archivar no es borrar: primero baja el respaldo del mes, con el detalle
     lote a lote, y solo entonces se comprime dentro de la app. */
  function archivarMes(mes) {
    const resumen = Indicadores.resumenMensual(mes);
    if (!resumen.documentosArchivados) {
      UI.aviso("Ese mes no tiene nada que archivar.", "alerta");
      return;
    }

    UI.abrirFormulario("Archivar " + mes, [
      { tipo: "html", contenido:
        '<p class="nota-info">Se guardará el resumen del mes y se borrarán <strong>' +
        nf(resumen.documentosArchivados) + "</strong> documentos sueltos (" +
        nf(resumen.lotes) + " lotes y " + nf(resumen.producciones) + " producciones).</p>" +
        '<div class="conteos">' +
        "<div><span>Kilos recibidos</span><strong>" + nf(resumen.kgRecibidos) + "</strong></div>" +
        "<div><span>Rendimiento</span><strong>" + pct(resumen.tasaExportable) + "</strong></div>" +
        "<div><span>Merma</span><strong>" + pct(resumen.tasaMerma) + "</strong></div>" +
        "<div><span>Valor comprado</span><strong>" + money(resumen.valorCompra) + "</strong></div>" +
        "</div>" },
      { nombre: "respaldo", etiqueta: "", tipo: "checkbox", valor: true,
        textoCheck: "Descargar el respaldo completo del mes antes de archivar" },
      { nombre: "confirmacion", etiqueta: "Escribe ARCHIVAR para confirmar", tipo: "text",
        requerido: true, marcador: "ARCHIVAR",
        validar: function (v) {
          return String(v).trim().toUpperCase() === "ARCHIVAR"
            ? null : "Escribe la palabra ARCHIVAR.";
        } }
    ], async function (d) {
      if (d.respaldo) {
        const datos = Indicadores.filtrar({ desde: resumen.desde, hasta: resumen.hasta });
        UI.descargar(new Blob([JSON.stringify({
          mes: mes, generadoEn: new Date().toISOString(), resumen: resumen,
          lotes: datos.lotes, producciones: datos.producciones
        }, null, 2)], { type: "application/json" }), "acopia_archivo_" + mes + ".json");
      }
      const r = await DB.archivarMes(resumen);
      DB.registrarBitacora(usuario.id, "Mes archivado",
        mes + " · " + r.liberados + " documentos comprimidos en un resumen");
      UI.aviso("Mes " + mes + " archivado. Se liberaron " + nf(r.liberados) + " documentos.");
      render();
    }, { aceptar: "Archivar el mes", peligro: true, ancho: true,
         nota: "El detalle lote a lote queda en el archivo descargado. Dentro de la app " +
           "seguirás viendo los indicadores del mes a través de su resumen." });
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

    /* --- capacidad --- */
    const cap = DB.capacidad();
    const tono = cap.ocupacion >= 0.9 ? "mal" : cap.ocupacion >= 0.7 ? "regular" : "bien";
    html += '<section class="panel panel-' + tono + '"><h2>Capacidad del repositorio</h2>' +
      '<p class="sub panel-sub">El almacén compartido admite ' + nf(cap.tope) +
      " documentos: uno por lote, por producción, por proveedor, usuario, plan y resumen. " +
      "Ese techo no se puede subir, pero sí se puede liberar espacio sin perder la " +
      "historia.</p>" +
      Graficos.medidor(cap.ocupacion, 1, "Ocupación",
        nf(cap.usados) + " de " + nf(cap.tope) + " documentos · quedan " + nf(cap.libres)) +
      '<div class="conteos">';
    [["Lotes", cap.porColeccion.lotes], ["Producciones", cap.porColeccion.producciones],
     ["Proveedores", cap.porColeccion.proveedores], ["Usuarios", cap.porColeccion.usuarios],
     ["Planes", cap.porColeccion.planes], ["Resúmenes", cap.porColeccion.resumenes || 0]
    ].forEach(function (c) {
      html += "<div><span>" + esc(c[0]) + "</span><strong>" + nf(c[1]) + "</strong></div>";
    });
    html += "</div>";

    if (cap.porDia > 0) {
      html += '<p class="nota-' +
        (cap.diasRestantes !== null && cap.diasRestantes < 180 ? "aviso" : "info") + '">' +
        "Al ritmo de esta planta —<strong>" + nf(cap.porDia, 1) + " documentos al día</strong>, " +
        "medido sobre lo que ya hay registrado— el tope llegaría en <strong>" +
        nf(cap.diasRestantes) + " días</strong>, alrededor de " +
        nf(cap.diasRestantes / 365, 1) + " años.</p>";
    }
    html += "</section>";

    /* --- archivo --- */
    const meses = Indicadores.mesesArchivables();
    html += '<section class="panel"><h2>Archivar meses cerrados</h2>' +
      '<p class="sub panel-sub">Archivar un mes guarda su <strong>resumen</strong> —kilos, ' +
      "rendimiento, merma por causa y por destino, valor por proveedor— y borra los lotes y " +
      "producciones sueltos de ese mes. Un mes archivado pasa de decenas de documentos a " +
      "uno solo.</p>";

    if (!meses.length) {
      html += '<p class="vacio">Todavía no hay meses anteriores que archivar.</p>';
    } else {
      html += UI.tabla([
        { titulo: "Mes", valor: function (m) { return "<strong>" + esc(m.mes) + "</strong>"; } },
        { titulo: "Lotes", num: true, valor: function (m) { return nf(m.lotes); } },
        { titulo: "Estado", valor: function (m) {
          return m.archivable
            ? '<span class="etq etq-ok">Todo cerrado</span>'
            : '<span class="etq etq-bajo">' + nf(m.abiertos) + " sin cerrar</span>"; } },
        { titulo: "", valor: function (m) {
          return m.archivable
            ? '<button class="btn-mini btn-mini-accion" data-archivar="' + esc(m.mes) +
              '">Archivar</button>'
            : '<span class="tenue">Ciérralos primero</span>'; } }
      ], meses, {});
    }

    html += '<p class="nota-aviso"><strong>Antes de archivar se descarga el respaldo ' +
      "completo de ese mes</strong>, con el detalle lote a lote. Dentro de la app queda el " +
      "resumen; el detalle vive en ese archivo. No se archiva un mes con lotes sin cerrar: " +
      "se perdería trabajo a medias.</p>";
    html += "</section>";

    html += '<section class="panel"><h2>Respaldo y restauración</h2>' +
      "<p>Todo el repositorio se guarda como un único archivo JSON, útil como anexo del TIC.</p>" +
      '<div class="acciones-fila">' +
      '<button class="btn btn-primario" id="btnExportarJSON">Descargar respaldo</button>' +
      '<label class="btn btn-sec" for="inputImportar">Restaurar desde archivo</label>' +
      '<input type="file" id="inputImportar" accept="application/json" hidden>' +
      (DB.esModoReal() ? ""
        : '<button class="btn btn-plano" id="btnReiniciar">Reiniciar con datos de demostración</button>') +
      "</div></section>";

    /* --- puesta en marcha con datos reales --- */
    const real = DB.esModoReal();
    html += '<section class="panel ' + (real ? "panel-bien" : "panel-destacado") +
      '"><h2>Poner en marcha con datos reales</h2>';
    if (real) {
      html += '<p class="nota-ok"><strong>Este sistema ya está en modo real.</strong> ' +
        "Los datos de demostración se borraron y las cuentas de ejemplo dejaron de " +
        "existir, así que la pantalla de acceso ya no las ofrece.</p>";
    } else {
      html += "<p>Ahora mismo el sistema trae <strong>datos de demostración</strong>: " +
        "proveedores inventados, lotes simulados y cuentas de ejemplo cuyas claves están " +
        "a la vista en la pantalla de acceso. Sirven para probar y para las capturas del " +
        "documento, no para trabajar.</p>" +
        "<p>Al ponerlo en marcha se borra <strong>toda la operación</strong> —lotes, " +
        "producciones, planes, proveedores y usuarios— y se conservan los " +
        "<strong>catálogos</strong>: líneas, estudio de tiempos, causas raíz, destinos y " +
        "parámetros, que no son demostración sino lo medido en el TIC. Queda una sola " +
        "cuenta: la tuya.</p>" +
        '<p class="nota-aviso"><strong>Es irreversible y afecta a todos los ' +
        "dispositivos.</strong> Si quieres conservar lo que hay, descarga primero el " +
        "respaldo de arriba.</p>" +
        '<div class="acciones-fila">' +
        '<button class="btn btn-peligro" id="btnArrancarLimpio">Empezar de cero con datos reales</button>' +
        "</div>";
    }
    html += "</section>";

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
      '<div class="acceso-marca"><span class="logo" aria-hidden="true">' + UI.icono("marca") + '</span>' +
      "<div><strong>" + esc(DB.MARCA.producto) + "</strong><small>" +
      esc(DB.MARCA.descripcion) + "</small></div></div>" +
      '<p class="acceso-intro">Sistema interno de planta.</p>' +
      '<form id="formAcceso" novalidate>' +
      '<div class="campo"><label for="acceso">Usuario</label>' +
      '<input type="text" id="acceso" name="acceso" autocomplete="username" ' +
      'placeholder="tu usuario" autocapitalize="none" spellcheck="false" required></div>' +
      '<div class="campo"><label for="clave">Contraseña o PIN</label>' +
      '<div class="campo-clave">' +
      '<input type="password" id="clave" name="clave" autocomplete="current-password" required>' +
      '<button type="button" class="ver-clave" id="verClave" aria-label="Mostrar">' + UI.icono("ojo") + '</button>' +
      "</div></div>" +
      '<label class="check check-recordar"><input type="checkbox" id="recordar"> ' +
      "Mantener la sesión en este equipo</label>" +
      '<p class="form-error" id="accesoError" role="alert" hidden></p>' +
      estadoConexionHTML() +
      '<button type="submit" class="btn btn-primario btn-ancho btn-grande" id="btnEntrar">Entrar</button>' +
      "</form>" + demoHTML();

    html += '<p class="acceso-ayuda">Recepción y Producción entran con PIN; Supervisión, ' +
      "con contraseña. Si la olvidaste, Supervisión puede regenerarla.</p>";
    html += '<p class="acceso-pie">¿Eres proveedor? <a ' + UI.rutaOtraApp("proveedor") +
      ">Entra al portal</a></p></div></div>";
    return html;
  }

  function formCambiarClave(obligatorio) {
    const pol = Auth.politica(usuario.rol);
    UI.abrirFormulario(obligatorio ? "Crea tu " + pol.nombre.toLowerCase() : "Cambiar " + pol.nombre.toLowerCase(), [
      { tipo: "html", contenido: '<p class="modal-nota">' + (obligatorio
        ? "Estás usando la clave temporal que te dio Supervisión. Crea la tuya para continuar."
        : "Elige una clave nueva para tu acceso.") + "</p>" },
      { nombre: "nueva", etiqueta: pol.nombre + " nueva",
        tipo: pol.tipo === "pin" ? "number" : "password", requerido: true, ayuda: pol.ayuda,
        validar: function (v) { return Auth.revisar(v, usuario.rol); } },
      { nombre: "repetir", etiqueta: "Repítela",
        tipo: pol.tipo === "pin" ? "number" : "password", requerido: true,
        validar: function (v, d) {
          return String(v) === String(d.nueva) ? null : "Las dos no coinciden.";
        } }
    ], function (d) {
      const id = usuario.id;
      return Auth.crearCredencial(String(d.nueva)).then(function (cred) {
        DB.update("usuarios", id, { credencial: cred, debeCambiar: false });
        if (usuario && usuario.id === id) usuario = DB.get("usuarios", id);
        DB.registrarBitacora(usuario.id, "Cambio de clave", usuario.nombre);
        UI.aviso(pol.nombre + " actualizada.");
        render();
      });
    }, { aceptar: "Guardar" });
  }

  /* =============================== render ============================= */

  function render() {
    const app = $("#app");

    if (!usuario) {
      UI.soltarFormulario();
      app.innerHTML = vistaAcceso();
      enlazarAcceso();
      return;
    }

    const rol = DB.ROLES.find(function (r) { return r.id === usuario.rol; });
    const compartido = DB.esCompartido() && DB.pendientes() === 0;
    const anunciados = DB.all("lotes").filter(function (l) { return l.estado === "Anunciado"; }).length;
    const porCerrar = lotesPorCerrar().length;
    const porProcesar = DB.all("lotes").filter(function (l) { return l.estado === "Recibido"; }).length;

    let html = '<div class="capa"><aside class="lateral" id="lateral">' +
      '<div class="marca"><span class="logo" aria-hidden="true">' + UI.icono("marca") + '</span>' +
      "<div><strong>" + esc(DB.MARCA.producto) + "</strong><small>" +
      esc(DB.subtitulo()) + "</small></div></div><nav>";

    /* El título del grupo se escribe cuando cambia, no una vez por item:
       así un operario de recepción, que solo ve tres entradas, no se
       encuentra con cuatro encabezados vacíos. */
    let grupoActual = null;
    menu().forEach(function (m) {
      if ((m.grupo || null) !== grupoActual) {
        grupoActual = m.grupo || null;
        if (grupoActual) {
          html += '<p class="nav-grupo">' + esc(grupoActual) + "</p>";
        }
      }

      /* Dos contadores: lo que llega del portal externo y lo que ya se
         procesó y espera el cierre. Sin el segundo, cerrar un pedido era
         una acción escondida en una columna de una tabla. */
      let pendiente = "";
      if (m.id === "recepcion" && anunciados > 0) {
        pendiente = '<span class="nav-contador">' + anunciados + "</span>";
      } else if (m.id === "produccion" && porProcesar > 0 && puede("procesar")) {
        pendiente = '<span class="nav-contador">' + porProcesar + "</span>";
      } else if (m.id === "lotes" && porCerrar > 0 && puede("cerrar")) {
        pendiente = '<span class="nav-contador">' + porCerrar + "</span>";
      }
      html += '<button type="button" class="nav-item' + (m.id === vista ? " activo" : "") +
        '" data-ir="' + m.id + '"' + (m.id === vista ? ' aria-current="page"' : "") + ">" +
        UI.icono(m.icono) + "<span>" + esc(m.texto) + "</span>" + pendiente + "</button>";
    });

    html += "</nav><div class='lateral-pie'>" +
      '<p class="sincro sincro-' + (compartido ? "on" : "off") + '">' +
      '<span class="sincro-punto" aria-hidden="true"></span>' +
      (DB.pendientes() > 0 ? DB.pendientes() + " sin enviar"
        : compartido ? "Datos compartidos" : "Solo este equipo") + "</p>" +
      '<p class="tenue sincro-ayuda">' + (compartido
        ? "Conectado con el portal del proveedor."
        : "Sin conexión con el portal externo.") + "</p>" +
      "<p class='tenue'>v4.0 · prototipo TIC</p></div></aside>";

    html += '<div class="principal"><header class="barra">' +
      '<button class="menu-btn" id="btnMenu" aria-label="Abrir menú" aria-expanded="false">' + UI.icono("menu") + '</button>' +
      '<div class="barra-usuario"><div class="avatar" aria-hidden="true">' +
      (rol ? UI.icono(rol.icono) : "") + "</div><div><strong>" + esc(usuario.nombre) + "</strong>" +
      "<small>" + esc(rol ? rol.nombre : usuario.rol) + "</small></div>" +
      UI.campana(Novedades.sinVer(usuario)) +
      '<button class="btn btn-plano" id="btnClave" title="Cambiar mi clave" aria-label="Cambiar mi clave">' + UI.icono("llave") + '</button>' +
      '<button class="btn btn-plano" id="btnSalir">Salir</button></div>' +
      (novedadesAbiertas ? UI.panelNovedades(novedadesActuales()) : "") + "</header>";

    html += '<main id="contenido" tabindex="-1" class="vista-' + esc(vista) + '">';
    const sinEnviar = DB.pendientes();
    if (sinEnviar > 0) {
      html += '<p class="banda-pendiente"><strong>' + sinEnviar +
        (sinEnviar === 1 ? " registro sin enviar." : " registros sin enviar.") +
        "</strong> Quedaron guardados aquí y saldrán solos al volver la conexión.</p>";
    }
    if (vista === "panel") html += vistaPanel();
    else if (vista === "planificador") html += vistaPlanificador();
    else if (vista === "tiempos") html += vistaTiempos();
    else if (vista === "recepcion") html += vistaRecepcion();
    else if (vista === "produccion") html += vistaProduccion();
    else if (vista === "lotes") html += vistaLotes();
    else if (vista === "reportes") html += vistaReportes();
    else if (vista === "liquidacion") html += vistaLiquidacion();
    else if (vista === "costeo") html += vistaCosteo();
    else if (vista === "catalogos") html += vistaCatalogos();
    else if (vista === "proveedores") html += vistaProveedores();
    else if (vista === "usuarios") html += vistaUsuarios();
    else if (vista === "bitacora") html += vistaBitacora();
    else if (vista === "datos") html += vistaDatos();
    else if (vista === "guia") html += vistaGuia();
    html += "</main></div></div>";

    UI.soltarFormulario();
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
          { titulo: "Gavetas", csv: function (d) { return d.gavetas; } },
          { titulo: "Cajas", csv: function (d) { return Math.round(d.cajas); } },
          { titulo: "Ciclo min por gaveta", csv: function (d) { return d.cicloGavetaMin.toFixed(2); } },
          { titulo: "Contenido min-persona por gaveta", csv: function (d) { return d.contenidoGavetaMin.toFixed(2); } },
          { titulo: "Estacion que manda", csv: function (d) { return d.cuello; } },
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
          fecha: p.fecha, jornadaMin: p.jornadaMin || DB.parametros().jornadaMin,
          pausasMin: p.pausasMin === undefined ? DB.parametros().pausasMin : p.pausasMin,
          operarios: p.operarios, eficiencia: p.eficiencia, lineas: p.lineas.slice()
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
    const boton = $("#btnEntrar");
    UI.vigilarFormulario(form);

    $$(".demo").forEach(function (b) {
      b.addEventListener("click", function () {
        $("#acceso").value = b.dataset.usr;
        $("#clave").value = b.dataset.clave;
        $("#btnEntrar").focus();
      });
    });

    const ver = $("#verClave");
    if (ver) {
      ver.addEventListener("click", function () {
        const campo = $("#clave");
        campo.type = campo.type === "password" ? "text" : "password";
        campo.focus();
      });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      error.hidden = true;
      boton.disabled = true;
      boton.textContent = "Comprobando…";

      entrar(form.acceso.value, form.clave.value, $("#recordar").checked).then(function (r) {
        if (r.error) {
          error.textContent = r.error;
          error.hidden = false;
          boton.disabled = false;
          boton.textContent = "Entrar";
          $("#clave").value = "";
          $("#clave").focus();
          return;
        }
        render();
        UI.aviso("Bienvenido, " + usuario.nombre + ".");
        if (r.debeCambiar) formCambiarClave(true);
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
    const btnClave = $("#btnClave");
    if (btnClave) btnClave.addEventListener("click", function () { formCambiarClave(false); });

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
    const buscar = $("#buscarLote");
    if (buscar) {
      buscar.addEventListener("input", function () {
        filtros.texto = buscar.value;
        render();
        /* Tras repintar, el foco vuelve al cuadro y al final del texto. */
        const otra = $("#buscarLote");
        if (otra) { otra.focus(); otra.setSelectionRange(otra.value.length, otra.value.length); }
      });
    }
    const limpiarBusca = $("#btnLimpiarBusca");
    if (limpiarBusca) {
      limpiarBusca.addEventListener("click", function () { filtros.texto = ""; render(); });
    }

    const btnLimpiar = $("#btnLimpiar");
    if (btnLimpiar) {
      btnLimpiar.addEventListener("click", function () {
        filtros = { desde: DB.diasAtras(30), hasta: DB.hoy(), proveedorId: "",
          lineaId: "", calidad: "", estado: "", texto: "" };
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
    $$("[data-corregir-pesaje]").forEach(function (b) {
      b.addEventListener("click", function () { formPesar(b.dataset.corregirPesaje, true); });
    });
    $$("[data-corregir-prod]").forEach(function (b) {
      b.addEventListener("click", function () { formProcesar(b.dataset.corregirProd, true); });
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
        planActual.jornadaMin = Number(d.get("jornadaMin")) || planActual.jornadaMin;
        const pau = d.get("pausasMin");
        if (pau !== null && pau !== "") planActual.pausasMin = Number(pau);
        planActual.operarios = Number(d.get("operarios")) || planActual.operarios;
        planActual.eficiencia = Number(d.get("eficiencia")) || planActual.eficiencia;
        render();
      });
    }
    $$("[data-linea]").forEach(function (input) {
      const actualizar = function () {
        const item = planActual.lineas.find(function (x) { return x.lineaId === input.dataset.linea; });
        if (item) item.gavetas = Number(input.value) || 0;
        refrescarPlan();
      };
      input.addEventListener("input", actualizar);
      input.addEventListener("change", actualizar);
    });
    const btnGuardarPlan = $("#btnGuardarPlan");

    if (btnGuardarPlan) {
      btnGuardarPlan.addEventListener("click", function () {
        const r = Indicadores.planificar(planActual);
        if (r.gavetasTotales <= 0) { UI.aviso("Escribe las gavetas antes de guardar el plan.", "alerta"); return; }
        DB.insert("planes", {
          fecha: planActual.fecha,
          jornadaMin: planActual.jornadaMin,
          pausasMin: planActual.pausasMin,
          operarios: planActual.operarios,
          eficiencia: planActual.eficiencia,
          lineas: planActual.lineas.slice(),
          gavetasTotales: r.gavetasTotales,
          cajasTotales: Math.round(r.cajasTotales),
          carga: r.carga,
          registradoPor: usuario.id,
          creadoEn: new Date().toISOString()
        });
        DB.registrarBitacora(usuario.id, "Plan de producción guardado",
          planActual.fecha + " · " + nf(r.gavetasTotales) + " gavetas · carga " + pct(r.carga));
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
    const btnIdent = $("#btnEditarIdentidad");
    if (btnIdent) btnIdent.addEventListener("click", formIdentidad);
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
    const btnNuevoUsr = $("#btnNuevoUsuario");
    if (btnNuevoUsr) btnNuevoUsr.addEventListener("click", formUsuarioInterno);

    $$("[data-invitar]").forEach(function (b) {
      b.addEventListener("click", function () {
        const u = DB.get("usuarios", b.dataset.invitar);
        const prov = u ? DB.get("proveedores", u.proveedorId) : null;
        if (prov) mostrarInvitacion(prov, u.usuario);
      });
    });

    $$("[data-clave-usr]").forEach(function (b) {
      b.addEventListener("click", function () { restablecerClave(b.dataset.claveUsr); });
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
          "acopia_respaldo_" + DB.hoy() + ".json");
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
    enlazarNovedades();
    if (vista === "tiempos") enlazarTiempos();
    if (vista === "liquidacion") enlazarLiquidacion();
    if (vista === "costeo") enlazarCosteo();

    $$("[data-archivar]").forEach(function (b) {
      b.addEventListener("click", function () { archivarMes(b.dataset.archivar); });
    });

    const btnLimpio = $("#btnArrancarLimpio");
    if (btnLimpio) btnLimpio.addEventListener("click", formArrancarLimpio);

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
      UI.repintarSiSeguro(render, repintarPorSincronizacion);
    }, 200);
  }


  /* Las cuentas de prueba se enseñan DENTRO de la aplicación. Tenerlas solo
     en la documentación deja a quien abre la app sin saber qué escribir. */
  let demo = [];

  function demoHTML() {
    if (!demo.length) return "";
    let h = '<details class="demo-cuentas"><summary>¿Estás probando el sistema? ' +
      "Cuentas de demostración</summary><ul>";
    demo.forEach(function (c) {
      h += '<li><button type="button" class="demo" data-usr="' + esc(c.usuario) +
        '" data-clave="' + esc(c.clave) + '">' + esc(c.usuario) + "</button>" +
        '<span><strong>' + esc(c.nombre) + "</strong>" +
        (c.detalle ? " · " + esc(c.detalle) : "") + "</span></li>";
    });
    h += "</ul><p>Al pulsar una se rellena el formulario. Desaparecen solas " +
      "en cuanto se cambian sus claves.</p></details>";
    return h;
  }

  /* La pantalla de acceso avisa de que está conectando: sin esto, la espera
     parece que la aplicación no responde. */
  let conectado = false;

  function marcarConectado() {
    conectado = true;
    const el = UI.$("#estadoConexion");
    if (el) el.outerHTML = estadoConexionHTML();
  }

  function textoConexion() {
    if (!conectado) return "Conectando con el sistema…";
    const n = DB.pendientes();
    const pend = n === 1 ? "1 registro pendiente" : n + " registros pendientes";
    if (!DB.esCompartido()) {
      return "Sin conexión" + (n > 0 ? " — " + pend + ", se enviarán al volver" : "");
    }
    return n > 0 ? pend + " de enviar" : "Conectado al sistema";
  }

  function claseConexion() {
    if (!conectado) return "conexion";
    if (DB.pendientes() > 0) return "conexion conexion-pendiente";
    return DB.esCompartido() ? "conexion conexion-ok" : "conexion conexion-sinred";
  }

  function estadoConexionHTML() {
    return '<p class="' + claseConexion() + '" id="estadoConexion">' +
      '<span class="conexion-punto" aria-hidden="true"></span>' + textoConexion() + "</p>";
  }

  function iniciar() {
    UI.prepararGuardado();
    DB.load();
    restaurar();
    render();

    DB.vigilarRed();
    DB.alCambiarCola(function () { UI.repintarSiSeguro(render); });
    DB.alFallarEscritura(function (codigo) {
      UI.aviso(codigo === "quota_exceeded"
        ? "El almacén está lleno. Reinicia los datos desde Datos del sistema."
        : "No se pudo guardar el cambio.", "error");
    });

    /* Al conectar cambian los datos, pero si la persona ya está llenando el
       acceso NO se repinta: seria borrarle lo escrito justo antes de entrar. */
    DB.conectar(repintarPorSincronizacion).then(function (m) {
      return DB.sembrarCredenciales()
        .then(function () { return DB.cuentasDemo(ROLES_INTERNOS); })
        .then(function (lista) { demo = lista; return m; });
    }).then(function (m) {
      marcarConectado();
      UI.repintarSiSeguro(render, function () { UI.repintarSiSeguro(render); });
      if (m === "compartido" && usuario) UI.aviso("Conectado con el portal del proveedor.");
    }).catch(function (e) {
      console.warn("Fallo al preparar el acceso:", e);
      marcarConectado();
      UI.repintarSiSeguro(render);
    });
  }

  /* Se expone en vez de arrancar sola: la página propia la inicia, y el
     paquete de las dos aplicaciones decide cuál montar. */
  window.PlantaApp = { iniciar: function () { UI.alArrancar(iniciar); } };
})();
