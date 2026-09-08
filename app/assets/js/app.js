/* =========================================================================
   app.js — Controlador de la aplicación
   Sesión, permisos por rol, ciclo de vida del lote, formularios y reportes.
   ========================================================================= */

(function () {
  "use strict";

  /* ============================ estado de la sesión ==================== */

  const SESION = "agroreg.sesion.v2";
  let usuario = null;
  let vistaActual = "panel";
  let reporteActual = "proveedor";

  let filtros = {
    desde: DB.diasAtras(30),
    hasta: DB.hoy(),
    proveedorId: "",
    frutaId: "",
    calidad: "",
    estado: ""
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

  function pctFirmado(n) {
    const v = (Number(n) || 0) * 100;
    return (v > 0 ? "+" : "") + nf(v, 1) + "%";
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
    setTimeout(function () { div.classList.add("saliendo"); }, 3400);
    setTimeout(function () { div.remove(); }, 3900);
  }

  /* --------------------------------------------------------- permisos */

  /* Cada acción pertenece a un rol del proceso. Supervisión es el único rol
     transversal: ve todo y cierra el ciclo. */
  const PERMISOS = {
    proveedor: ["anunciar_lote", "ver_propios"],
    recepcion: ["pesar_lote", "rechazar_lote"],
    produccion: ["registrar_produccion"],
    supervision: ["cerrar_lote", "enviar_reporte", "reabrir_lote", "administrar",
      "pesar_lote", "registrar_produccion", "anunciar_lote"]
  };

  function puede(accion) {
    if (!usuario) return false;
    return (PERMISOS[usuario.rol] || []).indexOf(accion) !== -1;
  }

  /* El proveedor solo ve lo suyo: se fuerza el filtro en cada lectura, no
     en la interfaz, para que no baste con manipular el formulario. */
  function filtrosEfectivos() {
    const f = Object.assign({}, filtros);
    if (usuario && usuario.rol === "proveedor") f.proveedorId = usuario.proveedorId;
    return f;
  }

  /* ================================ sesión ============================= */

  function iniciarSesion(rol, nombre, proveedorId) {
    const nombreLimpio = String(nombre).trim();
    if (nombreLimpio.length < 3) return { error: "Escribe tu nombre y apellido." };
    if (rol === "proveedor" && !proveedorId) {
      return { error: "Selecciona a qué proveedor perteneces." };
    }

    /* Si la persona ya existe en el padrón se reutiliza su ficha; si no, se
       la da de alta para que la bitácora siempre tenga a quién atribuir. */
    let u = DB.all("usuarios").find(function (x) {
      return x.nombre.toLowerCase() === nombreLimpio.toLowerCase() && x.rol === rol;
    });

    if (!u) {
      u = DB.insert("usuarios", {
        nombre: nombreLimpio,
        rol: rol,
        proveedorId: rol === "proveedor" ? proveedorId : null,
        activo: true,
        fechaAlta: DB.hoy()
      });
      DB.registrarBitacora(u.id, "Alta de usuario", nombreLimpio + " ingresó como " + rol);
    } else if (!u.activo) {
      return { error: "Tu usuario está inactivo. Habla con Supervisión." };
    } else if (rol === "proveedor" && u.proveedorId !== proveedorId) {
      u = DB.update("usuarios", u.id, { proveedorId: proveedorId });
    }

    usuario = u;
    try { sessionStorage.setItem(SESION, u.id); } catch (e) { /* modo privado */ }
    DB.registrarBitacora(u.id, "Inicio de sesión", u.nombre + " · " + rol);
    return { ok: true };
  }

  function cerrarSesion() {
    if (usuario) DB.registrarBitacora(usuario.id, "Cierre de sesión", usuario.nombre);
    usuario = null;
    vistaActual = "panel";
    try { sessionStorage.removeItem(SESION); } catch (e) { /* noop */ }
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
      { id: "panel", texto: "Panel de indicadores", icono: "📊", roles: "*" },
      { id: "lotes", texto: usuario.rol === "proveedor" ? "Mis lotes" : "Lotes", icono: "📦", roles: "*" },
      { id: "recepcion", texto: "Recepción y pesaje", icono: "⚖️", roles: ["recepcion", "supervision"] },
      { id: "produccion", texto: "Producción", icono: "🏭", roles: ["produccion", "supervision"] },
      { id: "reportes", texto: "Reportes", icono: "📄", roles: "*" },
      { id: "proveedores", texto: "Proveedores", icono: "🤝", roles: ["supervision"] },
      { id: "usuarios", texto: "Usuarios", icono: "👥", roles: ["supervision"] },
      { id: "bitacora", texto: "Bitácora", icono: "🕘", roles: ["supervision"] },
      { id: "datos", texto: "Datos del sistema", icono: "⚙️", roles: ["supervision"] }
    ];
    return items.filter(function (i) {
      return i.roles === "*" || i.roles.indexOf(usuario.rol) !== -1;
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

  function insignia(estado) {
    return '<span class="estado estado-' + esc(estado.toLowerCase()) + '">' + esc(estado) + "</span>";
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
    html += "</tbody></table></div>";
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

    if (o.estado) {
      html += '<div class="campo"><label for="fEstado">Estado</label><select id="fEstado" name="estado"><option value="">Todos</option>';
      DB.ESTADOS.forEach(function (e) {
        html += '<option value="' + esc(e.id) + '"' + (f.estado === e.id ? " selected" : "") +
          ">" + esc(e.nombre) + "</option>";
      });
      html += "</select></div>";
    }

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

  function abrirFormulario(titulo, campos, onSubmit, opciones) {
    const o = opciones || {};
    const capa = document.createElement("div");
    capa.className = "modal-capa";
    capa.innerHTML =
      '<div class="modal' + (o.ancho ? " modal-ancho" : "") + '" role="dialog" aria-modal="true" aria-labelledby="modalTitulo">' +
      '<header class="modal-cab"><h2 id="modalTitulo">' + esc(titulo) + "</h2>" +
      '<button type="button" class="modal-x" aria-label="Cerrar">&times;</button></header>' +
      '<form class="modal-cuerpo" novalidate>' +
      (o.nota ? '<p class="modal-nota">' + o.nota + "</p>" : "") +
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
    }
    function onEsc(e) { if (e.key === "Escape") cerrar(); }

    document.addEventListener("keydown", onEsc);
    $(".modal-x", capa).addEventListener("click", cerrar);
    $("[data-cancelar]", capa).addEventListener("click", cerrar);
    capa.addEventListener("mousedown", function (e) { if (e.target === capa) cerrar(); });

    enlazarMermas(form, campos, o);

    if (o.alCambiar) {
      form.addEventListener("input", function () { o.alCambiar(leer(form, campos), form); });
      form.addEventListener("change", function () { o.alCambiar(leer(form, campos), form); });
      o.alCambiar(leer(form, campos), form);
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const datos = leer(form, campos);
      const problema = validar(campos, datos);
      if (problema) {
        error.innerHTML = problema;
        error.hidden = false;
        error.scrollIntoView({ block: "nearest" });
        return;
      }
      error.hidden = true;
      const resultado = onSubmit(datos);
      if (resultado && resultado.error) {
        error.innerHTML = resultado.error;
        error.hidden = false;
        return;
      }
      cerrar();
    });

    const primero = $("input:not([readonly]), select:not([disabled]), textarea", form);
    if (primero) primero.focus();
  }

  function campoHTML(c) {
    if (c.tipo === "separador") return '<h3 class="form-sep">' + esc(c.etiqueta) + "</h3>";
    if (c.tipo === "html") return '<div class="campo campo-full">' + c.contenido + "</div>";

    if (c.tipo === "calculado") {
      return '<div class="campo campo-' + (c.ancho || "full") + ' campo-calculado">' +
        "<label>" + esc(c.etiqueta) + '</label><output id="' + esc(c.nombre) + '">—</output>' +
        (c.ayuda ? '<small class="ayuda">' + esc(c.ayuda) + "</small>" : "") + "</div>";
    }

    /* Campo compuesto: una fila por causa de merma, con su cantidad. */
    if (c.tipo === "mermas") {
      let html = '<div class="campo campo-full mermas" id="bloqueMermas">' +
        "<label>" + esc(c.etiqueta) + "</label>" +
        (c.ayuda ? '<small class="ayuda">' + esc(c.ayuda) + "</small>" : "") +
        '<div class="mermas-filas" id="mermasFilas"></div>' +
        '<button type="button" class="btn btn-plano btn-sm" id="btnAgregarMerma">+ Agregar causa</button>' +
        '<div class="balance" id="balanceMermas"></div></div>';
      return html;
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
      control = "<textarea " + base + ' rows="3"' +
        (c.marcador ? ' placeholder="' + esc(c.marcador) + '"' : "") + ">" + esc(c.valor || "") + "</textarea>";
    } else if (c.tipo === "checkbox") {
      control = '<label class="check"><input type="checkbox" ' + base +
        (c.valor ? " checked" : "") + "> " + esc(c.textoCheck || "") + "</label>";
    } else {
      /* En el movil, inputmode saca el teclado numerico directamente: pesar
         un lote no puede obligar a cambiar de teclado en cada campo. */
      const modo = c.tipo === "number" ? ' inputmode="decimal"'
        : c.tipo === "tel" ? ' inputmode="tel"' : "";
      control = '<input type="' + (c.tipo || "text") + '"' + modo + " " + base +
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

  /* Las filas de merma se manejan aparte porque son dinámicas. */
  function enlazarMermas(form, campos, opciones) {
    const bloque = $("#mermasFilas", form);
    if (!bloque) return;

    function fila(causaId, kg) {
      const div = document.createElement("div");
      div.className = "merma-fila";
      let sel = '<select class="merma-causa">';
      DB.CAUSAS_MERMA.forEach(function (c) {
        sel += '<option value="' + esc(c.id) + '"' + (c.id === causaId ? " selected" : "") +
          ">" + esc(c.nombre) + " (" + esc(c.tipo) + ")</option>";
      });
      sel += "</select>";
      div.innerHTML = sel +
        '<input type="number" class="merma-kg" min="0" step="0.1" placeholder="kg" value="' +
        (kg || "") + '" aria-label="Kilogramos de esta causa">' +
        '<button type="button" class="btn-mini btn-mini-peligro merma-quitar" aria-label="Quitar causa">✕</button>';
      div.querySelector(".merma-quitar").addEventListener("click", function () {
        div.remove();
        form.dispatchEvent(new Event("input", { bubbles: true }));
      });
      bloque.appendChild(div);
    }

    $("#btnAgregarMerma", form).addEventListener("click", function () {
      fila(DB.CAUSAS_MERMA[0].id, "");
      form.dispatchEvent(new Event("input", { bubbles: true }));
    });

    /* Se arranca con las causas más habituales ya puestas, para que el
       operador solo tenga que escribir cantidades. */
    (opciones.mermasIniciales || ["cm_pelado", "cm_madurez", "cm_golpe"]).forEach(function (id) {
      fila(id, "");
    });
  }

  function leerMermas(form) {
    return $$(".merma-fila", form).map(function (f) {
      return {
        causaId: $(".merma-causa", f).value,
        kg: Number($(".merma-kg", f).value) || 0
      };
    }).filter(function (m) { return m.kg > 0; });
  }

  function leer(form, campos) {
    const datos = {};
    campos.forEach(function (c) {
      if (c.tipo === "separador" || c.tipo === "calculado" || c.tipo === "html") return;
      if (c.tipo === "mermas") { datos[c.nombre] = leerMermas(form); return; }
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
      if (c.tipo === "separador" || c.tipo === "calculado" || c.tipo === "html") continue;
      const v = datos[c.nombre];
      if (c.requerido && (v === "" || v === null || v === undefined)) {
        return "El campo «" + esc(c.etiqueta) + "» es obligatorio.";
      }
      if (c.tipo === "number" && v !== "") {
        if (c.min !== undefined && v < c.min) return "«" + esc(c.etiqueta) + "» no puede ser menor que " + c.min + ".";
        if (c.max !== undefined && v > c.max) return "«" + esc(c.etiqueta) + "» no puede ser mayor que " + nf(c.max, 1) + ".";
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
    descargar(blob, nombre + "_" + DB.hoy() + ".csv");
  }

  /* Cuando la app corre dentro del visor de Claude, los enlaces de descarga
     no hacen nada: hay que pedir el guardado por su API. Se resuelve una vez
     al arrancar y, si no esta disponible, se usa el enlace de siempre. */
  let guardadoDelVisor = null;

  function prepararGuardado() {
    if (typeof window.claude === "undefined" || !window.claude ||
        typeof window.claude.use !== "function") return;
    window.claude.use("downloads")
      .then(function (d) { guardadoDelVisor = d; })
      .catch(function () { guardadoDelVisor = null; });
  }

  function descargar(blob, nombreArchivo) {
    if (guardadoDelVisor) {
      guardadoDelVisor.save({ filename: nombreArchivo, data: blob })
        .then(function () { aviso("Archivo guardado."); })
        .catch(function (e) {
          if (e && e.code === "declined") return;      // el usuario dijo que no
          aviso("No se pudo guardar el archivo.", "error");
        });
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    aviso("Archivo descargado.");
  }

  /* ================================ vistas ============================= */

  /* ------------------------------------------------------------- panel */

  function vistaPanel() {
    const f = filtrosEfectivos();
    const k = Indicadores.calcular(f);
    const dias = Math.round((new Date(f.hasta) - new Date(f.desde)) / 86400000);
    const gran = dias > 120 ? "mes" : "dia";

    let html = '<div class="vista-cab"><div><h1>Panel de indicadores</h1>' +
      '<p class="sub">Del ' + fechaLarga(f.desde) + " al " + fechaLarga(f.hasta) +
      (usuario.rol === "proveedor" ? " · " + esc(Indicadores.nombreProveedor(usuario.proveedorId)) : "") +
      "</p></div>" +
      '<button class="btn btn-plano" id="btnImprimir">Imprimir panel</button></div>';

    html += barraFiltros({ calidad: true, estado: true });

    /* Embudo del ciclo de vida: cuántos lotes hay en cada etapa. */
    html += '<section class="panel"><h2>Estado de los lotes</h2><div class="embudo">';
    DB.ESTADOS.filter(function (e) { return e.id !== "Rechazado"; }).forEach(function (e, i) {
      html += '<div class="embudo-paso"><span class="embudo-num">' + nf(k.porEstado[e.id] || 0) + "</span>" +
        '<span class="embudo-nombre">' + esc(e.nombre) + "</span>" +
        '<span class="embudo-ayuda">' + esc(e.ayuda) + "</span></div>";
      if (i < 3) html += '<div class="embudo-flecha" aria-hidden="true">→</div>';
    });
    html += "</div>";
    if (k.numRechazados > 0) {
      html += '<p class="embudo-rechazo">' + nf(k.numRechazados) + " lote(s) rechazado(s) en recepción · " +
        pct(k.tasaRechazo) + " del total.</p>";
    }
    html += "</section>";

    html += '<section class="kpis">';
    html += tarjetaKPI("Fruta recibida", nf(k.kgRecibido) + " kg",
      k.numLotes + " lotes de " + k.proveedoresActivos + " proveedores", "verde");
    html += tarjetaKPI("Diferencia de peso", pctFirmado(k.tasaDiferenciaPeso),
      nf(k.diferenciaPeso) + " kg entre lo anunciado y lo pesado",
      Math.abs(k.tasaDiferenciaPeso) <= 0.01 ? "verde" : Math.abs(k.tasaDiferenciaPeso) <= 0.03 ? "ambar" : "rojo");
    html += tarjetaKPI("Fruta procesada", nf(k.kgProcesados) + " kg",
      pct(k.tasaProcesamiento) + " de lo recibido", "azul");
    html += tarjetaKPI("Producto exportable", nf(k.kgExportable) + " kg",
      k.numProducciones + " lotes procesados", "verde");
    html += tarjetaKPI("Tasa de exportable", pct(k.tasaExportable),
      "Meta " + pct(k.metaExportable) + " · cumplimiento " + pct(k.cumplimientoMeta),
      k.cumplimientoMeta >= 1 ? "verde" : k.cumplimientoMeta >= 0.9 ? "ambar" : "rojo");
    html += tarjetaKPI("Merma", pct(k.tasaMerma), nf(k.kgMerma) + " kg no exportables",
      k.tasaMerma > 0.45 ? "rojo" : "ambar");
    html += tarjetaKPI("Valor de compra", money(k.valorCompra),
      "Costo por kg exportable: " + money(k.costoPorKgExportable), "neutro");
    html += tarjetaKPI("Ciclo del lote", nf(k.cicloPromedio, 1) + " días",
      "Del anuncio al cierre · " + k.numCerrados + " lotes cerrados", "azul");
    html += "</section>";

    html += '<section class="panel"><h2>Cumplimiento de la tasa de exportable</h2>' +
      Graficos.medidor(k.tasaExportable, k.metaExportable, "Exportable real vs. meta del período") +
      "</section>";

    html += '<section class="panel"><h2>¿Dónde se pierde la fruta?</h2>' +
      '<p class="sub panel-sub">Causas ordenadas por peso. La línea marca el porcentaje acumulado: ' +
      "las causas a la izquierda del 80 % son las que conviene atacar primero.</p>" +
      Graficos.pareto(Indicadores.porCausaMerma(f), { titulo: "Pareto de causas de merma" }) +
      "</section>";

    html += '<div class="grid-2">';
    html += '<section class="panel"><h2>Tendencia de recepción y proceso</h2>' +
      Graficos.lineas(Indicadores.serie(f, gran), {
        titulo: "Tendencia de kilogramos",
        series: [
          { campo: "recibido", nombre: "Recibido", color: Graficos.PALETA[0] },
          { campo: "procesado", nombre: "Procesado", color: Graficos.PALETA[1] },
          { campo: "exportable", nombre: "Exportable", color: Graficos.PALETA[2] }
        ]
      }) + "</section>";
    html += '<section class="panel"><h2>Merma por origen del problema</h2>' +
      Graficos.dona(Indicadores.porTipoMerma(f), { titulo: "Merma por origen" }) + "</section>";
    html += "</div>";

    html += '<div class="grid-2">';
    if (usuario.rol !== "proveedor") {
      html += '<section class="panel"><h2>Proveedores por volumen</h2>' +
        Graficos.barras(Indicadores.porProveedor(f), { campo: "kgRecibido", sufijo: " kg" }) +
        "</section>";
    }
    html += '<section class="panel"><h2>Volumen por fruta</h2>' +
      Graficos.barras(Indicadores.porFruta(f), { campo: "kgRecibido", sufijo: " kg", color: Graficos.PALETA[2] }) +
      "</section>";
    html += "</div>";

    return html;
  }

  /* ------------------------------------------------------------- lotes */

  function columnasLote(opciones) {
    const o = opciones || {};
    const cols = [
      { clave: "folio", titulo: "Lote",
        valor: function (l) {
          return "<code>" + esc(l.codigoLote) + "</code><br><small class='tenue'>" + esc(l.folio) + "</small>";
        },
        csv: function (l) { return l.codigoLote; } },
      { clave: "fecha", titulo: "Anunciado", valor: function (l) { return fechaLarga(l.fecha); }, csv: function (l) { return l.fecha; } }
    ];

    if (usuario.rol !== "proveedor") {
      cols.push({ clave: "proveedor", titulo: "Proveedor",
        valor: function (l) { return esc(Indicadores.nombreProveedor(l.proveedorId)); },
        csv: function (l) { return Indicadores.nombreProveedor(l.proveedorId); } });
    }

    cols.push(
      { clave: "fruta", titulo: "Fruta", valor: function (l) { return esc(Indicadores.nombreFruta(l.frutaId)); }, csv: function (l) { return Indicadores.nombreFruta(l.frutaId); } },
      { clave: "anunciado", titulo: "Anunciado kg", num: true, valor: function (l) { return nf(l.cantidadAnunciadaKg); }, csv: function (l) { return l.cantidadAnunciadaKg; } },
      { clave: "recibido", titulo: "Pesado kg", num: true,
        valor: function (l) { return l.cantidadRecibidaKg === null ? '<span class="tenue">—</span>' : nf(l.cantidadRecibidaKg); },
        csv: function (l) { return l.cantidadRecibidaKg === null ? "" : l.cantidadRecibidaKg; } },
      { clave: "diferencia", titulo: "Diferencia", num: true,
        valor: function (l) {
          if (l.cantidadRecibidaKg === null || !l.cantidadAnunciadaKg) return '<span class="tenue">—</span>';
          const d = (l.cantidadRecibidaKg - l.cantidadAnunciadaKg) / l.cantidadAnunciadaKg;
          const clase = Math.abs(d) <= 0.01 ? "etq-ok" : Math.abs(d) <= 0.03 ? "etq-B" : "etq-bajo";
          return '<span class="etq ' + clase + '">' + pctFirmado(d) + "</span>";
        },
        csv: function (l) {
          if (l.cantidadRecibidaKg === null || !l.cantidadAnunciadaKg) return "";
          return (((l.cantidadRecibidaKg - l.cantidadAnunciadaKg) / l.cantidadAnunciadaKg) * 100).toFixed(2);
        } },
      { clave: "calidad", titulo: "Calidad",
        valor: function (l) {
          const c = l.calidadVerificada || l.calidadDeclarada;
          const bajo = l.calidadVerificada && l.calidadVerificada !== l.calidadDeclarada;
          return '<span class="etq etq-' + esc(c) + '">' + esc(c) + "</span>" +
            (bajo ? ' <small class="tenue" title="La calidad verificada en planta bajó respecto a la declarada">↓' + esc(l.calidadDeclarada) + "</small>" : "");
        },
        csv: function (l) { return l.calidadVerificada || l.calidadDeclarada; } },
      { clave: "estado", titulo: "Estado", valor: function (l) { return insignia(l.estado); }, csv: function (l) { return l.estado; } }
    );

    if (o.acciones !== false) {
      cols.push({ clave: "acciones", titulo: "",
        valor: function (l) { return accionesLote(l); },
        csv: function () { return ""; } });
    }
    return cols;
  }

  /* Los botones que ve cada rol dependen del estado del lote: el sistema
     guía el proceso en vez de dejar todo abierto siempre. */
  function accionesLote(l) {
    let b = '<button class="btn-mini" data-ficha="' + esc(l.id) + '">Ver ficha</button>';

    if (l.estado === "Anunciado" && puede("pesar_lote")) {
      b += '<button class="btn-mini btn-mini-accion" data-pesar="' + esc(l.id) + '">Pesar</button>';
    }
    if (l.estado === "Recibido" && puede("registrar_produccion")) {
      b += '<button class="btn-mini btn-mini-accion" data-procesar="' + esc(l.id) + '">Procesar</button>';
    }
    if (l.estado === "Procesado" && puede("cerrar_lote")) {
      b += '<button class="btn-mini btn-mini-accion" data-cerrar="' + esc(l.id) + '">Cerrar</button>';
    }
    if (l.estado === "Cerrado" && puede("reabrir_lote")) {
      b += '<button class="btn-mini" data-reabrir="' + esc(l.id) + '">Reabrir</button>';
    }
    if (l.estado === "Cerrado" && !l.reporteEnviado && puede("enviar_reporte")) {
      b += '<button class="btn-mini" data-enviar="' + esc(l.id) + '">Enviar reporte</button>';
    }
    return b;
  }

  function vistaLotes() {
    const f = filtrosEfectivos();
    const lista = Indicadores.filtrar(f).lotes.slice().sort(function (a, b) {
      return a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0;
    });

    const esProveedor = usuario.rol === "proveedor";
    let html = '<div class="vista-cab"><div><h1>' + (esProveedor ? "Mis lotes" : "Lotes") + "</h1>" +
      '<p class="sub">' + (esProveedor
        ? "Anuncia tus envíos y sigue el resultado de cada lote."
        : "Recorrido completo de cada lote, del anuncio del proveedor al cierre.") +
      "</p></div><div class='cab-acciones'>";
    if (puede("anunciar_lote")) {
      html += '<button class="btn btn-primario" id="btnAnunciar">+ Anunciar envío</button>';
    }
    html += '<button class="btn btn-plano" id="btnCsvLotes">Exportar CSV</button></div></div>';

    html += barraFiltros({ calidad: true, estado: true });

    const anunciado = lista.reduce(function (a, l) { return a + l.cantidadAnunciadaKg; }, 0);
    const recibido = lista.reduce(function (a, l) { return a + (l.cantidadRecibidaKg || 0); }, 0);
    html += '<p class="resumen-linea"><strong>' + nf(lista.length) + "</strong> lotes · anunciados <strong>" +
      nf(anunciado) + "</strong> kg · pesados <strong>" + nf(recibido) + "</strong> kg</p>";

    html += tabla(columnasLote({}), lista, { vacio: "No hay lotes en este período." });
    return html;
  }

  /* --------------------------------------------------------- recepción */

  function vistaRecepcion() {
    const f = filtrosEfectivos();
    const todos = Indicadores.filtrar(f).lotes;
    const pendientes = DB.all("lotes").filter(function (l) { return l.estado === "Anunciado"; })
      .sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
    const pesados = todos.filter(function (l) { return l.cantidadRecibidaKg !== null; });

    let html = '<div class="vista-cab"><div><h1>Recepción y pesaje</h1>' +
      '<p class="sub">Confirma y pesa la fruta que llega a planta.</p></div></div>';

    /* Los pendientes van primero y sin filtro de fecha: es la cola de trabajo
       real del puesto de recepción, no un histórico. */
    html += '<section class="panel panel-destacado"><h2>Esperando en el patio (' +
      nf(pendientes.length) + ")</h2>";
    if (!pendientes.length) {
      html += '<p class="vacio">No hay lotes anunciados pendientes de pesar.</p>';
    } else {
      html += tabla([
        { clave: "codigoLote", titulo: "Lote", valor: function (l) { return "<code>" + esc(l.codigoLote) + "</code>"; } },
        { clave: "fecha", titulo: "Anunciado", valor: function (l) { return fechaLarga(l.fecha); } },
        { clave: "proveedor", titulo: "Proveedor", valor: function (l) { return esc(Indicadores.nombreProveedor(l.proveedorId)); } },
        { clave: "fruta", titulo: "Fruta", valor: function (l) { return esc(Indicadores.nombreFruta(l.frutaId)); } },
        { clave: "anunciado", titulo: "Anunciado kg", num: true, valor: function (l) { return nf(l.cantidadAnunciadaKg); } },
        { clave: "calidad", titulo: "Calidad declarada", valor: function (l) { return '<span class="etq etq-' + esc(l.calidadDeclarada) + '">' + esc(l.calidadDeclarada) + "</span>"; } },
        { clave: "acciones", titulo: "", valor: function (l) {
          return '<button class="btn-mini btn-mini-accion" data-pesar="' + esc(l.id) + '">Pesar y confirmar</button>' +
            '<button class="btn-mini btn-mini-peligro" data-rechazar="' + esc(l.id) + '">Rechazar</button>';
        } }
      ], pendientes, {});
    }
    html += "</section>";

    html += "<h2>Historial de pesaje</h2>";
    html += barraFiltros({ calidad: true });

    const anun = pesados.reduce(function (a, l) { return a + l.cantidadAnunciadaKg; }, 0);
    const real = pesados.reduce(function (a, l) { return a + l.cantidadRecibidaKg; }, 0);
    const dif = anun > 0 ? (real - anun) / anun : 0;
    html += '<p class="resumen-linea"><strong>' + nf(pesados.length) + "</strong> lotes pesados · anunciado <strong>" +
      nf(anun) + "</strong> kg · real <strong>" + nf(real) + "</strong> kg · diferencia <strong>" +
      pctFirmado(dif) + "</strong></p>";

    html += tabla(columnasLote({}), pesados.sort(function (a, b) {
      return a.fechaRecepcion < b.fechaRecepcion ? 1 : -1;
    }), { vacio: "Todavía no se ha pesado ningún lote en este período." });

    return html;
  }

  /* --------------------------------------------------------- producción */

  function vistaProduccion() {
    const f = filtrosEfectivos();
    const datos = Indicadores.filtrar(f);
    const lista = datos.producciones.slice().sort(function (a, b) {
      return a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0;
    });
    const porProcesar = DB.all("lotes").filter(function (l) { return l.estado === "Recibido"; })
      .sort(function (a, b) { return a.fechaRecepcion < b.fechaRecepcion ? -1 : 1; });

    let html = '<div class="vista-cab"><div><h1>Producción</h1>' +
      '<p class="sub">Registra lo procesado, lo exportable y las mermas con su causa.</p></div>' +
      '<div class="cab-acciones"><button class="btn btn-plano" id="btnCsvProduccion">Exportar CSV</button></div></div>';

    html += '<section class="panel panel-destacado"><h2>Lotes en cámara, listos para procesar (' +
      nf(porProcesar.length) + ")</h2>";
    if (!porProcesar.length) {
      html += '<p class="vacio">No hay lotes recibidos pendientes de procesar.</p>';
    } else {
      html += tabla([
        { clave: "codigoLote", titulo: "Lote", valor: function (l) { return "<code>" + esc(l.codigoLote) + "</code>"; } },
        { clave: "fechaRecepcion", titulo: "Recibido", valor: function (l) { return fechaLarga(l.fechaRecepcion); } },
        { clave: "proveedor", titulo: "Proveedor", valor: function (l) { return esc(Indicadores.nombreProveedor(l.proveedorId)); } },
        { clave: "fruta", titulo: "Fruta", valor: function (l) { return esc(Indicadores.nombreFruta(l.frutaId)); } },
        { clave: "recibido", titulo: "Disponible kg", num: true, valor: function (l) { return nf(l.cantidadRecibidaKg); } },
        { clave: "calidad", titulo: "Calidad", valor: function (l) { return '<span class="etq etq-' + esc(l.calidadVerificada) + '">' + esc(l.calidadVerificada) + "</span>"; } },
        { clave: "acciones", titulo: "", valor: function (l) {
          return puede("registrar_produccion")
            ? '<button class="btn-mini btn-mini-accion" data-procesar="' + esc(l.id) + '">Registrar producción</button>'
            : "—";
        } }
      ], porProcesar, {});
    }
    html += "</section>";

    html += "<h2>Producción registrada</h2>";
    html += barraFiltros({});

    const proc = lista.reduce(function (a, p) { return a + p.kgProcesados; }, 0);
    const expo = lista.reduce(function (a, p) { return a + p.kgExportable; }, 0);
    html += '<p class="resumen-linea"><strong>' + nf(lista.length) + "</strong> lotes procesados · <strong>" +
      nf(proc) + "</strong> kg procesados · <strong>" + nf(expo) +
      "</strong> kg exportables · tasa <strong>" + pct(proc > 0 ? expo / proc : 0) + "</strong></p>";

    html += tabla(columnasProduccion(), lista, { vacio: "No hay producción registrada en este período." });
    return html;
  }

  function columnasProduccion() {
    return [
      { clave: "folio", titulo: "Folio", valor: function (p) { return "<code>" + esc(p.folio) + "</code>"; }, csv: function (p) { return p.folio; } },
      { clave: "fecha", titulo: "Fecha", valor: function (p) { return fechaLarga(p.fecha); }, csv: function (p) { return p.fecha; } },
      { clave: "codigoLote", titulo: "Lote", valor: function (p) { return "<code>" + esc(p.codigoLote) + "</code>"; }, csv: function (p) { return p.codigoLote; } },
      { clave: "fruta", titulo: "Fruta", valor: function (p) { return esc(Indicadores.nombreFruta(p.frutaId)); }, csv: function (p) { return Indicadores.nombreFruta(p.frutaId); } },
      { clave: "producto", titulo: "Producto", valor: function (p) { return esc(Indicadores.nombreProducto(p.productoId)); }, csv: function (p) { return Indicadores.nombreProducto(p.productoId); } },
      { clave: "turno", titulo: "Turno", valor: function (p) { return esc(p.turno); }, csv: function (p) { return p.turno; } },
      { clave: "kgProcesados", titulo: "Procesado kg", num: true, valor: function (p) { return nf(p.kgProcesados); }, csv: function (p) { return p.kgProcesados; } },
      { clave: "kgExportable", titulo: "Exportable kg", num: true, valor: function (p) { return nf(p.kgExportable); }, csv: function (p) { return p.kgExportable; } },
      { clave: "tasa", titulo: "Tasa exportable", num: true,
        valor: function (p) {
          const t = p.kgProcesados > 0 ? p.kgExportable / p.kgProcesados : 0;
          const fruta = DB.get("frutas", p.frutaId);
          const meta = fruta ? fruta.metaExportable : 0.6;
          return '<span class="etq ' + (t >= meta ? "etq-ok" : "etq-bajo") + '">' + pct(t) + "</span>";
        },
        csv: function (p) { return p.kgProcesados > 0 ? ((p.kgExportable / p.kgProcesados) * 100).toFixed(2) : 0; } },
      { clave: "merma", titulo: "Merma kg", num: true, valor: function (p) { return nf(Indicadores.totalMerma(p)); }, csv: function (p) { return Indicadores.totalMerma(p); } },
      { clave: "causa", titulo: "Causa principal",
        valor: function (p) {
          const m = (p.mermas || []).slice().sort(function (a, b) { return b.kg - a.kg; })[0];
          if (!m) return '<span class="tenue">—</span>';
          const c = DB.causaMerma(m.causaId);
          return esc(c ? c.nombre : m.causaId) + '<br><small class="tenue">' + nf(m.kg) + " kg</small>";
        },
        csv: function (p) {
          const m = (p.mermas || []).slice().sort(function (a, b) { return b.kg - a.kg; })[0];
          const c = m ? DB.causaMerma(m.causaId) : null;
          return c ? c.nombre : "";
        } },
      { clave: "operador", titulo: "Operador", valor: function (p) { return esc(p.operador); }, csv: function (p) { return p.operador; } }
    ];
  }

  /* ============================ acciones del proceso =================== */

  /* 1) El proveedor anuncia el envío. */
  function formAnunciar() {
    const esProveedor = usuario.rol === "proveedor";
    const campos = [
      { nombre: "fecha", etiqueta: "Fecha del envío", tipo: "date", valor: DB.hoy(), requerido: true, ancho: "mitad",
        validar: function (v) { return v > DB.hoy() ? "La fecha no puede ser futura." : null; } },
      { nombre: "proveedorId", etiqueta: "Proveedor", tipo: "select", requerido: true, ancho: "mitad",
        vacio: esProveedor ? null : "Seleccione…",
        opciones: esProveedor
          ? [{ valor: usuario.proveedorId, texto: Indicadores.nombreProveedor(usuario.proveedorId) }]
          : DB.all("proveedores").filter(function (p) { return p.activo; })
              .map(function (p) { return { valor: p.id, texto: p.nombre }; }),
        valor: esProveedor ? usuario.proveedorId : "",
        soloLectura: esProveedor },
      { nombre: "frutaId", etiqueta: "Fruta", tipo: "select", requerido: true, ancho: "mitad", vacio: "Seleccione…", opciones: opcionesFrutas() },
      { nombre: "cantidadAnunciadaKg", etiqueta: "Cantidad que envías (kg)", tipo: "number", requerido: true,
        min: 1, max: 100000, paso: "0.1", ancho: "mitad",
        ayuda: "Peso declarado en la guía de remisión. Recepción lo verificará en la báscula." },
      { nombre: "calidadDeclarada", etiqueta: "Calidad declarada", tipo: "select", requerido: true, ancho: "mitad",
        opciones: DB.CALIDADES.map(function (c) { return { valor: c.id, texto: c.nombre }; }), valor: "A" },
      { nombre: "precioUnitario", etiqueta: "Precio acordado por kg ($)", tipo: "number", requerido: true,
        min: 0, max: 100, paso: "0.01", ancho: "mitad" },
      { nombre: "transporte", etiqueta: "Transporte", tipo: "select", ancho: "mitad",
        opciones: [{ valor: "Propio", texto: "Propio" }, { valor: "Contratado", texto: "Contratado" }] },
      { nombre: "valorCalc", etiqueta: "Valor estimado del envío", tipo: "calculado", ancho: "mitad",
        ayuda: "Se liquidará sobre el peso real que registre la báscula." },
      { nombre: "observacionesProveedor", etiqueta: "Observaciones", tipo: "textarea",
        marcador: "Condición de la fruta, hora de salida, novedades del viaje." }
    ];

    abrirFormulario("Anunciar envío de fruta", campos, function (d) {
      const n = DB.all("lotes").length + 1;
      const lote = DB.insert("lotes", {
        folio: DB.siguienteFolio("lotes", "LOT"),
        codigoLote: "L" + d.fecha.replace(/-/g, "").slice(2) + "-" + String(n).padStart(3, "0"),
        fecha: d.fecha,
        proveedorId: d.proveedorId,
        frutaId: d.frutaId,
        cantidadAnunciadaKg: Number(d.cantidadAnunciadaKg),
        calidadDeclarada: d.calidadDeclarada,
        precioUnitario: Number(d.precioUnitario),
        transporte: d.transporte || "Propio",
        observacionesProveedor: d.observacionesProveedor || "",
        anunciadoPor: usuario.id,
        creadoEn: new Date().toISOString(),
        fechaRecepcion: null, cantidadRecibidaKg: null, calidadVerificada: null,
        observacionesRecepcion: "", recibidoPor: null,
        estado: "Anunciado",
        fechaCierre: null, cerradoPor: null, reporteEnviado: false, fechaReporte: null
      });
      DB.registrarBitacora(usuario.id, "Anuncio de envío",
        lote.codigoLote + " · " + nf(lote.cantidadAnunciadaKg) + " kg de " + Indicadores.nombreFruta(lote.frutaId));
      aviso("Lote " + lote.codigoLote + " anunciado. Recepción lo verá en su cola de pesaje.");
      render();
    }, {
      aceptar: "Anunciar envío",
      nota: "El lote queda <strong>Anunciado</strong> hasta que Recepción lo pese en planta.",
      alCambiar: function (d, form) {
        const out = $("#valorCalc", form);
        if (!out) return;
        const total = (Number(d.cantidadAnunciadaKg) || 0) * (Number(d.precioUnitario) || 0);
        out.textContent = total > 0 ? money(total) : "—";
      }
    });
  }

  /* 2) Recepción pesa y verifica. */
  function formPesar(loteId) {
    const lote = DB.get("lotes", loteId);
    if (!lote) return;
    if (lote.estado !== "Anunciado") {
      aviso("Ese lote ya no está pendiente de pesaje.", "alerta");
      return;
    }

    const campos = [
      { tipo: "html", contenido: fichaResumen(lote) },
      { nombre: "fechaRecepcion", etiqueta: "Fecha de llegada", tipo: "date", valor: DB.hoy(), requerido: true, ancho: "mitad",
        validar: function (v) {
          if (v > DB.hoy()) return "La fecha no puede ser futura.";
          if (v < lote.fecha) return "La fruta no puede llegar antes de que el proveedor la enviara (" + fechaLarga(lote.fecha) + ").";
          return null;
        } },
      { nombre: "cantidadRecibidaKg", etiqueta: "Peso real en báscula (kg)", tipo: "number", requerido: true,
        min: 0, max: 200000, paso: "0.1", ancho: "mitad",
        ayuda: "Lo que marca la báscula, no lo que dice la guía." },
      { nombre: "calidadVerificada", etiqueta: "Calidad verificada en planta", tipo: "select", requerido: true, ancho: "mitad",
        opciones: DB.CALIDADES.map(function (c) { return { valor: c.id, texto: c.nombre }; }),
        valor: lote.calidadDeclarada,
        ayuda: "El proveedor declaró " + lote.calidadDeclarada + "." },
      { nombre: "difCalc", etiqueta: "Diferencia contra lo anunciado", tipo: "calculado", ancho: "mitad" },
      { nombre: "observacionesRecepcion", etiqueta: "Observaciones de recepción", tipo: "textarea",
        marcador: "Temperatura, estado de los envases, novedades del transporte." }
    ];

    abrirFormulario("Pesar lote " + lote.codigoLote, campos, function (d) {
      DB.update("lotes", lote.id, {
        fechaRecepcion: d.fechaRecepcion,
        cantidadRecibidaKg: Number(d.cantidadRecibidaKg),
        calidadVerificada: d.calidadVerificada,
        observacionesRecepcion: d.observacionesRecepcion || "",
        recibidoPor: usuario.id,
        estado: "Recibido"
      });
      const dif = Number(d.cantidadRecibidaKg) - lote.cantidadAnunciadaKg;
      DB.registrarBitacora(usuario.id, "Pesaje de lote",
        lote.codigoLote + " · " + nf(d.cantidadRecibidaKg) + " kg reales (" +
        (dif >= 0 ? "+" : "") + nf(dif) + " kg contra lo anunciado)");
      aviso("Lote " + lote.codigoLote + " recibido. Producción ya puede procesarlo.");
      render();
    }, {
      aceptar: "Confirmar recepción",
      alCambiar: function (d, form) {
        const out = $("#difCalc", form);
        if (!out) return;
        const real = Number(d.cantidadRecibidaKg);
        if (!real) { out.textContent = "—"; out.className = ""; return; }
        const dif = real - lote.cantidadAnunciadaKg;
        const tasa = dif / lote.cantidadAnunciadaKg;
        out.textContent = (dif >= 0 ? "+" : "") + nf(dif) + " kg (" + pctFirmado(tasa) + ")";
        out.className = Math.abs(tasa) <= 0.01 ? "ok" : Math.abs(tasa) <= 0.03 ? "" : "bajo";
      }
    });
  }

  function formRechazar(loteId) {
    const lote = DB.get("lotes", loteId);
    if (!lote) return;

    abrirFormulario("Rechazar lote " + lote.codigoLote, [
      { tipo: "html", contenido: fichaResumen(lote) },
      { nombre: "motivo", etiqueta: "Motivo del rechazo", tipo: "textarea", requerido: true,
        marcador: "Por qué la fruta no ingresa a planta.",
        validar: function (v) { return v.length < 10 ? "Explica el motivo con al menos 10 caracteres: queda como constancia para el proveedor." : null; } }
    ], function (d) {
      DB.update("lotes", lote.id, {
        estado: "Rechazado",
        fechaRecepcion: DB.hoy(),
        cantidadRecibidaKg: 0,
        calidadVerificada: "C",
        observacionesRecepcion: d.motivo,
        recibidoPor: usuario.id
      });
      DB.registrarBitacora(usuario.id, "Rechazo de lote", lote.codigoLote + " · " + d.motivo);
      aviso("Lote " + lote.codigoLote + " rechazado.", "alerta");
      render();
    }, { aceptar: "Rechazar lote", nota: "El lote quedará <strong>Rechazado</strong> y no entrará a producción." });
  }

  /* 3) Producción registra el proceso y reparte la merma por causa. */
  function formProcesar(loteId) {
    const lote = DB.get("lotes", loteId);
    if (!lote) return;
    if (lote.estado !== "Recibido") {
      aviso("Ese lote no está disponible para procesar.", "alerta");
      return;
    }

    const fruta = DB.get("frutas", lote.frutaId);
    const campos = [
      { tipo: "html", contenido: fichaResumen(lote) },
      { nombre: "fecha", etiqueta: "Fecha de proceso", tipo: "date", valor: DB.hoy(), requerido: true, ancho: "mitad",
        validar: function (v) {
          if (v > DB.hoy()) return "La fecha no puede ser futura.";
          if (v < lote.fechaRecepcion) return "No se puede procesar antes de recibir el lote (" + fechaLarga(lote.fechaRecepcion) + ").";
          return null;
        } },
      { nombre: "turno", etiqueta: "Turno", tipo: "select", ancho: "mitad", valor: "Matutino",
        opciones: [{ valor: "Matutino", texto: "Matutino" }, { valor: "Vespertino", texto: "Vespertino" },
          { valor: "Nocturno", texto: "Nocturno" }] },
      { nombre: "productoId", etiqueta: "Producto obtenido", tipo: "select", requerido: true, ancho: "mitad", vacio: "Seleccione…",
        opciones: DB.all("productos").map(function (p) { return { valor: p.id, texto: p.nombre }; }) },
      { nombre: "operador", etiqueta: "Responsable de línea", tipo: "text", requerido: true, ancho: "mitad", valor: usuario.nombre },
      { nombre: "kgProcesados", etiqueta: "Kg ingresados a proceso", tipo: "number", requerido: true,
        min: 1, max: lote.cantidadRecibidaKg, paso: "0.1", ancho: "mitad", valor: lote.cantidadRecibidaKg,
        ayuda: "El lote trajo " + nf(lote.cantidadRecibidaKg) + " kg." },
      { nombre: "kgExportable", etiqueta: "Kg exportables obtenidos", tipo: "number", requerido: true,
        min: 0, paso: "0.1", ancho: "mitad",
        validar: function (v, d) {
          if (Number(d.kgProcesados) && v > Number(d.kgProcesados)) {
            return "Lo exportable no puede superar los kilogramos ingresados a proceso.";
          }
          return null;
        } },
      { nombre: "horasHombre", etiqueta: "Horas-hombre empleadas", tipo: "number", min: 0, paso: "0.5", ancho: "mitad" },
      { nombre: "tasaCalc", etiqueta: "Tasa de exportable", tipo: "calculado", ancho: "mitad",
        ayuda: "Meta de " + esc(fruta ? fruta.nombre : "la fruta") + ": " + pct(fruta ? fruta.metaExportable : 0) + "." },
      { nombre: "mermas", etiqueta: "Reparto de la merma por causa", tipo: "mermas",
        ayuda: "La suma de las causas debe cuadrar con la merma total (procesado − exportable). Es el balance de materia del lote.",
        validar: function (v, d) {
          const proc = Number(d.kgProcesados) || 0;
          const expo = Number(d.kgExportable) || 0;
          const objetivo = proc - expo;
          if (objetivo <= 0) return null;
          const suma = v.reduce(function (a, m) { return a + m.kg; }, 0);
          const dif = Math.abs(suma - objetivo);
          if (dif > Math.max(1, objetivo * 0.005)) {
            return "El balance no cuadra: la merma total es <strong>" + nf(objetivo, 1) +
              " kg</strong> pero las causas suman <strong>" + nf(suma, 1) + " kg</strong>. " +
              "Faltan por asignar " + nf(objetivo - suma, 1) + " kg.";
          }
          const repetidas = {};
          for (let i = 0; i < v.length; i += 1) {
            if (repetidas[v[i].causaId]) return "Hay una causa de merma repetida. Únelas en una sola fila.";
            repetidas[v[i].causaId] = true;
          }
          return null;
        } },
      { nombre: "observaciones", etiqueta: "Observaciones del turno", tipo: "textarea",
        marcador: "Paradas de línea, novedades, incidencias del lote." }
    ];

    abrirFormulario("Procesar lote " + lote.codigoLote, campos, function (d) {
      const prod = DB.insert("producciones", {
        folio: DB.siguienteFolio("producciones", "PRD"),
        fecha: d.fecha,
        loteId: lote.id,
        codigoLote: lote.codigoLote,
        frutaId: lote.frutaId,
        productoId: d.productoId,
        turno: d.turno,
        kgProcesados: Number(d.kgProcesados),
        kgExportable: Number(d.kgExportable),
        mermas: d.mermas,
        horasHombre: Number(d.horasHombre) || 0,
        operador: d.operador,
        observaciones: d.observaciones || "",
        registradoPor: usuario.id,
        creadoEn: new Date().toISOString()
      });
      DB.update("lotes", lote.id, { estado: "Procesado" });
      DB.registrarBitacora(usuario.id, "Registro de producción",
        prod.folio + " · lote " + lote.codigoLote + " · tasa exportable " +
        pct(prod.kgProcesados > 0 ? prod.kgExportable / prod.kgProcesados : 0));
      aviso("Producción " + prod.folio + " registrada. El lote pasa a Supervisión para su cierre.");
      render();
    }, {
      aceptar: "Registrar producción",
      ancho: true,
      alCambiar: function (d, form) {
        const proc = Number(d.kgProcesados) || 0;
        const expo = Number(d.kgExportable) || 0;

        const out = $("#tasaCalc", form);
        if (out) {
          if (proc <= 0 || expo <= 0) { out.textContent = "—"; out.className = ""; }
          else {
            const t = expo / proc;
            const meta = fruta ? fruta.metaExportable : 0.6;
            out.textContent = pct(t) + (t >= meta ? " ✓ sobre la meta" : " ✕ bajo la meta");
            out.className = t >= meta ? "ok" : "bajo";
          }
        }

        /* Balance en vivo: cuánta merma falta repartir entre causas. */
        const balance = $("#balanceMermas", form);
        if (balance) {
          const objetivo = proc - expo;
          const suma = leerMermas(form).reduce(function (a, m) { return a + m.kg; }, 0);
          if (objetivo <= 0) {
            balance.className = "balance";
            balance.innerHTML = "Indica primero los kilogramos procesados y exportables.";
          } else {
            const falta = objetivo - suma;
            const ok = Math.abs(falta) <= Math.max(1, objetivo * 0.005);
            balance.className = "balance " + (ok ? "balance-ok" : "balance-pendiente");
            balance.innerHTML = "Merma total: <strong>" + nf(objetivo, 1) + " kg</strong> · " +
              "asignado: <strong>" + nf(suma, 1) + " kg</strong> · " +
              (ok ? "balance cuadrado ✓"
                  : (falta > 0 ? "faltan <strong>" + nf(falta, 1) + " kg</strong>"
                               : "sobran <strong>" + nf(-falta, 1) + " kg</strong>"));
          }
        }
      }
    });
  }

  /* 4) Supervisión cierra el lote y envía el reporte al proveedor. */
  function cerrarLote(loteId) {
    const lote = DB.get("lotes", loteId);
    if (!lote || lote.estado !== "Procesado") return;
    const ficha = Indicadores.fichaLote(loteId);

    abrirFormulario("Cerrar lote " + lote.codigoLote, [
      { tipo: "html", contenido: fichaCompleta(ficha) },
      { nombre: "enviar", etiqueta: "", tipo: "checkbox", valor: true,
        textoCheck: "Enviar el reporte del lote al proveedor al cerrar" }
    ], function (d) {
      DB.update("lotes", lote.id, {
        estado: "Cerrado",
        fechaCierre: DB.hoy(),
        cerradoPor: usuario.id,
        reporteEnviado: !!d.enviar,
        fechaReporte: d.enviar ? DB.hoy() : null
      });
      DB.registrarBitacora(usuario.id, "Cierre de lote",
        lote.codigoLote + (d.enviar ? " · reporte enviado al proveedor" : " · sin envío de reporte"));
      aviso("Lote " + lote.codigoLote + " cerrado." + (d.enviar ? " Reporte enviado al proveedor." : ""));
      render();
    }, {
      aceptar: "Cerrar lote",
      ancho: true,
      nota: "Una vez cerrado, el lote <strong>no admite más cambios</strong> de ningún rol."
    });
  }

  /* ---------------------------------------------------- ficha del lote */

  function fichaResumen(lote) {
    return '<div class="ficha-mini">' +
      "<div><span>Lote</span><strong>" + esc(lote.codigoLote) + "</strong></div>" +
      "<div><span>Proveedor</span><strong>" + esc(Indicadores.nombreProveedor(lote.proveedorId)) + "</strong></div>" +
      "<div><span>Fruta</span><strong>" + esc(Indicadores.nombreFruta(lote.frutaId)) + "</strong></div>" +
      "<div><span>Anunciado</span><strong>" + nf(lote.cantidadAnunciadaKg) + " kg</strong></div>" +
      (lote.cantidadRecibidaKg !== null
        ? "<div><span>Pesado</span><strong>" + nf(lote.cantidadRecibidaKg) + " kg</strong></div>" : "") +
      "</div>";
  }

  /* La ficha completa es a la vez la pantalla de revisión de Supervisión y
     el reporte que recibe el proveedor: una sola fuente de verdad. */
  function fichaCompleta(f) {
    if (!f) return "<p>Lote no encontrado.</p>";
    const l = f.lote;
    const p = f.produccion;

    let html = '<div class="ficha">';

    html += '<div class="ficha-linea">' +
      '<div class="ficha-hito' + " hito-hecho" + '"><span class="hito-punto">1</span>' +
      "<strong>Anunciado</strong><small>" + fechaLarga(l.fecha) + "<br>" +
      esc(Indicadores.nombreUsuario(l.anunciadoPor)) + "</small></div>";
    html += '<div class="ficha-hito' + (l.cantidadRecibidaKg !== null ? " hito-hecho" : "") + '"><span class="hito-punto">2</span>' +
      "<strong>" + (l.estado === "Rechazado" ? "Rechazado" : "Pesado") + "</strong><small>" +
      (l.fechaRecepcion ? fechaLarga(l.fechaRecepcion) + "<br>" + esc(Indicadores.nombreUsuario(l.recibidoPor)) : "Pendiente") +
      "</small></div>";
    html += '<div class="ficha-hito' + (p ? " hito-hecho" : "") + '"><span class="hito-punto">3</span>' +
      "<strong>Procesado</strong><small>" + (p ? fechaLarga(p.fecha) + "<br>" + esc(p.operador) : "Pendiente") + "</small></div>";
    html += '<div class="ficha-hito' + (l.estado === "Cerrado" ? " hito-hecho" : "") + '"><span class="hito-punto">4</span>' +
      "<strong>Cerrado</strong><small>" + (l.fechaCierre ? fechaLarga(l.fechaCierre) + "<br>" + esc(Indicadores.nombreUsuario(l.cerradoPor)) : "Pendiente") + "</small></div>";
    html += "</div>";

    html += '<div class="ficha-bloques">';

    html += '<section><h4>Identificación</h4><dl>' +
      "<dt>Lote</dt><dd><code>" + esc(l.codigoLote) + "</code></dd>" +
      "<dt>Folio</dt><dd>" + esc(l.folio) + "</dd>" +
      "<dt>Proveedor</dt><dd>" + esc(f.proveedor ? f.proveedor.nombre : "—") + "</dd>" +
      "<dt>Fruta</dt><dd>" + esc(f.fruta ? f.fruta.nombre : "—") + "</dd>" +
      "<dt>Transporte</dt><dd>" + esc(l.transporte) + "</dd>" +
      "<dt>Estado</dt><dd>" + insignia(l.estado) + "</dd></dl></section>";

    html += '<section><h4>Peso y calidad</h4><dl>' +
      "<dt>Anunciado</dt><dd>" + nf(l.cantidadAnunciadaKg) + " kg (calidad " + esc(l.calidadDeclarada) + ")</dd>" +
      "<dt>Pesado en báscula</dt><dd>" + (l.cantidadRecibidaKg === null ? "—" : nf(l.cantidadRecibidaKg) + " kg (calidad " + esc(l.calidadVerificada) + ")") + "</dd>" +
      "<dt>Diferencia</dt><dd>" + (f.diferenciaKg === null ? "—" :
        '<span class="etq ' + (Math.abs(f.tasaDiferencia) <= 0.01 ? "etq-ok" : "etq-bajo") + '">' +
        (f.diferenciaKg >= 0 ? "+" : "") + nf(f.diferenciaKg) + " kg · " + pctFirmado(f.tasaDiferencia) + "</span>") + "</dd>" +
      "<dt>Precio acordado</dt><dd>" + money(l.precioUnitario) + " / kg</dd>" +
      "<dt>Valor a liquidar</dt><dd><strong>" + money(f.valor) + "</strong></dd></dl></section>";

    if (p) {
      html += '<section><h4>Resultado del proceso</h4><dl>' +
        "<dt>Producto</dt><dd>" + esc(Indicadores.nombreProducto(p.productoId)) + "</dd>" +
        "<dt>Procesado</dt><dd>" + nf(p.kgProcesados) + " kg</dd>" +
        "<dt>Exportable</dt><dd><strong>" + nf(p.kgExportable) + " kg</strong></dd>" +
        "<dt>Merma</dt><dd>" + nf(f.kgMerma) + " kg</dd>" +
        "<dt>Tasa exportable</dt><dd>" +
        '<span class="etq ' + (f.tasaExportable >= f.meta ? "etq-ok" : "etq-bajo") + '">' +
        pct(f.tasaExportable) + "</span> (meta " + pct(f.meta) + ")</dd>" +
        "<dt>Turno</dt><dd>" + esc(p.turno) + "</dd></dl></section>";

      html += '<section class="ficha-mermas"><h4>Causas de la merma</h4>';
      if (!f.mermas.length) {
        html += '<p class="tenue">Sin merma registrada.</p>';
      } else {
        html += '<ul class="lista-mermas">';
        f.mermas.forEach(function (m) {
          const c = DB.causaMerma(m.causaId);
          const parte = f.kgMerma > 0 ? m.kg / f.kgMerma : 0;
          html += "<li><span>" + esc(c ? c.nombre : m.causaId) +
            ' <small class="tenue">(' + esc(c ? c.tipo : "—") + ")</small></span>" +
            '<span class="barra-mini"><span style="width:' + (parte * 100).toFixed(1) + '%"></span></span>' +
            "<strong>" + nf(m.kg) + " kg</strong></li>";
        });
        html += "</ul>";
      }
      html += "</section>";
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
    const capa = document.createElement("div");
    capa.className = "modal-capa";
    capa.innerHTML = '<div class="modal modal-ancho" role="dialog" aria-modal="true" aria-labelledby="fichaTitulo">' +
      '<header class="modal-cab"><h2 id="fichaTitulo">Ficha del lote ' + esc(f.lote.codigoLote) + "</h2>" +
      '<button type="button" class="modal-x" aria-label="Cerrar">&times;</button></header>' +
      '<div class="modal-cuerpo modal-cuerpo-libre" id="hojaFicha">' + fichaCompleta(f) + "</div>" +
      '<footer class="modal-pie modal-pie-fijo">' +
      '<button type="button" class="btn btn-plano" data-cancelar>Cerrar</button>' +
      '<button type="button" class="btn btn-sec" id="btnImprimirFicha">Imprimir ficha</button>' +
      "</footer></div>";

    document.body.appendChild(capa);
    document.body.classList.add("sin-scroll");

    function cerrar() {
      capa.remove();
      document.body.classList.remove("sin-scroll");
      document.removeEventListener("keydown", onEsc);
      document.body.classList.remove("imprimiendo-ficha");
    }
    function onEsc(e) { if (e.key === "Escape") cerrar(); }

    document.addEventListener("keydown", onEsc);
    $(".modal-x", capa).addEventListener("click", cerrar);
    $("[data-cancelar]", capa).addEventListener("click", cerrar);
    capa.addEventListener("mousedown", function (e) { if (e.target === capa) cerrar(); });
    $("#btnImprimirFicha", capa).addEventListener("click", function () {
      document.body.classList.add("imprimiendo-ficha");
      window.print();
      setTimeout(function () { document.body.classList.remove("imprimiendo-ficha"); }, 800);
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
      { clave: "codigo", titulo: "Código", valor: function (p) { return "<code>" + esc(p.codigo) + "</code>"; } },
      { clave: "nombre", titulo: "Proveedor", valor: function (p) { return "<strong>" + esc(p.nombre) + "</strong>"; } },
      { clave: "documento", titulo: "RUC / Documento", valor: function (p) { return esc(p.documento); } },
      { clave: "contacto", titulo: "Contacto", valor: function (p) { return esc(p.contacto) + '<br><small class="tenue">' + esc(p.telefono) + "</small>"; } },
      { clave: "zona", titulo: "Zona", valor: function (p) { return esc(p.zona); } },
      { clave: "kg", titulo: "Kg históricos", num: true, valor: function (p) { return nf(resumen[p.id] ? resumen[p.id].kgRecibido : 0); } },
      { clave: "exactitud", titulo: "Exactitud de peso", num: true,
        valor: function (p) {
          const m = resumen[p.id];
          if (!m || !m.kgAnunciadoPesado) return '<span class="tenue">—</span>';
          const clase = Math.abs(m.tasaDiferenciaPeso) <= 0.01 ? "etq-ok"
            : Math.abs(m.tasaDiferenciaPeso) <= 0.03 ? "etq-B" : "etq-bajo";
          return '<span class="etq ' + clase + '">' + pctFirmado(m.tasaDiferenciaPeso) + "</span>";
        } },
      { clave: "activo", titulo: "Estado", valor: function (p) {
        return '<span class="estado estado-' + (p.activo ? "recibido" : "inactivo") + '">' +
          (p.activo ? "Activo" : "Inactivo") + "</span>";
      } },
      { clave: "acciones", titulo: "", valor: function (p) {
        return '<button class="btn-mini" data-editar-prov="' + esc(p.id) + '">Editar</button>' +
          '<button class="btn-mini" data-toggle-prov="' + esc(p.id) + '">' +
          (p.activo ? "Desactivar" : "Activar") + "</button>";
      } }
    ];

    html += tabla(columnas, lista, { vacio: "No hay proveedores registrados." });
    html += '<p class="nota-info">La <strong>exactitud de peso</strong> compara lo que el proveedor ' +
      "anuncia contra lo que marca la báscula. Un valor negativo sostenido significa que declara de más.</p>";
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
      '<p class="sub">Quién entra al sistema y con qué rol del proceso.</p></div></div>';

    const columnas = [
      { clave: "nombre", titulo: "Nombre", valor: function (u) { return "<strong>" + esc(u.nombre) + "</strong>"; } },
      { clave: "rol", titulo: "Rol", valor: function (u) {
        const r = DB.ROLES.find(function (x) { return x.id === u.rol; });
        return '<span class="etq etq-rol">' + esc(r ? r.icono + " " + r.nombre : u.rol) + "</span>";
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
    html += '<p class="nota-seguridad">⚠️ Prototipo académico: se entra eligiendo rol y escribiendo el ' +
      "nombre, sin contraseña. Es cómodo para planta, pero cualquiera puede declararse de cualquier rol. " +
      "Antes de un uso real hace falta autenticación en el servidor. Ver <code>app/README.md</code> §11.</p>";
    return html;
  }

  /* ------------------------------------------------------------ reportes */

  const REPORTES = {
    proveedor: {
      titulo: "Consolidado por proveedor",
      descripcion: "Volumen entregado, exactitud de peso, calidad y resultado en planta. " +
        "Es el documento que sustenta la liquidación de cada proveedor.",
      datos: function (f) { return Indicadores.porProveedor(f); },
      columnas: [
        { clave: "nombre", titulo: "Proveedor", valor: function (m) { return "<strong>" + esc(m.nombre) + "</strong>"; }, csv: function (m) { return m.nombre; } },
        { clave: "lotes", titulo: "Lotes", num: true, valor: function (m) { return nf(m.lotes); }, csv: function (m) { return m.lotes; } },
        { clave: "kgAnunciado", titulo: "Anunciado kg", num: true, valor: function (m) { return nf(m.kgAnunciado); }, csv: function (m) { return m.kgAnunciado; } },
        { clave: "kgRecibido", titulo: "Pesado kg", num: true, valor: function (m) { return nf(m.kgRecibido); }, csv: function (m) { return m.kgRecibido; } },
        { clave: "tasaDiferenciaPeso", titulo: "Dif. peso", num: true,
          valor: function (m) {
            const clase = Math.abs(m.tasaDiferenciaPeso) <= 0.01 ? "etq-ok" : Math.abs(m.tasaDiferenciaPeso) <= 0.03 ? "etq-B" : "etq-bajo";
            return '<span class="etq ' + clase + '">' + pctFirmado(m.tasaDiferenciaPeso) + "</span>";
          },
          csv: function (m) { return (m.tasaDiferenciaPeso * 100).toFixed(2); } },
        { clave: "pctCalidadA", titulo: "% Calidad A", num: true, valor: function (m) { return pct(m.pctCalidadA); }, csv: function (m) { return (m.pctCalidadA * 100).toFixed(2); } },
        { clave: "tasaRechazo", titulo: "% Rechazo", num: true, valor: function (m) { return pct(m.tasaRechazo); }, csv: function (m) { return (m.tasaRechazo * 100).toFixed(2); } },
        { clave: "precioPromedio", titulo: "Precio prom./kg", num: true, valor: function (m) { return money(m.precioPromedio); }, csv: function (m) { return m.precioPromedio.toFixed(4); } },
        { clave: "valor", titulo: "Valor a liquidar", num: true, valor: function (m) { return "<strong>" + money(m.valor) + "</strong>"; }, csv: function (m) { return m.valor.toFixed(2); } },
        { clave: "tasaExportable", titulo: "Tasa exportable", num: true, valor: function (m) { return pct(m.tasaExportable); }, csv: function (m) { return (m.tasaExportable * 100).toFixed(2); } }
      ]
    },
    fruta: {
      titulo: "Rendimiento por fruta",
      descripcion: "Compara la tasa de exportable real de cada fruta contra su meta técnica. " +
        "La brecha señala dónde se está perdiendo producto.",
      datos: function (f) { return Indicadores.porFruta(f); },
      columnas: [
        { clave: "nombre", titulo: "Fruta", valor: function (m) { return "<strong>" + esc(m.nombre) + "</strong>"; }, csv: function (m) { return m.nombre; } },
        { clave: "kgRecibido", titulo: "Recibido kg", num: true, valor: function (m) { return nf(m.kgRecibido); }, csv: function (m) { return m.kgRecibido; } },
        { clave: "kgProcesados", titulo: "Procesado kg", num: true, valor: function (m) { return nf(m.kgProcesados); }, csv: function (m) { return m.kgProcesados; } },
        { clave: "kgExportable", titulo: "Exportable kg", num: true, valor: function (m) { return nf(m.kgExportable); }, csv: function (m) { return m.kgExportable; } },
        { clave: "kgMerma", titulo: "Merma kg", num: true, valor: function (m) { return nf(m.kgMerma); }, csv: function (m) { return m.kgMerma; } },
        { clave: "tasaExportable", titulo: "Tasa real", num: true, valor: function (m) { return pct(m.tasaExportable); }, csv: function (m) { return (m.tasaExportable * 100).toFixed(2); } },
        { clave: "meta", titulo: "Meta", num: true, valor: function (m) { return pct(m.meta); }, csv: function (m) { return (m.meta * 100).toFixed(2); } },
        { clave: "brecha", titulo: "Brecha", num: true,
          valor: function (m) { return '<span class="etq ' + (m.brecha >= 0 ? "etq-ok" : "etq-bajo") + '">' + pctFirmado(m.brecha) + "</span>"; },
          csv: function (m) { return (m.brecha * 100).toFixed(2); } }
      ]
    },
    mermas: {
      titulo: "Análisis de mermas (Pareto)",
      descripcion: "Cuánta fruta se pierde por cada causa y de dónde viene el problema: " +
        "del campo, del transporte o de la propia planta.",
      datos: function (f) { return Indicadores.porCausaMerma(f); },
      columnas: [
        { clave: "nombre", titulo: "Causa", valor: function (m) { return "<strong>" + esc(m.nombre) + "</strong>"; }, csv: function (m) { return m.nombre; } },
        { clave: "tipo", titulo: "Origen", valor: function (m) { return '<span class="etq etq-rol">' + esc(m.tipo) + "</span>"; }, csv: function (m) { return m.tipo; } },
        { clave: "kg", titulo: "Kg perdidos", num: true, valor: function (m) { return nf(m.kg); }, csv: function (m) { return m.kg; } },
        { clave: "porcentaje", titulo: "% del total", num: true, valor: function (m) { return pct(m.porcentaje); }, csv: function (m) { return (m.porcentaje * 100).toFixed(2); } },
        { clave: "acumulado", titulo: "% acumulado", num: true,
          valor: function (m) { return '<span class="etq ' + (m.acumulado <= 0.8 ? "etq-bajo" : "etq-ok") + '">' + pct(m.acumulado) + "</span>"; },
          csv: function (m) { return (m.acumulado * 100).toFixed(2); } }
      ]
    },
    lotes: {
      titulo: "Detalle de lotes",
      descripcion: "Trazabilidad línea por línea: del anuncio del proveedor al cierre del lote.",
      datos: function (f) { return Indicadores.filtrar(f).lotes; },
      columnas: null
    },
    produccion: {
      titulo: "Detalle de producción",
      descripcion: "Registro línea por línea de cada lote procesado en el salón de producción.",
      datos: function (f) { return Indicadores.filtrar(f).producciones; },
      columnas: null
    }
  };

  function columnasReporte(tipo) {
    if (tipo === "lotes") return columnasLote({ acciones: false });
    if (tipo === "produccion") return columnasProduccion();
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

    html += barraFiltros({ calidad: reporteActual === "lotes", estado: reporteActual === "lotes" });

    html += '<section class="hoja" id="hojaReporte">';
    html += '<header class="hoja-cab"><div><h2>' + esc(def.titulo) + "</h2>" +
      '<p class="sub">' + esc(def.descripcion) + "</p></div>" +
      '<div class="hoja-meta"><p><strong>Período:</strong> ' + fechaLarga(f.desde) + " — " + fechaLarga(f.hasta) + "</p>" +
      "<p><strong>Emitido:</strong> " + fechaLarga(DB.hoy()) + "</p>" +
      "<p><strong>Por:</strong> " + esc(usuario.nombre) + "</p></div></header>";

    html += '<div class="hoja-kpis">' +
      '<div><span>Kg recibidos</span><strong>' + nf(k.kgRecibido) + "</strong></div>" +
      '<div><span>Dif. de peso</span><strong>' + pctFirmado(k.tasaDiferenciaPeso) + "</strong></div>" +
      '<div><span>Kg procesados</span><strong>' + nf(k.kgProcesados) + "</strong></div>" +
      '<div><span>Kg exportables</span><strong>' + nf(k.kgExportable) + "</strong></div>" +
      '<div><span>Tasa exportable</span><strong>' + pct(k.tasaExportable) + "</strong></div>" +
      '<div><span>Merma</span><strong>' + pct(k.tasaMerma) + "</strong></div>" +
      '<div><span>Valor compras</span><strong>' + money(k.valorCompra) + "</strong></div>" +
      "</div>";

    if (reporteActual === "mermas") {
      html += '<div class="hoja-grafico">' + Graficos.pareto(datos, { titulo: "Pareto de causas" }) + "</div>";
    }

    html += tabla(columnas, datos, { vacio: "No hay información para el filtro seleccionado." });
    html += '<footer class="hoja-pie"><p>AgroRegistro · Sistema de registro y control de producción ' +
      "frutícola · Documento generado automáticamente el " + fechaLarga(DB.hoy()) + ".</p></footer>";
    html += "</section>";

    return html;
  }

  /* ------------------------------------------------------------ bitácora */

  function vistaBitacora() {
    let html = '<div class="vista-cab"><div><h1>Bitácora del sistema</h1>' +
      '<p class="sub">Trazabilidad: quién registró qué y cuándo.</p></div></div>';

    html += tabla([
      { clave: "fecha", titulo: "Fecha y hora", valor: function (b) { return new Date(b.fecha).toLocaleString("es-EC"); } },
      { clave: "usuario", titulo: "Usuario", valor: function (b) { return esc(Indicadores.nombreUsuario(b.usuarioId)); } },
      { clave: "accion", titulo: "Acción", valor: function (b) { return "<strong>" + esc(b.accion) + "</strong>"; } },
      { clave: "detalle", titulo: "Detalle", valor: function (b) { return esc(b.detalle); } }
    ], DB.all("bitacora"), { vacio: "Todavía no hay movimientos registrados." });

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
      ["Causas de merma", DB.CAUSAS_MERMA.length],
      ["Lotes", db.lotes.length], ["Producciones", db.producciones.length],
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

    html += '<section class="panel"><h2>Dónde se guardan los datos</h2>';
    if (DB.esCompartido()) {
      html += "<p><strong>Modo compartido.</strong> Los datos viven en el almacén del " +
        "sistema, no en este navegador: lo que registra el proveedor desde su celular lo " +
        "ve recepción en el suyo al instante. Puedes abrir la misma dirección en varios " +
        "dispositivos a la vez para probarlo.</p>" +
        "<p>Los cambios llegan solos; no hace falta recargar.</p>";
    } else {
      html += "<p><strong>Modo local.</strong> Todo se guarda en el <code>localStorage</code> " +
        "de este navegador: persiste entre sesiones en este equipo, pero no se comparte " +
        "con otras computadoras ni celulares.</p>" +
        "<p>Para probar entre dispositivos, abre la versión publicada del sistema.</p>";
    }
    html += "</section>";

    return html;
  }

  /* ================================ login ============================== */

  function vistaLogin() {
    let html = '<div class="login-capa"><div class="login-caja">' +
      '<div class="login-marca"><span class="logo">🍍</span>' +
      "<div><strong>AgroRegistro</strong><small>Sistema de registro y control de producción frutícola</small></div></div>" +
      '<p class="login-intro">Elige tu rol en el proceso y escribe tu nombre para empezar.</p>' +
      '<form id="formLogin" novalidate>' +
      '<fieldset class="roles"><legend>¿Cuál es tu rol?</legend>';

    DB.ROLES.forEach(function (r, i) {
      html += '<label class="rol-tarjeta">' +
        '<input type="radio" name="rol" value="' + esc(r.id) + '"' + (i === 0 ? " checked" : "") + ">" +
        '<span class="rol-cuerpo"><span class="rol-icono" aria-hidden="true">' + r.icono + "</span>" +
        '<span><strong>' + esc(r.nombre) + "</strong><small>" + esc(r.lema) + "</small></span></span></label>";
    });
    html += "</fieldset>";

    html += '<div class="campo" id="campoProveedor" hidden><label for="loginProveedor">¿Qué proveedor eres?</label>' +
      '<select id="loginProveedor" name="proveedorId"><option value="">Selecciona…</option>';
    DB.all("proveedores").filter(function (p) { return p.activo; }).forEach(function (p) {
      html += '<option value="' + esc(p.id) + '">' + esc(p.nombre) + "</option>";
    });
    html += "</select></div>";

    html += '<div class="campo"><label for="loginNombre">Tu nombre</label>' +
      '<input type="text" id="loginNombre" name="nombre" autocomplete="name" placeholder="Nombre y apellido" required></div>' +
      '<p class="form-error" id="loginError" role="alert" hidden></p>' +
      '<button type="submit" class="btn btn-primario btn-ancho">Entrar</button></form>';

    html += '<div class="login-demo"><p>Personas de la demostración:</p><ul>';
    DB.all("usuarios").slice(0, 6).forEach(function (u) {
      const r = DB.ROLES.find(function (x) { return x.id === u.rol; });
      html += '<li><button type="button" class="demo" data-nombre="' + esc(u.nombre) + '" data-rol="' +
        esc(u.rol) + '" data-prov="' + esc(u.proveedorId || "") + '">' + esc(u.nombre) + "</button> — " +
        esc(r ? r.nombre : u.rol) + "</li>";
    });
    html += "</ul></div></div></div>";
    return html;
  }

  function enlazarLogin() {
    const form = $("#formLogin");
    const error = $("#loginError");
    const campoProv = $("#campoProveedor");

    function sincronizarProveedor() {
      const rol = form.querySelector("input[name=rol]:checked").value;
      campoProv.hidden = rol !== "proveedor";
    }

    $$("input[name=rol]", form).forEach(function (r) {
      r.addEventListener("change", sincronizarProveedor);
    });
    sincronizarProveedor();

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const rol = form.querySelector("input[name=rol]:checked").value;
      const r = iniciarSesion(rol, form.nombre.value, form.proveedorId.value);
      if (r.error) {
        error.textContent = r.error;
        error.hidden = false;
        return;
      }
      render();
      aviso("Bienvenido, " + usuario.nombre + ".");
    });

    $$(".demo").forEach(function (b) {
      b.addEventListener("click", function () {
        form.querySelector('input[name=rol][value="' + b.dataset.rol + '"]').checked = true;
        sincronizarProveedor();
        if (b.dataset.prov) form.proveedorId.value = b.dataset.prov;
        form.nombre.value = b.dataset.nombre;
        form.querySelector("button[type=submit]").focus();
      });
    });
  }

  /* =============================== render ============================== */

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
    const compartido = DB.esCompartido();
    html += "</nav><div class='lateral-pie'>" +
      '<p class="sincro sincro-' + (compartido ? "on" : "off") + '">' +
      '<span class="sincro-punto" aria-hidden="true"></span>' +
      (compartido ? "Datos compartidos" : "Solo este equipo") + "</p>" +
      '<p class="tenue sincro-ayuda">' +
      (compartido
        ? "Lo que registres aquí lo ven al instante los demás dispositivos."
        : "Los datos se guardan solo en este navegador.") + "</p>" +
      "<p class='tenue'>v3.0 · prototipo de tesis</p></div></aside>";

    html += '<div class="principal">';
    html += '<header class="barra"><button class="menu-btn" id="btnMenu" aria-label="Abrir menú" aria-expanded="false">☰</button>' +
      '<div class="barra-usuario"><div class="avatar" aria-hidden="true">' +
      esc(rol ? rol.icono : usuario.nombre.charAt(0)) + "</div><div><strong>" + esc(usuario.nombre) + "</strong>" +
      "<small>" + esc(rol ? rol.nombre : usuario.rol) +
      (usuario.proveedorId ? " · " + esc(Indicadores.nombreProveedor(usuario.proveedorId)) : "") +
      "</small></div>" +
      '<button class="btn btn-plano" id="btnSalir">Salir</button></div></header>';

    html += '<main id="contenido" tabindex="-1">';
    if (vistaActual === "panel") html += vistaPanel();
    else if (vistaActual === "lotes") html += vistaLotes();
    else if (vistaActual === "recepcion") html += vistaRecepcion();
    else if (vistaActual === "produccion") html += vistaProduccion();
    else if (vistaActual === "reportes") html += vistaReportes();
    else if (vistaActual === "proveedores") html += vistaProveedores();
    else if (vistaActual === "usuarios") html += vistaUsuarios();
    else if (vistaActual === "bitacora") html += vistaBitacora();
    else if (vistaActual === "datos") html += vistaDatos();
    html += "</main></div></div>";

    app.innerHTML = html;
    enlazar();
  }

  /* ============================== eventos ============================= */

  function enlazar() {
    $$("[data-ir]").forEach(function (b) {
      b.addEventListener("click", function () {
        ir(b.dataset.ir);
        const lat = $("#lateral");
        if (lat) lat.classList.remove("abierto");
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
        filtros.estado = d.get("estado") || "";
        render();
      });
    }

    const btnLimpiar = $("#btnLimpiar");
    if (btnLimpiar) {
      btnLimpiar.addEventListener("click", function () {
        filtros = { desde: DB.diasAtras(30), hasta: DB.hoy(), proveedorId: "", frutaId: "", calidad: "", estado: "" };
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

    /* --- ciclo de vida del lote --- */
    const btnAnunciar = $("#btnAnunciar");
    if (btnAnunciar) btnAnunciar.addEventListener("click", formAnunciar);

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
        const lote = DB.get("lotes", b.dataset.reabrir);
        if (!lote) return;
        if (!confirm("¿Reabrir el lote " + lote.codigoLote + "? Volverá al estado Procesado y quedará constancia en la bitácora.")) return;
        DB.update("lotes", lote.id, { estado: "Procesado", fechaCierre: null, cerradoPor: null });
        DB.registrarBitacora(usuario.id, "Reapertura de lote", lote.codigoLote);
        aviso("Lote " + lote.codigoLote + " reabierto.", "alerta");
        render();
      });
    });

    $$("[data-enviar]").forEach(function (b) {
      b.addEventListener("click", function () {
        const lote = DB.get("lotes", b.dataset.enviar);
        if (!lote) return;
        DB.update("lotes", lote.id, { reporteEnviado: true, fechaReporte: DB.hoy() });
        DB.registrarBitacora(usuario.id, "Envío de reporte", lote.codigoLote + " · " +
          Indicadores.nombreProveedor(lote.proveedorId));
        aviso("Reporte del lote " + lote.codigoLote + " enviado al proveedor.");
        render();
      });
    });

    /* --- exportaciones --- */
    const btnCsvLotes = $("#btnCsvLotes");
    if (btnCsvLotes) {
      btnCsvLotes.addEventListener("click", function () {
        descargarCSV("lotes", columnasLote({ acciones: false }),
          Indicadores.filtrar(filtrosEfectivos()).lotes);
      });
    }

    const btnCsvProd = $("#btnCsvProduccion");
    if (btnCsvProd) {
      btnCsvProd.addEventListener("click", function () {
        descargarCSV("produccion", columnasProduccion(),
          Indicadores.filtrar(filtrosEfectivos()).producciones);
      });
    }

    const btnCsvRep = $("#btnCsvReporte");
    if (btnCsvRep) {
      btnCsvRep.addEventListener("click", function () {
        descargarCSV("reporte_" + reporteActual, columnasReporte(reporteActual),
          REPORTES[reporteActual].datos(filtrosEfectivos()));
      });
    }

    const btnImprimir = $("#btnImprimir");
    if (btnImprimir) btnImprimir.addEventListener("click", function () { window.print(); });

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
        descargarCSV("proveedores", [
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

    /* --- usuarios --- */
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

    /* --- datos del sistema --- */
    const btnExp = $("#btnExportarJSON");
    if (btnExp) {
      btnExp.addEventListener("click", function () {
        descargar(new Blob([DB.exportar()], { type: "application/json" }),
          "agroregistro_respaldo_" + DB.hoy() + ".json");
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
        const compartido = DB.esCompartido();
        if (!confirm("Se borrarán todos los registros" +
            (compartido ? " para todos los dispositivos conectados" : "") +
            " y se cargarán los datos de demostración. ¿Continuar?")) return;
        btnReset.disabled = true;
        btnReset.textContent = "Reiniciando…";
        Promise.resolve(DB.reset()).then(function () {
          aviso("Sistema reiniciado con datos de demostración.");
          render();
        }).catch(function () {
          aviso("No se pudo reiniciar el almacén compartido.", "error");
          btnReset.disabled = false;
          btnReset.textContent = "Reiniciar con datos de demostración";
        });
      });
    }
  }

  /* =============================== arranque ============================ */

  /* Repintado tras un cambio llegado de otro dispositivo. Se agrupa: varias
     suscripciones pueden entregar a la vez y no hace falta un render por cada
     una. El modal vive fuera de #app, asi que un repintado no interrumpe a
     quien este llenando un formulario. */
  let repintadoPendiente = null;

  function repintarPorSincronizacion() {
    if (repintadoPendiente) return;
    repintadoPendiente = setTimeout(function () {
      repintadoPendiente = null;
      render();
    }, 200);
  }

  function arrancar() {
    prepararGuardado();
    DB.load();
    restaurarSesion();
    render();

    DB.alFallarEscritura(function (codigo) {
      aviso(codigo === "quota_exceeded"
        ? "El almacén compartido está lleno. Reinicia los datos desde Datos del sistema."
        : "No se pudo guardar el cambio en el almacén compartido.", "error");
    });

    DB.conectar(repintarPorSincronizacion).then(function (m) {
      render();
      if (m === "compartido") {
        aviso("Conectado. Los datos se comparten con los demás dispositivos.");
      }
    });
  }

  /* Si el script se evalua cuando el DOM ya esta listo, DOMContentLoaded no
     volvera a dispararse: hay que arrancar de inmediato. */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", arrancar);
  } else {
    arrancar();
  }
})();
