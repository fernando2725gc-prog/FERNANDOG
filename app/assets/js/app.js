/* =========================================================================
   app.js — Controlador de la aplicación
   Sesión, permisos por rol, navegación, formularios y reportes.
   ========================================================================= */

(function () {
  "use strict";

  /* ============================ estado de la sesión ==================== */

  const SESION = "agroreg.sesion";
  let usuario = null;
  let vistaActual = "dashboard";

  let filtros = {
    desde: DB.diasAtras(30),
    hasta: DB.hoy(),
    proveedorId: "",
    frutaId: "",
    calidad: ""
  };

  /* =============================== utilidades ========================== */

  const $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  const $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  function esc(s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function nf(n, dec) {
    return new Intl.NumberFormat("es-EC", {
      minimumFractionDigits: dec || 0,
      maximumFractionDigits: dec === undefined ? 0 : dec
    }).format(Number(n) || 0);
  }

  function pct(n, dec) {
    return nf((Number(n) || 0) * 100, dec === undefined ? 1 : dec) + "%";
  }

  function money(n) {
    return "$" + nf(n, 2);
  }

  function fechaLarga(iso) {
    if (!iso) return "—";
    const d = new Date(iso.length > 10 ? iso : iso + "T12:00:00");
    return d.toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
  }

  function aviso(mensaje, tipo) {
    const cont = $("#avisos");
    const div = document.createElement("div");
    div.className = "aviso aviso-" + (tipo || "ok");
    div.setAttribute("role", "status");
    div.textContent = mensaje;
    cont.appendChild(div);
    setTimeout(function () { div.classList.add("saliendo"); }, 3200);
    setTimeout(function () { div.remove(); }, 3700);
  }

  function puede(accion) {
    if (!usuario) return false;
    const permisos = {
      admin: ["*"],
      proveedor: ["ver_dashboard", "crear_recepcion", "ver_recepciones", "ver_reportes"],
      produccion: ["ver_dashboard", "ver_recepciones", "confirmar_recepcion",
        "crear_produccion", "ver_producciones", "ver_reportes"]
    };
    const lista = permisos[usuario.rol] || [];
    return lista.indexOf("*") !== -1 || lista.indexOf(accion) !== -1;
  }

  /* El proveedor solo puede ver lo suyo: se fuerza el filtro en cada lectura. */
  function filtrosEfectivos() {
    const f = Object.assign({}, filtros);
    if (usuario && usuario.rol === "proveedor") f.proveedorId = usuario.proveedorId;
    return f;
  }

  /* ================================ sesión ============================= */

  function iniciarSesion(nombreUsuario, clave) {
    const u = DB.all("usuarios").find(function (x) {
      return x.usuario.toLowerCase() === String(nombreUsuario).toLowerCase().trim();
    });
    if (!u || u.clave !== clave) return { ok: false, error: "Usuario o contraseña incorrectos." };
    if (!u.activo) return { ok: false, error: "El usuario está inactivo. Contacte al administrador." };
    usuario = u;
    try { sessionStorage.setItem(SESION, u.id); } catch (e) { /* modo privado */ }
    DB.registrarBitacora(u.id, "Inicio de sesión", u.nombre + " (" + u.rol + ")");
    return { ok: true };
  }

  function cerrarSesion() {
    if (usuario) DB.registrarBitacora(usuario.id, "Cierre de sesión", usuario.nombre);
    usuario = null;
    try { sessionStorage.removeItem(SESION); } catch (e) { /* noop */ }
    vistaActual = "dashboard";
    render();
  }

  function restaurarSesion() {
    try {
      const id = sessionStorage.getItem(SESION);
      if (id) usuario = DB.get("usuarios", id);
    } catch (e) { /* noop */ }
  }

  /* ============================== navegación =========================== */

  function menu() {
    const items = [
      { id: "dashboard", texto: "Panel de indicadores", icono: "📊", permiso: "ver_dashboard" },
      { id: "recepciones", texto: usuario && usuario.rol === "proveedor" ? "Mis envíos" : "Recepción de fruta", icono: "🚚", permiso: "ver_recepciones" },
      { id: "produccion", texto: "Producción", icono: "🏭", permiso: "ver_producciones" },
      { id: "proveedores", texto: "Proveedores", icono: "🤝", permiso: "*" },
      { id: "usuarios", texto: "Usuarios", icono: "👥", permiso: "*" },
      { id: "reportes", texto: "Reportes", icono: "📄", permiso: "ver_reportes" },
      { id: "bitacora", texto: "Bitácora", icono: "🕘", permiso: "*" },
      { id: "datos", texto: "Datos del sistema", icono: "⚙️", permiso: "*" }
    ];
    return items.filter(function (i) {
      return i.permiso === "*" ? usuario.rol === "admin" : puede(i.permiso);
    });
  }

  function ir(vista) {
    vistaActual = vista;
    render();
    const main = $("#contenido");
    if (main) main.focus();
  }

  /* ============================== componentes ========================== */

  function tarjetaKPI(etiqueta, valor, detalle, tono) {
    return '<article class="kpi kpi-' + (tono || "neutro") + '">' +
      '<p class="kpi-etiqueta">' + esc(etiqueta) + "</p>" +
      '<p class="kpi-valor">' + valor + "</p>" +
      '<p class="kpi-detalle">' + (detalle || "") + "</p></article>";
  }

  function tabla(columnas, filas, opciones) {
    const o = opciones || {};
    if (!filas.length) {
      return '<p class="vacio">' + esc(o.vacio || "No hay registros que coincidan con el filtro.") + "</p>";
    }
    let html = '<div class="tabla-scroll"><table class="tabla"><thead><tr>';
    columnas.forEach(function (c) {
      html += '<th scope="col"' + (c.num ? ' class="num"' : "") + ">" + esc(c.titulo) + "</th>";
    });
    html += "</tr></thead><tbody>";
    filas.forEach(function (f) {
      html += "<tr>";
      columnas.forEach(function (c) {
        html += "<td" + (c.num ? ' class="num"' : "") + ">" + c.valor(f) + "</td>";
      });
      html += "</tr>";
    });
    html += "</tbody>";
    if (o.pie) {
      html += "<tfoot><tr>";
      columnas.forEach(function (c) {
        html += "<td" + (c.num ? ' class="num"' : "") + ">" + (o.pie[c.clave] || "") + "</td>";
      });
      html += "</tr></tfoot>";
    }
    html += "</table></div>";
    return html;
  }

  function barraFiltros(opciones) {
    const o = opciones || {};
    const f = filtros;
    let html = '<form class="filtros" id="formFiltros">';
    html += '<div class="campo"><label for="fDesde">Desde</label>' +
      '<input type="date" id="fDesde" name="desde" value="' + esc(f.desde) + '"></div>';
    html += '<div class="campo"><label for="fHasta">Hasta</label>' +
      '<input type="date" id="fHasta" name="hasta" value="' + esc(f.hasta) + '"></div>';

    if (usuario.rol !== "proveedor" && o.proveedor !== false) {
      html += '<div class="campo"><label for="fProv">Proveedor</label><select id="fProv" name="proveedorId"><option value="">Todos</option>';
      DB.all("proveedores").forEach(function (p) {
        html += '<option value="' + esc(p.id) + '"' + (f.proveedorId === p.id ? " selected" : "") +
          ">" + esc(p.nombre) + "</option>";
      });
      html += "</select></div>";
    }

    html += '<div class="campo"><label for="fFruta">Fruta</label><select id="fFruta" name="frutaId"><option value="">Todas</option>';
    DB.all("frutas").forEach(function (fr) {
      html += '<option value="' + esc(fr.id) + '"' + (f.frutaId === fr.id ? " selected" : "") +
        ">" + esc(fr.nombre) + "</option>";
    });
    html += "</select></div>";

    if (o.calidad) {
      html += '<div class="campo"><label for="fCal">Calidad</label><select id="fCal" name="calidad"><option value="">Todas</option>';
      DB.CALIDADES.forEach(function (c) {
        html += '<option value="' + esc(c.id) + '"' + (f.calidad === c.id ? " selected" : "") +
          ">" + esc(c.nombre) + "</option>";
      });
      html += "</select></div>";
    }

    html += '<div class="campo campo-acciones">' +
      '<button type="submit" class="btn btn-sec">Aplicar</button>' +
      '<button type="button" class="btn btn-plano" id="btnLimpiar">Limpiar</button></div>';
    html += "</form>";
    html += '<div class="atajos"><span>Rango rápido:</span>' +
      '<button type="button" class="chip" data-rango="7">7 días</button>' +
      '<button type="button" class="chip" data-rango="30">30 días</button>' +
      '<button type="button" class="chip" data-rango="90">90 días</button>' +
      '<button type="button" class="chip" data-rango="365">12 meses</button></div>';
    return html;
  }

  /* ============================== formularios ========================== */

  let cerrarModalActual = null;

  function abrirFormulario(titulo, campos, onSubmit, opciones) {
    const o = opciones || {};
    const capa = document.createElement("div");
    capa.className = "modal-capa";
    capa.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitulo">' +
      '<header class="modal-cab"><h2 id="modalTitulo">' + esc(titulo) + "</h2>" +
      '<button type="button" class="modal-x" aria-label="Cerrar">&times;</button></header>' +
      '<form class="modal-cuerpo" novalidate>' +
      (o.nota ? '<p class="modal-nota">' + esc(o.nota) + "</p>" : "") +
      campos.map(campoHTML).join("") +
      '<p class="form-error" id="formError" role="alert" hidden></p>' +
      '<footer class="modal-pie">' +
      '<button type="button" class="btn btn-plano" data-cancelar>Cancelar</button>' +
      '<button type="submit" class="btn btn-primario">' + esc(o.aceptar || "Guardar") + "</button>" +
      "</footer></form></div>";

    document.body.appendChild(capa);
    document.body.classList.add("sin-scroll");

    const form = $("form", capa);
    const error = $("#formError", capa);

    function cerrar() {
      capa.remove();
      document.body.classList.remove("sin-scroll");
      document.removeEventListener("keydown", onEsc);
      cerrarModalActual = null;
    }
    function onEsc(e) { if (e.key === "Escape") cerrar(); }

    cerrarModalActual = cerrar;
    document.addEventListener("keydown", onEsc);
    $(".modal-x", capa).addEventListener("click", cerrar);
    $("[data-cancelar]", capa).addEventListener("click", cerrar);
    capa.addEventListener("mousedown", function (e) { if (e.target === capa) cerrar(); });

    /* Recalcula los campos derivados (p. ej. rendimiento) al escribir. */
    if (o.alCambiar) {
      form.addEventListener("input", function () { o.alCambiar(leer(form, campos), form); });
      o.alCambiar(leer(form, campos), form);
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const datos = leer(form, campos);
      const problema = validar(campos, datos);
      if (problema) {
        error.textContent = problema;
        error.hidden = false;
        return;
      }
      error.hidden = true;
      const resultado = onSubmit(datos);
      if (resultado && resultado.error) {
        error.textContent = resultado.error;
        error.hidden = false;
        return;
      }
      cerrar();
    });

    const primero = $("input:not([readonly]), select, textarea", form);
    if (primero) primero.focus();
  }

  function campoHTML(c) {
    if (c.tipo === "separador") return '<h3 class="form-sep">' + esc(c.etiqueta) + "</h3>";
    if (c.tipo === "calculado") {
      return '<div class="campo campo-' + (c.ancho || "full") + ' campo-calculado">' +
        "<label>" + esc(c.etiqueta) + '</label><output id="' + esc(c.nombre) + '">—</output>' +
        (c.ayuda ? '<small class="ayuda">' + esc(c.ayuda) + "</small>" : "") + "</div>";
    }

    let control = "";
    const id = "campo_" + c.nombre;
    const base = 'id="' + id + '" name="' + esc(c.nombre) + '"' +
      (c.soloLectura ? " readonly" : "") + (c.requerido ? " required" : "");

    if (c.tipo === "select") {
      control = "<select " + base + (c.soloLectura ? " disabled" : "") + ">";
      if (c.vacio) control += '<option value="">' + esc(c.vacio) + "</option>";
      (c.opciones || []).forEach(function (op) {
        control += '<option value="' + esc(op.valor) + '"' +
          (String(c.valor) === String(op.valor) ? " selected" : "") + ">" + esc(op.texto) + "</option>";
      });
      control += "</select>";
      if (c.soloLectura) {
        control += '<input type="hidden" name="' + esc(c.nombre) + '" value="' + esc(c.valor || "") + '">';
      }
    } else if (c.tipo === "textarea") {
      control = "<textarea " + base + ' rows="3">' + esc(c.valor || "") + "</textarea>";
    } else if (c.tipo === "checkbox") {
      control = '<label class="check"><input type="checkbox" ' + base +
        (c.valor ? " checked" : "") + "> " + esc(c.textoCheck || "") + "</label>";
    } else {
      control = '<input type="' + (c.tipo || "text") + '" ' + base +
        ' value="' + esc(c.valor === undefined || c.valor === null ? "" : c.valor) + '"' +
        (c.min !== undefined ? ' min="' + c.min + '"' : "") +
        (c.max !== undefined ? ' max="' + c.max + '"' : "") +
        (c.paso !== undefined ? ' step="' + c.paso + '"' : "") +
        (c.marcador ? ' placeholder="' + esc(c.marcador) + '"' : "") + ">";
    }

    return '<div class="campo campo-' + (c.ancho || "full") + '">' +
      (c.tipo === "checkbox" ? "" : '<label for="' + id + '">' + esc(c.etiqueta) +
        (c.requerido ? ' <span class="req" aria-hidden="true">*</span>' : "") + "</label>") +
      control +
      (c.ayuda ? '<small class="ayuda">' + esc(c.ayuda) + "</small>" : "") + "</div>";
  }

  function leer(form, campos) {
    const datos = {};
    campos.forEach(function (c) {
      if (c.tipo === "separador" || c.tipo === "calculado") return;
      const el = form.elements[c.nombre];
      if (!el) return;
      const nodo = el.length && !el.tagName ? el[el.length - 1] : el;
      if (c.tipo === "checkbox") datos[c.nombre] = nodo.checked;
      else if (c.tipo === "number") datos[c.nombre] = nodo.value === "" ? "" : Number(nodo.value);
      else datos[c.nombre] = String(nodo.value).trim();
    });
    return datos;
  }

  function validar(campos, datos) {
    for (let i = 0; i < campos.length; i += 1) {
      const c = campos[i];
      if (c.tipo === "separador" || c.tipo === "calculado") continue;
      const v = datos[c.nombre];
      if (c.requerido && (v === "" || v === null || v === undefined)) {
        return "El campo «" + c.etiqueta + "» es obligatorio.";
      }
      if (c.tipo === "number" && v !== "") {
        if (c.min !== undefined && v < c.min) return "«" + c.etiqueta + "» no puede ser menor que " + c.min + ".";
        if (c.max !== undefined && v > c.max) return "«" + c.etiqueta + "» no puede ser mayor que " + c.max + ".";
      }
      if (c.validar) {
        const err = c.validar(v, datos);
        if (err) return err;
      }
    }
    return null;
  }

  function opcionesFrutas() {
    return DB.all("frutas").map(function (f) { return { valor: f.id, texto: f.nombre }; });
  }

  function opcionesProveedores(soloActivos) {
    return DB.all("proveedores")
      .filter(function (p) { return !soloActivos || p.activo; })
      .map(function (p) { return { valor: p.id, texto: p.nombre }; });
  }

  /* ============================== exportación ========================== */

  function descargarCSV(nombre, columnas, filas) {
    const sep = ";";                       // Excel en español separa con ";"
    const lineas = [columnas.map(function (c) { return c.titulo; }).join(sep)];
    filas.forEach(function (f) {
      lineas.push(columnas.map(function (c) {
        const v = c.csv ? c.csv(f) : "";
        const s = String(v === null || v === undefined ? "" : v);
        return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(sep));
    });
    const blob = new Blob(["﻿" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombre + "_" + DB.hoy() + ".csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    aviso("Archivo CSV generado.");
  }

  function descargarJSON(nombre, texto) {
    const blob = new Blob([texto], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombre + "_" + DB.hoy() + ".json";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  window.AppExport = { descargarCSV: descargarCSV };

  /* ================================ vistas ============================= */

  /* ---------------------------------------------------------- dashboard */

  function vistaDashboard() {
    const f = filtrosEfectivos();
    const k = Indicadores.calcular(f);
    const dias = Math.round((new Date(f.hasta) - new Date(f.desde)) / 86400000);
    const gran = dias > 120 ? "mes" : "dia";

    let html = '<div class="vista-cab"><div><h1>Panel de indicadores</h1>' +
      '<p class="sub">Del ' + fechaLarga(f.desde) + " al " + fechaLarga(f.hasta) +
      (usuario.rol === "proveedor" ? " · " + esc(Indicadores.nombreProveedor(usuario.proveedorId)) : "") +
      "</p></div>" +
      '<button class="btn btn-plano" id="btnImprimir">Imprimir panel</button></div>';

    html += barraFiltros({ calidad: true });

    html += '<section class="kpis">';
    html += tarjetaKPI("Fruta recibida", nf(k.kgRecibidos) + " kg",
      k.numRecepciones + " recepciones de " + k.proveedoresActivos + " proveedores", "verde");
    html += tarjetaKPI("Fruta procesada", nf(k.kgProcesados) + " kg",
      pct(k.tasaProcesamiento) + " de lo recibido", "azul");
    html += tarjetaKPI("Producto terminado", nf(k.kgProductoFinal) + " kg",
      k.numProducciones + " lotes procesados", "verde");
    html += tarjetaKPI("Rendimiento", pct(k.rendimiento),
      "Meta " + pct(k.metaRendimiento) + " · cumplimiento " + pct(k.cumplimientoMeta),
      k.cumplimientoMeta >= 1 ? "verde" : k.cumplimientoMeta >= 0.9 ? "ambar" : "rojo");
    html += tarjetaKPI("Merma", pct(k.merma), nf(k.kgMerma) + " kg perdidos en proceso",
      k.merma > 0.45 ? "rojo" : "ambar");
    html += tarjetaKPI("Valor de compra", money(k.valorCompra),
      "Costo por kg terminado: " + money(k.costoPorKgFinal), "neutro");
    html += tarjetaKPI("Productividad", nf(k.productividad, 1) + " kg/HH",
      nf(k.horasHombre, 1) + " horas-hombre", "azul");
    html += tarjetaKPI("Pendiente de procesar", nf(k.kgSinProcesar) + " kg",
      k.numPendientes + " recepciones sin confirmar",
      k.numPendientes > 0 ? "ambar" : "neutro");
    html += "</section>";

    html += '<section class="panel"><h2>Cumplimiento del rendimiento</h2>' +
      Graficos.medidor(k.rendimiento, k.metaRendimiento, "Rendimiento real vs. meta del período") +
      "</section>";

    html += '<div class="grid-2">';
    html += '<section class="panel"><h2>Tendencia de recepción y proceso</h2>' +
      Graficos.lineas(Indicadores.serie(f, gran), { titulo: "Tendencia de kilogramos" }) + "</section>";
    html += '<section class="panel"><h2>Distribución por calidad</h2>' +
      Graficos.dona(Indicadores.porCalidad(f), { titulo: "Kilogramos por calidad" }) + "</section>";
    html += "</div>";

    html += '<div class="grid-2">';
    if (usuario.rol !== "proveedor") {
      html += '<section class="panel"><h2>Proveedores por volumen</h2>' +
        Graficos.barras(Indicadores.porProveedor(f), { campo: "kgRecibidos", sufijo: " kg" }) +
        "</section>";
    }
    html += '<section class="panel"><h2>Volumen por fruta</h2>' +
      Graficos.barras(Indicadores.porFruta(f), { campo: "kgRecibidos", sufijo: " kg", color: Graficos.PALETA[2] }) +
      "</section>";
    html += "</div>";

    return html;
  }

  /* -------------------------------------------------------- recepciones */

  function vistaRecepciones() {
    const f = filtrosEfectivos();
    const lista = Indicadores.filtrar(f).recepciones.slice().sort(function (a, b) {
      return a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0;
    });

    const esProveedor = usuario.rol === "proveedor";
    let html = '<div class="vista-cab"><div><h1>' +
      (esProveedor ? "Mis envíos de fruta" : "Recepción de fruta") + "</h1>" +
      '<p class="sub">Registro de la materia prima que entra a la planta.</p></div>' +
      '<div class="cab-acciones">';
    if (puede("crear_recepcion") || usuario.rol === "admin") {
      html += '<button class="btn btn-primario" id="btnNuevaRecepcion">+ Registrar envío</button>';
    }
    html += '<button class="btn btn-plano" id="btnCsvRecepciones">Exportar CSV</button>';
    html += "</div></div>";

    html += barraFiltros({ calidad: true });

    const total = lista.reduce(function (a, r) { return a + r.cantidadKg; }, 0);
    const valor = lista.reduce(function (a, r) { return a + r.cantidadKg * r.precioUnitario; }, 0);
    html += '<p class="resumen-linea"><strong>' + nf(lista.length) + "</strong> registros · " +
      "<strong>" + nf(total) + "</strong> kg · <strong>" + money(valor) + "</strong> en compras</p>";

    const columnas = columnasRecepcion(esProveedor);
    html += tabla(columnas, lista, {
      vacio: "Aún no hay envíos registrados en este período.",
      pie: { cantidadKg: "<strong>" + nf(total) + "</strong>", folio: "<strong>Total</strong>" }
    });

    return html;
  }

  function columnasRecepcion(esProveedor) {
    const cols = [
      { clave: "folio", titulo: "Folio", valor: function (r) { return "<code>" + esc(r.folio) + "</code>"; }, csv: function (r) { return r.folio; } },
      { clave: "fecha", titulo: "Fecha", valor: function (r) { return fechaLarga(r.fecha); }, csv: function (r) { return r.fecha; } }
    ];
    if (!esProveedor) {
      cols.push({
        clave: "proveedor", titulo: "Proveedor",
        valor: function (r) { return esc(Indicadores.nombreProveedor(r.proveedorId)); },
        csv: function (r) { return Indicadores.nombreProveedor(r.proveedorId); }
      });
    }
    cols.push(
      { clave: "fruta", titulo: "Fruta", valor: function (r) { return esc(Indicadores.nombreFruta(r.frutaId)); }, csv: function (r) { return Indicadores.nombreFruta(r.frutaId); } },
      { clave: "lote", titulo: "Lote", valor: function (r) { return "<code>" + esc(r.lote) + "</code>"; }, csv: function (r) { return r.lote; } },
      { clave: "cantidadKg", titulo: "Kg", num: true, valor: function (r) { return nf(r.cantidadKg); }, csv: function (r) { return r.cantidadKg; } },
      { clave: "calidad", titulo: "Calidad", valor: function (r) { return '<span class="etq etq-' + esc(r.calidad) + '">' + esc(r.calidad) + "</span>"; }, csv: function (r) { return r.calidad; } },
      { clave: "precioUnitario", titulo: "Precio/kg", num: true, valor: function (r) { return money(r.precioUnitario); }, csv: function (r) { return r.precioUnitario; } },
      { clave: "subtotal", titulo: "Subtotal", num: true, valor: function (r) { return money(r.cantidadKg * r.precioUnitario); }, csv: function (r) { return (r.cantidadKg * r.precioUnitario).toFixed(2); } },
      { clave: "estado", titulo: "Estado", valor: function (r) { return '<span class="estado estado-' + esc(r.estado.toLowerCase()) + '">' + esc(r.estado) + "</span>"; }, csv: function (r) { return r.estado; } },
      {
        clave: "acciones", titulo: "", valor: function (r) {
          let b = "";
          if (r.estado === "Pendiente" && (puede("confirmar_recepcion") || usuario.rol === "admin")) {
            b += '<button class="btn-mini" data-confirmar="' + esc(r.id) + '">Confirmar</button>';
          }
          if (usuario.rol === "admin") {
            b += '<button class="btn-mini btn-mini-peligro" data-borrar-rec="' + esc(r.id) + '">Eliminar</button>';
          }
          return b || "—";
        }, csv: function () { return ""; }
      }
    );
    return cols;
  }

  function formRecepcion() {
    const esProveedor = usuario.rol === "proveedor";
    const campos = [
      { nombre: "fecha", etiqueta: "Fecha del envío", tipo: "date", valor: DB.hoy(), requerido: true, ancho: "mitad",
        validar: function (v) { return v > DB.hoy() ? "La fecha no puede ser futura." : null; } },
      { nombre: "proveedorId", etiqueta: "Proveedor", tipo: "select", requerido: true, ancho: "mitad",
        vacio: esProveedor ? null : "Seleccione…",
        opciones: esProveedor
          ? [{ valor: usuario.proveedorId, texto: Indicadores.nombreProveedor(usuario.proveedorId) }]
          : opcionesProveedores(true),
        valor: esProveedor ? usuario.proveedorId : "",
        soloLectura: esProveedor },
      { nombre: "frutaId", etiqueta: "Producto / fruta", tipo: "select", requerido: true, ancho: "mitad",
        vacio: "Seleccione…", opciones: opcionesFrutas() },
      { nombre: "cantidadKg", etiqueta: "Cantidad enviada (kg)", tipo: "number", requerido: true,
        min: 1, max: 100000, paso: "0.1", ancho: "mitad",
        ayuda: "Peso neto declarado en la guía de remisión." },
      { nombre: "calidad", etiqueta: "Calidad", tipo: "select", requerido: true, ancho: "mitad",
        opciones: DB.CALIDADES.map(function (c) { return { valor: c.id, texto: c.nombre }; }), valor: "A" },
      { nombre: "precioUnitario", etiqueta: "Precio acordado por kg ($)", tipo: "number", requerido: true,
        min: 0, max: 100, paso: "0.01", ancho: "mitad" },
      { nombre: "transporte", etiqueta: "Transporte", tipo: "select", ancho: "mitad",
        opciones: [{ valor: "Propio", texto: "Propio" }, { valor: "Contratado", texto: "Contratado" }] },
      { nombre: "subtotalCalc", etiqueta: "Valor del envío", tipo: "calculado", ancho: "mitad",
        ayuda: "Cantidad × precio acordado." },
      { nombre: "observaciones", etiqueta: "Observaciones", tipo: "textarea",
        marcador: "Condición de la fruta, incidencias en el transporte, etc." }
    ];

    abrirFormulario("Registrar envío de fruta", campos, function (d) {
      const registro = {
        folio: DB.siguienteFolio("recepciones", "REC"),
        fecha: d.fecha,
        proveedorId: d.proveedorId,
        frutaId: d.frutaId,
        lote: "L" + d.fecha.replace(/-/g, "").slice(2) + "-" +
          String(DB.all("recepciones").length + 1).padStart(3, "0"),
        cantidadKg: Number(d.cantidadKg),
        calidad: d.calidad,
        precioUnitario: Number(d.precioUnitario),
        transporte: d.transporte || "Propio",
        estado: "Pendiente",
        observaciones: d.observaciones || "",
        registradoPor: usuario.id,
        creadoEn: new Date().toISOString()
      };
      DB.insert("recepciones", registro);
      DB.registrarBitacora(usuario.id, "Registro de envío",
        registro.folio + " · " + nf(registro.cantidadKg) + " kg de " +
        Indicadores.nombreFruta(registro.frutaId));
      aviso("Envío " + registro.folio + " registrado. Queda pendiente de confirmación en planta.");
      render();
    }, {
      aceptar: "Registrar envío",
      nota: "El envío se registra como «Pendiente» hasta que el salón de producción confirme la recepción física.",
      alCambiar: function (d, form) {
        const out = $("#subtotalCalc", form);
        if (!out) return;
        const total = (Number(d.cantidadKg) || 0) * (Number(d.precioUnitario) || 0);
        out.textContent = total > 0 ? money(total) : "—";
      }
    });
  }

  /* ---------------------------------------------------------- producción */

  function vistaProduccion() {
    const f = filtrosEfectivos();
    const lista = Indicadores.filtrar(f).producciones.slice().sort(function (a, b) {
      return a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0;
    });

    let html = '<div class="vista-cab"><div><h1>Producción</h1>' +
      '<p class="sub">Lo que el salón de producción procesa a partir de cada lote recibido.</p></div>' +
      '<div class="cab-acciones">';
    if (puede("crear_produccion") || usuario.rol === "admin") {
      html += '<button class="btn btn-primario" id="btnNuevaProduccion">+ Registrar producción</button>';
    }
    html += '<button class="btn btn-plano" id="btnCsvProduccion">Exportar CSV</button></div></div>';

    html += barraFiltros({});

    const proc = lista.reduce(function (a, p) { return a + p.kgProcesados; }, 0);
    const fin = lista.reduce(function (a, p) { return a + p.kgProductoFinal; }, 0);
    html += '<p class="resumen-linea"><strong>' + nf(lista.length) + "</strong> lotes · " +
      "<strong>" + nf(proc) + "</strong> kg procesados · <strong>" + nf(fin) +
      "</strong> kg terminados · rendimiento <strong>" +
      pct(proc > 0 ? fin / proc : 0) + "</strong></p>";

    html += tabla(columnasProduccion(), lista, {
      vacio: "No hay producción registrada en este período."
    });

    return html;
  }

  function columnasProduccion() {
    return [
      { clave: "folio", titulo: "Folio", valor: function (p) { return "<code>" + esc(p.folio) + "</code>"; }, csv: function (p) { return p.folio; } },
      { clave: "fecha", titulo: "Fecha", valor: function (p) { return fechaLarga(p.fecha); }, csv: function (p) { return p.fecha; } },
      { clave: "lote", titulo: "Lote origen", valor: function (p) { return "<code>" + esc(p.lote) + "</code>"; }, csv: function (p) { return p.lote; } },
      { clave: "fruta", titulo: "Fruta", valor: function (p) { return esc(Indicadores.nombreFruta(p.frutaId)); }, csv: function (p) { return Indicadores.nombreFruta(p.frutaId); } },
      { clave: "producto", titulo: "Producto", valor: function (p) { return esc(Indicadores.nombreProducto(p.productoId)); }, csv: function (p) { return Indicadores.nombreProducto(p.productoId); } },
      { clave: "turno", titulo: "Turno", valor: function (p) { return esc(p.turno); }, csv: function (p) { return p.turno; } },
      { clave: "kgProcesados", titulo: "Kg procesados", num: true, valor: function (p) { return nf(p.kgProcesados); }, csv: function (p) { return p.kgProcesados; } },
      { clave: "kgProductoFinal", titulo: "Kg terminados", num: true, valor: function (p) { return nf(p.kgProductoFinal); }, csv: function (p) { return p.kgProductoFinal; } },
      {
        clave: "rendimiento", titulo: "Rendimiento", num: true,
        valor: function (p) {
          const r = p.kgProcesados > 0 ? p.kgProductoFinal / p.kgProcesados : 0;
          const fruta = DB.get("frutas", p.frutaId);
          const meta = fruta ? fruta.rendimientoMeta : 0.6;
          return '<span class="etq ' + (r >= meta ? "etq-ok" : "etq-bajo") + '">' + pct(r) + "</span>";
        },
        csv: function (p) { return p.kgProcesados > 0 ? (p.kgProductoFinal / p.kgProcesados).toFixed(4) : 0; }
      },
      { clave: "merma", titulo: "Merma kg", num: true, valor: function (p) { return nf(p.kgProcesados - p.kgProductoFinal); }, csv: function (p) { return p.kgProcesados - p.kgProductoFinal; } },
      { clave: "operador", titulo: "Operador", valor: function (p) { return esc(p.operador); }, csv: function (p) { return p.operador; } },
      {
        clave: "acciones", titulo: "", valor: function (p) {
          return usuario.rol === "admin"
            ? '<button class="btn-mini btn-mini-peligro" data-borrar-prod="' + esc(p.id) + '">Eliminar</button>'
            : "—";
        }, csv: function () { return ""; }
      }
    ];
  }

  function formProduccion() {
    /* Solo se puede procesar un lote recibido que no tenga producción previa. */
    const yaProcesados = {};
    DB.all("producciones").forEach(function (p) { yaProcesados[p.recepcionId] = true; });
    const disponibles = DB.all("recepciones").filter(function (r) {
      return r.estado === "Recibido" && !yaProcesados[r.id];
    }).sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });

    if (!disponibles.length) {
      aviso("No hay lotes recibidos pendientes de procesar. Confirme primero una recepción.", "alerta");
      return;
    }

    const campos = [
      { nombre: "recepcionId", etiqueta: "Lote a procesar", tipo: "select", requerido: true, vacio: "Seleccione…",
        opciones: disponibles.map(function (r) {
          return {
            valor: r.id,
            texto: r.lote + " · " + Indicadores.nombreFruta(r.frutaId) + " · " +
              nf(r.cantidadKg) + " kg · " + Indicadores.nombreProveedor(r.proveedorId)
          };
        }),
        ayuda: "Solo aparecen las recepciones confirmadas que aún no se han procesado." },
      { nombre: "fecha", etiqueta: "Fecha de proceso", tipo: "date", valor: DB.hoy(), requerido: true, ancho: "mitad",
        validar: function (v) { return v > DB.hoy() ? "La fecha no puede ser futura." : null; } },
      { nombre: "turno", etiqueta: "Turno", tipo: "select", ancho: "mitad", valor: "Matutino",
        opciones: [{ valor: "Matutino", texto: "Matutino" }, { valor: "Vespertino", texto: "Vespertino" },
          { valor: "Nocturno", texto: "Nocturno" }] },
      { nombre: "productoId", etiqueta: "Producto obtenido", tipo: "select", requerido: true, ancho: "mitad",
        vacio: "Seleccione…",
        opciones: DB.all("productos").map(function (p) { return { valor: p.id, texto: p.nombre }; }) },
      { nombre: "operador", etiqueta: "Responsable de línea", tipo: "text", requerido: true, ancho: "mitad",
        valor: usuario.nombre },
      { nombre: "kgProcesados", etiqueta: "Kg ingresados a proceso", tipo: "number", requerido: true,
        min: 1, paso: "0.1", ancho: "mitad",
        validar: function (v, d) {
          const rec = DB.get("recepciones", d.recepcionId);
          if (rec && v > rec.cantidadKg) {
            return "No puede procesar más de los " + nf(rec.cantidadKg) + " kg que ingresaron en el lote.";
          }
          return null;
        } },
      { nombre: "kgProductoFinal", etiqueta: "Kg de producto terminado", tipo: "number", requerido: true,
        min: 0, paso: "0.1", ancho: "mitad",
        validar: function (v, d) {
          if (Number(d.kgProcesados) && v > Number(d.kgProcesados)) {
            return "El producto terminado no puede superar los kilogramos ingresados a proceso.";
          }
          return null;
        } },
      { nombre: "horasHombre", etiqueta: "Horas-hombre empleadas", tipo: "number", min: 0, paso: "0.5", ancho: "mitad" },
      { nombre: "rendimientoCalc", etiqueta: "Rendimiento del lote", tipo: "calculado", ancho: "mitad",
        ayuda: "Producto terminado ÷ kilogramos procesados, comparado con la meta de la fruta." },
      { nombre: "observaciones", etiqueta: "Observaciones", tipo: "textarea",
        marcador: "Paradas de línea, fruta descartada, novedades del turno." }
    ];

    abrirFormulario("Registrar producción del lote", campos, function (d) {
      const rec = DB.get("recepciones", d.recepcionId);
      if (!rec) return { error: "El lote seleccionado ya no está disponible." };

      const registro = {
        folio: DB.siguienteFolio("producciones", "PRD"),
        fecha: d.fecha,
        recepcionId: rec.id,
        lote: rec.lote,
        frutaId: rec.frutaId,
        productoId: d.productoId,
        turno: d.turno,
        kgProcesados: Number(d.kgProcesados),
        kgProductoFinal: Number(d.kgProductoFinal),
        horasHombre: Number(d.horasHombre) || 0,
        operador: d.operador,
        observaciones: d.observaciones || "",
        registradoPor: usuario.id,
        creadoEn: new Date().toISOString()
      };
      DB.insert("producciones", registro);
      DB.registrarBitacora(usuario.id, "Registro de producción",
        registro.folio + " · lote " + registro.lote + " · rendimiento " +
        pct(registro.kgProcesados > 0 ? registro.kgProductoFinal / registro.kgProcesados : 0));
      aviso("Producción " + registro.folio + " registrada.");
      render();
    }, {
      aceptar: "Registrar producción",
      alCambiar: function (d, form) {
        const out = $("#rendimientoCalc", form);
        if (!out) return;
        const proc = Number(d.kgProcesados) || 0;
        const fin = Number(d.kgProductoFinal) || 0;
        if (proc <= 0 || fin <= 0) { out.textContent = "—"; out.className = ""; return; }
        const r = fin / proc;
        const rec = DB.get("recepciones", d.recepcionId);
        const fruta = rec ? DB.get("frutas", rec.frutaId) : null;
        const meta = fruta ? fruta.rendimientoMeta : 0.6;
        out.textContent = pct(r) + " (meta " + pct(meta) + ")";
        out.className = r >= meta ? "ok" : "bajo";
      }
    });
  }

  /* --------------------------------------------------------- proveedores */

  function vistaProveedores() {
    const lista = DB.all("proveedores");
    const resumen = {};
    Indicadores.porProveedor({ desde: "0000-01-01", hasta: "9999-12-31" }).forEach(function (m) {
      resumen[m.proveedorId] = m;
    });

    let html = '<div class="vista-cab"><div><h1>Proveedores</h1>' +
      '<p class="sub">Padrón único de proveedores de fruta.</p></div>' +
      '<div class="cab-acciones">' +
      '<button class="btn btn-primario" id="btnNuevoProveedor">+ Nuevo proveedor</button>' +
      '<button class="btn btn-plano" id="btnCsvProveedores">Exportar CSV</button></div></div>';

    const columnas = [
      { clave: "codigo", titulo: "Código", valor: function (p) { return "<code>" + esc(p.codigo) + "</code>"; }, csv: function (p) { return p.codigo; } },
      { clave: "nombre", titulo: "Proveedor", valor: function (p) { return "<strong>" + esc(p.nombre) + "</strong>"; }, csv: function (p) { return p.nombre; } },
      { clave: "documento", titulo: "RUC / Documento", valor: function (p) { return esc(p.documento); }, csv: function (p) { return p.documento; } },
      { clave: "contacto", titulo: "Contacto", valor: function (p) { return esc(p.contacto) + '<br><small class="tenue">' + esc(p.telefono) + "</small>"; }, csv: function (p) { return p.contacto + " / " + p.telefono; } },
      { clave: "zona", titulo: "Zona", valor: function (p) { return esc(p.zona); }, csv: function (p) { return p.zona; } },
      { clave: "kg", titulo: "Kg históricos", num: true, valor: function (p) { return nf(resumen[p.id] ? resumen[p.id].kgRecibidos : 0); }, csv: function (p) { return resumen[p.id] ? resumen[p.id].kgRecibidos : 0; } },
      { clave: "envios", titulo: "Envíos", num: true, valor: function (p) { return nf(resumen[p.id] ? resumen[p.id].envios : 0); }, csv: function (p) { return resumen[p.id] ? resumen[p.id].envios : 0; } },
      { clave: "activo", titulo: "Estado", valor: function (p) { return '<span class="estado estado-' + (p.activo ? "recibido" : "inactivo") + '">' + (p.activo ? "Activo" : "Inactivo") + "</span>"; }, csv: function (p) { return p.activo ? "Activo" : "Inactivo"; } },
      {
        clave: "acciones", titulo: "", valor: function (p) {
          return '<button class="btn-mini" data-editar-prov="' + esc(p.id) + '">Editar</button>' +
            '<button class="btn-mini" data-toggle-prov="' + esc(p.id) + '">' +
            (p.activo ? "Desactivar" : "Activar") + "</button>";
        }, csv: function () { return ""; }
      }
    ];

    html += tabla(columnas, lista, { vacio: "No hay proveedores registrados." });
    return html;
  }

  function formProveedor(id) {
    const p = id ? DB.get("proveedores", id) : null;
    const campos = [
      { nombre: "nombre", etiqueta: "Razón social / nombre", tipo: "text", requerido: true, valor: p ? p.nombre : "" },
      { nombre: "documento", etiqueta: "RUC / documento", tipo: "text", requerido: true, ancho: "mitad", valor: p ? p.documento : "",
        validar: function (v) { return /^[0-9-]{8,15}$/.test(v) ? null : "Ingrese un documento válido (8 a 15 dígitos)."; } },
      { nombre: "zona", etiqueta: "Zona / provincia", tipo: "text", requerido: true, ancho: "mitad", valor: p ? p.zona : "" },
      { nombre: "contacto", etiqueta: "Persona de contacto", tipo: "text", requerido: true, ancho: "mitad", valor: p ? p.contacto : "" },
      { nombre: "telefono", etiqueta: "Teléfono", tipo: "tel", requerido: true, ancho: "mitad", valor: p ? p.telefono : "",
        validar: function (v) { return /^[0-9+\s-]{7,15}$/.test(v) ? null : "Ingrese un teléfono válido."; } },
      { nombre: "email", etiqueta: "Correo electrónico", tipo: "email", ancho: "mitad", valor: p ? p.email : "",
        validar: function (v) { return !v || /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v) ? null : "El correo no tiene un formato válido."; } },
      { nombre: "activo", etiqueta: "", tipo: "checkbox", textoCheck: "Proveedor activo", valor: p ? p.activo : true }
    ];

    abrirFormulario(p ? "Editar proveedor" : "Nuevo proveedor", campos, function (d) {
      if (p) {
        DB.update("proveedores", p.id, d);
        DB.registrarBitacora(usuario.id, "Edición de proveedor", d.nombre);
        aviso("Proveedor actualizado.");
      } else {
        const n = DB.all("proveedores").length + 1;
        DB.insert("proveedores", Object.assign({
          codigo: "PRV-" + String(n).padStart(3, "0"),
          fechaAlta: DB.hoy()
        }, d));
        DB.registrarBitacora(usuario.id, "Alta de proveedor", d.nombre);
        aviso("Proveedor registrado.");
      }
      render();
    });
  }

  /* ------------------------------------------------------------ usuarios */

  function vistaUsuarios() {
    let html = '<div class="vista-cab"><div><h1>Usuarios</h1>' +
      '<p class="sub">Quién entra al sistema y qué puede hacer.</p></div>' +
      '<button class="btn btn-primario" id="btnNuevoUsuario">+ Nuevo usuario</button></div>';

    const columnas = [
      { clave: "nombre", titulo: "Nombre", valor: function (u) { return "<strong>" + esc(u.nombre) + "</strong>"; } },
      { clave: "usuario", titulo: "Usuario", valor: function (u) { return "<code>" + esc(u.usuario) + "</code>"; } },
      { clave: "rol", titulo: "Rol", valor: function (u) {
        const r = DB.ROLES.find(function (x) { return x.id === u.rol; });
        return '<span class="etq etq-rol">' + esc(r ? r.nombre : u.rol) + "</span>";
      } },
      { clave: "proveedor", titulo: "Proveedor asociado", valor: function (u) {
        return u.proveedorId ? esc(Indicadores.nombreProveedor(u.proveedorId)) : "—";
      } },
      { clave: "activo", titulo: "Estado", valor: function (u) {
        return '<span class="estado estado-' + (u.activo ? "recibido" : "inactivo") + '">' +
          (u.activo ? "Activo" : "Inactivo") + "</span>";
      } },
      { clave: "acciones", titulo: "", valor: function (u) {
        if (u.id === usuario.id) return '<span class="tenue">Sesión actual</span>';
        return '<button class="btn-mini" data-toggle-usr="' + esc(u.id) + '">' +
          (u.activo ? "Desactivar" : "Activar") + "</button>";
      } }
    ];

    html += tabla(columnas, DB.all("usuarios"), {});
    html += '<p class="nota-seguridad">⚠️ Prototipo académico: las contraseñas se guardan sin cifrar en el ' +
      'navegador. Antes de un uso real deben moverse a un servidor con hash (bcrypt/Argon2). ' +
      "Ver <code>app/README.md</code>.</p>";
    return html;
  }

  function formUsuario() {
    const campos = [
      { nombre: "nombre", etiqueta: "Nombre completo", tipo: "text", requerido: true },
      { nombre: "usuario", etiqueta: "Nombre de usuario", tipo: "text", requerido: true, ancho: "mitad",
        validar: function (v) {
          const existe = DB.all("usuarios").some(function (u) {
            return u.usuario.toLowerCase() === v.toLowerCase();
          });
          return existe ? "Ese nombre de usuario ya está en uso." : null;
        } },
      { nombre: "clave", etiqueta: "Contraseña", tipo: "text", requerido: true, ancho: "mitad",
        validar: function (v) { return v.length < 6 ? "La contraseña debe tener al menos 6 caracteres." : null; } },
      { nombre: "rol", etiqueta: "Rol", tipo: "select", requerido: true, ancho: "mitad", vacio: "Seleccione…",
        opciones: DB.ROLES.map(function (r) { return { valor: r.id, texto: r.nombre }; }) },
      { nombre: "proveedorId", etiqueta: "Proveedor asociado", tipo: "select", ancho: "mitad",
        vacio: "No aplica", opciones: opcionesProveedores(false),
        ayuda: "Obligatorio solo para el rol Proveedor: limita lo que ese usuario puede ver.",
        validar: function (v, d) {
          return d.rol === "proveedor" && !v ? "Un usuario con rol Proveedor debe estar asociado a un proveedor." : null;
        } }
    ];

    abrirFormulario("Nuevo usuario", campos, function (d) {
      DB.insert("usuarios", {
        nombre: d.nombre, usuario: d.usuario, clave: d.clave, rol: d.rol,
        proveedorId: d.proveedorId || null, activo: true
      });
      DB.registrarBitacora(usuario.id, "Alta de usuario", d.nombre + " (" + d.rol + ")");
      aviso("Usuario creado.");
      render();
    });
  }

  /* ------------------------------------------------------------ reportes */

  const REPORTES = {
    proveedor: {
      titulo: "Reporte consolidado por proveedor",
      descripcion: "Volumen entregado, calidad y rendimiento obtenido por cada proveedor. " +
        "Es el reporte que se entrega al proveedor para liquidar su pago.",
      datos: function (f) { return Indicadores.porProveedor(f); },
      columnas: [
        { clave: "nombre", titulo: "Proveedor", valor: function (m) { return "<strong>" + esc(m.nombre) + "</strong>"; }, csv: function (m) { return m.nombre; } },
        { clave: "envios", titulo: "Envíos", num: true, valor: function (m) { return nf(m.envios); }, csv: function (m) { return m.envios; } },
        { clave: "kgRecibidos", titulo: "Kg entregados", num: true, valor: function (m) { return nf(m.kgRecibidos); }, csv: function (m) { return m.kgRecibidos; } },
        { clave: "pctCalidadA", titulo: "% Calidad A", num: true, valor: function (m) { return pct(m.pctCalidadA); }, csv: function (m) { return (m.pctCalidadA * 100).toFixed(2); } },
        { clave: "precioPromedio", titulo: "Precio prom./kg", num: true, valor: function (m) { return money(m.precioPromedio); }, csv: function (m) { return m.precioPromedio.toFixed(4); } },
        { clave: "valor", titulo: "Valor a liquidar", num: true, valor: function (m) { return money(m.valor); }, csv: function (m) { return m.valor.toFixed(2); } },
        { clave: "kgProcesados", titulo: "Kg procesados", num: true, valor: function (m) { return nf(m.kgProcesados); }, csv: function (m) { return m.kgProcesados; } },
        { clave: "rendimiento", titulo: "Rendimiento", num: true, valor: function (m) { return pct(m.rendimiento); }, csv: function (m) { return (m.rendimiento * 100).toFixed(2); } }
      ]
    },
    fruta: {
      titulo: "Reporte de rendimiento por fruta",
      descripcion: "Compara el rendimiento real de cada fruta contra su meta técnica. " +
        "La brecha señala dónde se está perdiendo producto.",
      datos: function (f) { return Indicadores.porFruta(f); },
      columnas: [
        { clave: "nombre", titulo: "Fruta", valor: function (m) { return "<strong>" + esc(m.nombre) + "</strong>"; }, csv: function (m) { return m.nombre; } },
        { clave: "kgRecibidos", titulo: "Kg recibidos", num: true, valor: function (m) { return nf(m.kgRecibidos); }, csv: function (m) { return m.kgRecibidos; } },
        { clave: "kgProcesados", titulo: "Kg procesados", num: true, valor: function (m) { return nf(m.kgProcesados); }, csv: function (m) { return m.kgProcesados; } },
        { clave: "kgFinal", titulo: "Kg terminados", num: true, valor: function (m) { return nf(m.kgFinal); }, csv: function (m) { return m.kgFinal; } },
        { clave: "rendimiento", titulo: "Rendimiento real", num: true, valor: function (m) { return pct(m.rendimiento); }, csv: function (m) { return (m.rendimiento * 100).toFixed(2); } },
        { clave: "meta", titulo: "Meta", num: true, valor: function (m) { return pct(m.meta); }, csv: function (m) { return (m.meta * 100).toFixed(2); } },
        { clave: "brecha", titulo: "Brecha", num: true, valor: function (m) {
          return '<span class="etq ' + (m.brecha >= 0 ? "etq-ok" : "etq-bajo") + '">' +
            (m.brecha >= 0 ? "+" : "") + pct(m.brecha) + "</span>";
        }, csv: function (m) { return (m.brecha * 100).toFixed(2); } }
      ]
    },
    recepciones: {
      titulo: "Detalle de recepciones",
      descripcion: "Registro línea por línea de la fruta que ingresó a la planta.",
      datos: function (f) { return Indicadores.filtrar(f).recepciones; },
      columnas: null   // se arma con columnasRecepcion()
    },
    produccion: {
      titulo: "Detalle de producción",
      descripcion: "Registro línea por línea de cada lote procesado en el salón de producción.",
      datos: function (f) { return Indicadores.filtrar(f).producciones; },
      columnas: null
    }
  };

  let reporteActual = "proveedor";

  function columnasReporte(tipo) {
    if (tipo === "recepciones") {
      return columnasRecepcion(usuario.rol === "proveedor").filter(function (c) { return c.clave !== "acciones"; });
    }
    if (tipo === "produccion") {
      return columnasProduccion().filter(function (c) { return c.clave !== "acciones"; });
    }
    return REPORTES[tipo].columnas;
  }

  function vistaReportes() {
    const f = filtrosEfectivos();
    const def = REPORTES[reporteActual];
    const datos = def.datos(f);
    const columnas = columnasReporte(reporteActual);
    const k = Indicadores.calcular(f);

    let html = '<div class="vista-cab"><div><h1>Reportes</h1>' +
      '<p class="sub">Genere el consolidado, expórtelo a Excel o imprímalo en PDF.</p></div>' +
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

    html += barraFiltros({ calidad: reporteActual === "recepciones" });

    html += '<section class="hoja" id="hojaReporte">';
    html += '<header class="hoja-cab"><div><h2>' + esc(def.titulo) + "</h2>" +
      '<p class="sub">' + esc(def.descripcion) + "</p></div>" +
      '<div class="hoja-meta"><p><strong>Período:</strong> ' + fechaLarga(f.desde) + " — " + fechaLarga(f.hasta) + "</p>" +
      "<p><strong>Emitido:</strong> " + fechaLarga(DB.hoy()) + "</p>" +
      "<p><strong>Por:</strong> " + esc(usuario.nombre) + "</p></div></header>";

    html += '<div class="hoja-kpis">' +
      '<div><span>Kg recibidos</span><strong>' + nf(k.kgRecibidos) + "</strong></div>" +
      '<div><span>Kg procesados</span><strong>' + nf(k.kgProcesados) + "</strong></div>" +
      '<div><span>Kg terminados</span><strong>' + nf(k.kgProductoFinal) + "</strong></div>" +
      '<div><span>Rendimiento</span><strong>' + pct(k.rendimiento) + "</strong></div>" +
      '<div><span>Merma</span><strong>' + pct(k.merma) + "</strong></div>" +
      '<div><span>Valor compras</span><strong>' + money(k.valorCompra) + "</strong></div>" +
      "</div>";

    html += tabla(columnas, datos, { vacio: "No hay información para el filtro seleccionado." });
    html += '<footer class="hoja-pie"><p>Sistema de Registro y Control de Producción Frutícola · ' +
      "Documento generado automáticamente el " + fechaLarga(DB.hoy()) + ".</p></footer>";
    html += "</section>";

    return html;
  }

  /* ------------------------------------------------------------ bitácora */

  function vistaBitacora() {
    const lista = DB.all("bitacora");
    let html = '<div class="vista-cab"><div><h1>Bitácora del sistema</h1>' +
      '<p class="sub">Trazabilidad: quién registró qué y cuándo.</p></div></div>';

    const columnas = [
      { clave: "fecha", titulo: "Fecha y hora", valor: function (b) {
        return new Date(b.fecha).toLocaleString("es-EC");
      } },
      { clave: "usuario", titulo: "Usuario", valor: function (b) {
        const u = DB.get("usuarios", b.usuarioId);
        return esc(u ? u.nombre : "—");
      } },
      { clave: "accion", titulo: "Acción", valor: function (b) { return "<strong>" + esc(b.accion) + "</strong>"; } },
      { clave: "detalle", titulo: "Detalle", valor: function (b) { return esc(b.detalle); } }
    ];

    html += tabla(columnas, lista, { vacio: "Todavía no hay movimientos registrados en esta sesión." });
    return html;
  }

  /* --------------------------------------------------------------- datos */

  function vistaDatos() {
    const db = DB.load();
    let html = '<div class="vista-cab"><div><h1>Datos del sistema</h1>' +
      '<p class="sub">Respaldo, restauración y reinicio del repositorio de información.</p></div></div>';

    html += '<section class="panel"><h2>Contenido actual</h2><div class="conteos">';
    [["Proveedores", db.proveedores.length], ["Usuarios", db.usuarios.length],
      ["Frutas", db.frutas.length], ["Productos", db.productos.length],
      ["Recepciones", db.recepciones.length], ["Producciones", db.producciones.length],
      ["Movimientos en bitácora", db.bitacora.length]].forEach(function (c) {
      html += "<div><span>" + esc(c[0]) + "</span><strong>" + nf(c[1]) + "</strong></div>";
    });
    html += "</div></section>";

    html += '<section class="panel"><h2>Respaldo y restauración</h2>' +
      "<p>El repositorio completo se guarda como un único archivo JSON. Descárguelo para " +
      "respaldar los datos o para adjuntarlo como anexo de la tesis.</p>" +
      '<div class="acciones-fila">' +
      '<button class="btn btn-primario" id="btnExportarJSON">Descargar respaldo (JSON)</button>' +
      '<label class="btn btn-sec" for="inputImportar">Restaurar desde archivo</label>' +
      '<input type="file" id="inputImportar" accept="application/json" hidden>' +
      '<button class="btn btn-peligro" id="btnReiniciar">Reiniciar con datos de demostración</button>' +
      "</div></section>";

    html += '<section class="panel"><h2>Dónde se guardan los datos</h2>' +
      "<p>Esta versión almacena todo en el <code>localStorage</code> del navegador: los datos " +
      "persisten entre sesiones en este equipo, pero no se comparten entre computadoras. " +
      "Para el despliegue real en la empresa debe conectarse un backend; el procedimiento " +
      "está documentado en <code>app/README.md</code>.</p></section>";

    return html;
  }

  /* ============================== render ============================== */

  function vistaLogin() {
    return '<div class="login-capa"><div class="login-caja">' +
      '<div class="login-marca"><span class="logo">🍍</span>' +
      "<div><strong>AgroRegistro</strong><small>Sistema de registro y control de producción frutícola</small></div></div>" +
      '<form id="formLogin" novalidate>' +
      '<div class="campo"><label for="usuario">Usuario</label>' +
      '<input type="text" id="usuario" name="usuario" autocomplete="username" required></div>' +
      '<div class="campo"><label for="clave">Contraseña</label>' +
      '<input type="password" id="clave" name="clave" autocomplete="current-password" required></div>' +
      '<p class="form-error" id="loginError" role="alert" hidden></p>' +
      '<button type="submit" class="btn btn-primario btn-ancho">Entrar</button></form>' +
      '<div class="login-demo"><p>Cuentas de demostración:</p><ul>' +
      "<li><button type='button' class='demo' data-u='admin' data-c='admin123'>admin / admin123</button> — Administrador</li>" +
      "<li><button type='button' class='demo' data-u='proveedor' data-c='prov123'>proveedor / prov123</button> — Proveedor</li>" +
      "<li><button type='button' class='demo' data-u='produccion' data-c='prod123'>produccion / prod123</button> — Salón de producción</li>" +
      "</ul></div></div></div>";
  }

  function render() {
    const app = $("#app");

    if (!usuario) {
      app.innerHTML = vistaLogin();
      enlazarLogin();
      return;
    }

    const rol = DB.ROLES.find(function (r) { return r.id === usuario.rol; });
    let html = '<div class="capa">';

    html += '<aside class="lateral" id="lateral"><div class="marca"><span class="logo">🍍</span>' +
      "<div><strong>AgroRegistro</strong><small>Control de producción</small></div></div><nav>";
    menu().forEach(function (m) {
      html += '<button type="button" class="nav-item' + (m.id === vistaActual ? " activo" : "") +
        '" data-ir="' + m.id + '"' + (m.id === vistaActual ? ' aria-current="page"' : "") + ">" +
        '<span aria-hidden="true">' + m.icono + "</span>" + esc(m.texto) + "</button>";
    });
    html += "</nav><div class='lateral-pie'><p class='tenue'>v1.0 · prototipo de tesis</p></div></aside>";

    html += '<div class="principal">';
    html += '<header class="barra"><button class="menu-btn" id="btnMenu" aria-label="Abrir menú" aria-expanded="false">☰</button>' +
      '<div class="barra-usuario"><div class="avatar" aria-hidden="true">' +
      esc(usuario.nombre.charAt(0)) + "</div><div><strong>" + esc(usuario.nombre) + "</strong>" +
      "<small>" + esc(rol ? rol.nombre : usuario.rol) +
      (usuario.proveedorId ? " · " + esc(Indicadores.nombreProveedor(usuario.proveedorId)) : "") +
      "</small></div>" +
      '<button class="btn btn-plano" id="btnSalir">Salir</button></div></header>';

    html += '<main id="contenido" tabindex="-1">';
    if (vistaActual === "dashboard") html += vistaDashboard();
    else if (vistaActual === "recepciones") html += vistaRecepciones();
    else if (vistaActual === "produccion") html += vistaProduccion();
    else if (vistaActual === "proveedores") html += vistaProveedores();
    else if (vistaActual === "usuarios") html += vistaUsuarios();
    else if (vistaActual === "reportes") html += vistaReportes();
    else if (vistaActual === "bitacora") html += vistaBitacora();
    else if (vistaActual === "datos") html += vistaDatos();
    html += "</main></div></div>";

    app.innerHTML = html;
    enlazar();
  }

  /* ============================== eventos ============================= */

  function enlazarLogin() {
    const form = $("#formLogin");
    const error = $("#loginError");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const r = iniciarSesion(form.usuario.value, form.clave.value);
      if (!r.ok) {
        error.textContent = r.error;
        error.hidden = false;
        return;
      }
      render();
      aviso("Bienvenido, " + usuario.nombre + ".");
    });

    $$(".demo").forEach(function (b) {
      b.addEventListener("click", function () {
        form.usuario.value = b.dataset.u;
        form.clave.value = b.dataset.c;
        form.querySelector("button[type=submit]").focus();
      });
    });
  }

  function enlazar() {
    $$("[data-ir]").forEach(function (b) {
      b.addEventListener("click", function () {
        ir(b.dataset.ir);
        $("#lateral").classList.remove("abierto");
      });
    });

    const btnMenu = $("#btnMenu");
    if (btnMenu) {
      btnMenu.addEventListener("click", function () {
        const lat = $("#lateral");
        const abierto = lat.classList.toggle("abierto");
        btnMenu.setAttribute("aria-expanded", String(abierto));
      });
    }

    const btnSalir = $("#btnSalir");
    if (btnSalir) btnSalir.addEventListener("click", cerrarSesion);

    /* --- filtros --- */
    const formFiltros = $("#formFiltros");
    if (formFiltros) {
      formFiltros.addEventListener("submit", function (e) {
        e.preventDefault();
        const d = new FormData(formFiltros);
        const desde = d.get("desde") || filtros.desde;
        const hasta = d.get("hasta") || filtros.hasta;
        if (desde > hasta) {
          aviso("La fecha «Desde» no puede ser posterior a «Hasta».", "alerta");
          return;
        }
        filtros.desde = desde;
        filtros.hasta = hasta;
        filtros.proveedorId = d.get("proveedorId") || "";
        filtros.frutaId = d.get("frutaId") || "";
        filtros.calidad = d.get("calidad") || "";
        render();
      });
    }

    const btnLimpiar = $("#btnLimpiar");
    if (btnLimpiar) {
      btnLimpiar.addEventListener("click", function () {
        filtros = { desde: DB.diasAtras(30), hasta: DB.hoy(), proveedorId: "", frutaId: "", calidad: "" };
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

    /* --- acciones de recepción --- */
    const btnNuevaRec = $("#btnNuevaRecepcion");
    if (btnNuevaRec) btnNuevaRec.addEventListener("click", formRecepcion);

    $$("[data-confirmar]").forEach(function (b) {
      b.addEventListener("click", function () {
        const rec = DB.get("recepciones", b.dataset.confirmar);
        if (!rec) return;
        DB.update("recepciones", rec.id, { estado: "Recibido" });
        DB.registrarBitacora(usuario.id, "Confirmación de recepción",
          rec.folio + " · " + nf(rec.cantidadKg) + " kg");
        aviso("Recepción " + rec.folio + " confirmada. Ya puede registrarse su producción.");
        render();
      });
    });

    $$("[data-borrar-rec]").forEach(function (b) {
      b.addEventListener("click", function () {
        const rec = DB.get("recepciones", b.dataset.borrarRec);
        if (!rec) return;
        const tieneProd = DB.all("producciones").some(function (p) { return p.recepcionId === rec.id; });
        if (tieneProd) {
          aviso("No se puede eliminar: el lote ya tiene producción registrada.", "alerta");
          return;
        }
        if (!confirm("¿Eliminar la recepción " + rec.folio + "? Esta acción no se puede deshacer.")) return;
        DB.remove("recepciones", rec.id);
        DB.registrarBitacora(usuario.id, "Eliminación de recepción", rec.folio);
        aviso("Recepción eliminada.");
        render();
      });
    });

    const btnCsvRec = $("#btnCsvRecepciones");
    if (btnCsvRec) {
      btnCsvRec.addEventListener("click", function () {
        const lista = Indicadores.filtrar(filtrosEfectivos()).recepciones;
        descargarCSV("recepciones",
          columnasRecepcion(usuario.rol === "proveedor").filter(function (c) { return c.clave !== "acciones"; }),
          lista);
      });
    }

    /* --- acciones de producción --- */
    const btnNuevaProd = $("#btnNuevaProduccion");
    if (btnNuevaProd) btnNuevaProd.addEventListener("click", formProduccion);

    $$("[data-borrar-prod]").forEach(function (b) {
      b.addEventListener("click", function () {
        const p = DB.get("producciones", b.dataset.borrarProd);
        if (!p) return;
        if (!confirm("¿Eliminar la producción " + p.folio + "?")) return;
        DB.remove("producciones", p.id);
        DB.registrarBitacora(usuario.id, "Eliminación de producción", p.folio);
        aviso("Registro de producción eliminado.");
        render();
      });
    });

    const btnCsvProd = $("#btnCsvProduccion");
    if (btnCsvProd) {
      btnCsvProd.addEventListener("click", function () {
        descargarCSV("produccion",
          columnasProduccion().filter(function (c) { return c.clave !== "acciones"; }),
          Indicadores.filtrar(filtrosEfectivos()).producciones);
      });
    }

    /* --- proveedores --- */
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

    const btnCsvProv = $("#btnCsvProveedores");
    if (btnCsvProv) {
      btnCsvProv.addEventListener("click", function () {
        const cols = [
          { titulo: "Código", csv: function (p) { return p.codigo; } },
          { titulo: "Proveedor", csv: function (p) { return p.nombre; } },
          { titulo: "Documento", csv: function (p) { return p.documento; } },
          { titulo: "Contacto", csv: function (p) { return p.contacto; } },
          { titulo: "Teléfono", csv: function (p) { return p.telefono; } },
          { titulo: "Correo", csv: function (p) { return p.email; } },
          { titulo: "Zona", csv: function (p) { return p.zona; } },
          { titulo: "Estado", csv: function (p) { return p.activo ? "Activo" : "Inactivo"; } }
        ];
        descargarCSV("proveedores", cols, DB.all("proveedores"));
      });
    }

    /* --- usuarios --- */
    const btnNuevoUsr = $("#btnNuevoUsuario");
    if (btnNuevoUsr) btnNuevoUsr.addEventListener("click", formUsuario);

    $$("[data-toggle-usr]").forEach(function (b) {
      b.addEventListener("click", function () {
        const u = DB.get("usuarios", b.dataset.toggleUsr);
        if (!u) return;
        DB.update("usuarios", u.id, { activo: !u.activo });
        DB.registrarBitacora(usuario.id, u.activo ? "Desactivación de usuario" : "Activación de usuario", u.nombre);
        render();
      });
    });

    /* --- reportes --- */
    $$("[data-reporte]").forEach(function (b) {
      b.addEventListener("click", function () {
        reporteActual = b.dataset.reporte;
        render();
      });
    });

    const btnCsvRep = $("#btnCsvReporte");
    if (btnCsvRep) {
      btnCsvRep.addEventListener("click", function () {
        const f = filtrosEfectivos();
        descargarCSV("reporte_" + reporteActual,
          columnasReporte(reporteActual), REPORTES[reporteActual].datos(f));
      });
    }

    const btnImprimir = $("#btnImprimir");
    if (btnImprimir) btnImprimir.addEventListener("click", function () { window.print(); });

    /* --- datos del sistema --- */
    const btnExp = $("#btnExportarJSON");
    if (btnExp) {
      btnExp.addEventListener("click", function () {
        descargarJSON("agroregistro_respaldo", DB.exportar());
        aviso("Respaldo descargado.");
      });
    }

    const inputImp = $("#inputImportar");
    if (inputImp) {
      inputImp.addEventListener("change", function () {
        const archivo = inputImp.files[0];
        if (!archivo) return;
        const lector = new FileReader();
        lector.onload = function () {
          try {
            DB.importar(lector.result);
            aviso("Datos restaurados correctamente.");
            render();
          } catch (err) {
            aviso("No se pudo restaurar: " + err.message, "error");
          }
        };
        lector.readAsText(archivo);
      });
    }

    const btnReset = $("#btnReiniciar");
    if (btnReset) {
      btnReset.addEventListener("click", function () {
        if (!confirm("Se borrarán todos los registros actuales y se cargarán los datos de demostración. ¿Continuar?")) return;
        DB.reset();
        aviso("Sistema reiniciado con datos de demostración.");
        render();
      });
    }
  }

  /* =============================== arranque ============================ */

  document.addEventListener("DOMContentLoaded", function () {
    DB.load();
    restaurarSesion();
    render();
  });
})();
