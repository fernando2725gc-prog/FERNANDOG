/* =========================================================================
   ui.js — Kit compartido por el Portal del Proveedor y el Sistema de Planta
   Formato de números, avisos, tablas, formularios y exportación.
   No sabe nada del dominio: eso vive en db.js e indicadores.js.
   ========================================================================= */

const UI = (function () {
  "use strict";

  const $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  const $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  /* ------------------------------------------------------------- formato */

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

  function money(n) { return "$" + nf(n, 2); }

  function cajas(n) { return nf(n) + (Math.abs(Number(n)) === 1 ? " caja" : " cajas"); }

  function minutos(n) {
    /* Se redondea ANTES de partir en horas y minutos. Redondear despues
       produce "70 h 60 min" cuando el resto cae en 59,6. */
    const total = Math.round(Number(n) || 0);
    if (total < 60) return nf(total) + " min";
    const h = Math.floor(total / 60);
    const m = total % 60;
    return nf(h) + " h" + (m ? " " + nf(m) + " min" : "");
  }

  function fechaLarga(iso) {
    if (!iso) return "—";
    const d = new Date(iso.length > 10 ? iso : iso + "T12:00:00");
    return d.toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
  }

  function fechaCorta(iso) {
    if (!iso) return "—";
    const d = new Date(iso.length > 10 ? iso : iso + "T12:00:00");
    return d.toLocaleDateString("es-EC", { day: "2-digit", month: "short" });
  }

  /* Insignia del origen del dato: M medido, E estimado, S secundario.
     El estándar de rigor del proyecto exige declararlo en cada parámetro. */
  function origen(id) {
    const o = DB.ORIGENES.find(function (x) { return x.id === id; });
    if (!o) return "";
    return '<abbr class="origen origen-' + esc(id) + '" title="' +
      esc(o.nombre + ": " + o.ayuda) + '">' + esc(id) + "</abbr>";
  }

  /* --------------------------------------------------------------- avisos */

  function aviso(mensaje, tipo) {
    let cont = $("#avisos");
    if (!cont) {
      cont = document.createElement("div");
      cont.id = "avisos";
      cont.className = "avisos";
      cont.setAttribute("aria-live", "polite");
      document.body.appendChild(cont);
    }
    const div = document.createElement("div");
    div.className = "aviso aviso-" + (tipo || "ok");
    div.setAttribute("role", "status");
    div.textContent = mensaje;
    cont.appendChild(div);
    setTimeout(function () { div.classList.add("saliendo"); }, 3400);
    setTimeout(function () { div.remove(); }, 3900);
  }

  /* --------------------------------------------------------------- tablas */

  /* La ayuda de un campo se escapa, porque puede venir de un dato. Cuando
     hace falta resaltar una cifra dentro de ella, se usa `ayudaHTML`, que
     es siempre texto escrito en el código, nunca de origen externo. */
  function textoAyuda(c) {
    if (c.ayudaHTML) return '<small class="ayuda">' + c.ayudaHTML + "</small>";
    if (c.ayuda) return '<small class="ayuda">' + esc(c.ayuda) + "</small>";
    return "";
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
      html += "<tr" + (o.filaClase ? ' class="' + o.filaClase(f) + '"' : "") + ">";
      columnas.forEach(function (c) {
        html += "<td" + (c.num ? ' class="num"' : "") + ">" + c.valor(f) + "</td>";
      });
      html += "</tr>";
    });
    html += "</tbody></table></div>";
    return html;
  }

  function kpi(etiqueta, valor, detalle, tono) {
    return '<article class="kpi kpi-' + (tono || "neutro") + '">' +
      '<p class="kpi-etiqueta">' + esc(etiqueta) + "</p>" +
      '<p class="kpi-valor">' + valor + "</p>" +
      '<p class="kpi-detalle">' + (detalle || "") + "</p></article>";
  }

  /* ------------------------------------------------------------- iconos */

  /* Un sistema de planta se imprime, se proyecta en una reunión y se mira
     en un celular a pleno sol. Los emoji no sirven para eso: cada sistema
     operativo los dibuja distinto, no heredan el color del texto y en un
     informe impreso salen como manchas. Este juego de iconos son trazos
     SVG de 24×24 con el mismo grosor y las mismas esquinas, que toman el
     color de donde estén. Están dibujados aquí, sin librería: el proyecto
     no tiene dependencias y no va a empezar a tenerlas por un icono. */
  const ICONOS = {
    brote: "M12 21v-7.5M12 13.5C8.4 13.5 6.5 11.6 6.5 8 10.1 8 12 9.9 12 13.5zM12 12.4c0-3.6 1.9-5.5 5.5-5.5 0 3.6-1.9 5.5-5.5 5.5z",
    balanza: "M12 4.2v16.6M8 20.8h8M4 7.5h16M4 7.5 1.4 13h5.2zM20 7.5 17.4 13h5.2z",
    planta: "M3 20.5h18M4.5 20.5V11l4.6 2.6V11L13.7 13.6V9l6.3 3.6v7.9M7.5 20.5v-3.2h3.2v3.2",
    portapapeles: "M9.4 4.2h5.2a1 1 0 0 1 1 1v1.1H8.4V5.2a1 1 0 0 1 1-1zM8.4 6.3H6.6A1.6 1.6 0 0 0 5 7.9v11.5a1.6 1.6 0 0 0 1.6 1.6h10.8a1.6 1.6 0 0 0 1.6-1.6V7.9a1.6 1.6 0 0 0-1.6-1.6h-1.8M9 11.6h6M9 15.4h4",
    grafico: "M4 20h16M7.3 20v-6.2M12 20V7.4M16.7 20v-9",
    calendario: "M5.4 6.2h13.2a1.4 1.4 0 0 1 1.4 1.4v11.4a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 19V7.6a1.4 1.4 0 0 1 1.4-1.4zM4 10.4h16M8.6 4v4.2M15.4 4v4.2",
    cronometro: "M12 21.2a7.8 7.8 0 1 0 0-15.6 7.8 7.8 0 0 0 0 15.6zM12 9.8v3.6l2.4 1.8M9.4 3h5.2M12 3v2.6",
    caja: "M3.6 8.4 12 4l8.4 4.4v7.2L12 20l-8.4-4.4zM3.6 8.4 12 12.8l8.4-4.4M12 12.8V20",
    documento: "M14 3.2H7.6A1.6 1.6 0 0 0 6 4.8v14.4a1.6 1.6 0 0 0 1.6 1.6h8.8a1.6 1.6 0 0 0 1.6-1.6V7.2zM14 3.2v4h4M9.2 13h5.6M9.2 16.6h3.6",
    recibo: "M6.2 3.4h11.6v17l-2.9-1.5-2.9 1.5-2.9-1.5-2.9 1.5zM9.2 8.2h5.6M9.2 12.2h5.6",
    dinero: "M4.6 7.2h14.8A1.6 1.6 0 0 1 21 8.8v6.4a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 15.2V8.8a1.6 1.6 0 0 1 1.6-1.6zM12 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2M6.4 12h.1M17.6 12h.1",
    engranaje: "M4 7h9M17 7h3M4 12h3M11 12h9M4 17h10M18 17h2M13 7a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM7 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM14 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0z",
    personas: "M9.4 11.4a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2zM2.6 20.4v-1.5c0-2.6 2.6-4.2 6.8-4.2s6.8 1.6 6.8 4.2v1.5M16.4 4.6a3.6 3.6 0 0 1 0 7.2M18.6 14.9c2.2.5 3.4 1.8 3.4 3.7v1.8",
    reloj: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.4V12l3 2.1",
    archivo: "M4.6 5.4h14.8A1.6 1.6 0 0 1 21 7v3.4a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 10.4V7a1.6 1.6 0 0 1 1.6-1.6zM4.6 12h14.8A1.6 1.6 0 0 1 21 13.6V17a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 17v-3.4A1.6 1.6 0 0 1 4.6 12zM10.2 8.7h3.6M10.2 15.3h3.6",
    libro: "M4 4.6h5.6A2.4 2.4 0 0 1 12 7v13.4a2.6 2.6 0 0 0-2.4-1.6H4zM20 4.6h-5.6A2.4 2.4 0 0 0 12 7v13.4a2.6 2.6 0 0 1 2.4-1.6H20z",
    casa: "M3.4 10.6 12 3.4l8.6 7.2M5.6 9.4v11h12.8v-11M10 20.4v-5.2h4v5.2",
    tendencia: "M4 20h16M5.4 16.4l4.8-5.2 3.6 2.9L19 7M14.8 7H19v4.2",
    llave: "M8.8 9a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2zM12.2 11.6H21M18.2 11.6v3.6M15.6 11.6v2.8",
    ojo: "M2.6 12S6.2 6.6 12 6.6 21.4 12 21.4 12 17.8 17.4 12 17.4 2.6 12 2.6 12zM12 14.8a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6z",
    campana: "M12 3.2A5.6 5.6 0 0 0 6.4 8.8c0 4-1.6 5.6-1.6 5.6h14.4s-1.6-1.6-1.6-5.6A5.6 5.6 0 0 0 12 3.2zM9.9 17.6a2.2 2.2 0 0 0 4.2 0",
    veto: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM7.8 12h8.4",
    check: "M4.8 12.6 9.6 17.4 19.2 6.8",
    listo: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.2 12.2l2.8 2.8 4.8-5.4",
    bandera: "M6 3.4v17.2M6 4.4h11.2l-2 3.6 2 3.6H6z",
    alerta: "M12 4.4 21 19.6H3zM12 10v4.2M12 17h.1",
    menu: "M4 7.2h16M4 12h16M4 16.8h16",
    equis: "M6.4 6.4l11.2 11.2M17.6 6.4 6.4 17.6",
    camion: "M3 7.4h9.6v8.4H3zM12.6 10.4h4.2l3.2 3.2v2.2h-7.4M7.2 18.6a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6zM17.4 18.6a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z",
    mas: "M12 5.4v13.2M5.4 12h13.2",
    reporte: "M6 3.4h12v17.2H6zM9 8h6M9 12h6M9 16h3.4"
  };

  /* El símbolo de la marca: una gaveta con un brote. Neutro a propósito,
     no lleva iniciales de nadie. */
  const MARCA_SVG =
    '<svg class="ico ico-marca" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M4 10.5h16l-1.3 8.6a1.7 1.7 0 0 1-1.7 1.4H7a1.7 1.7 0 0 1-1.7-1.4z"/>' +
    '<path d="M12 10.5V6.2M12 8.4C9.8 8.4 8.2 6.8 8.2 4.6c2.2 0 3.8 1.6 3.8 3.8zM12 7.6c0-2.2 1.6-3.8 3.8-3.8 0 2.2-1.6 3.8-3.8 3.8z"/>' +
    "</svg>";

  /* `nombre` es una llave de ICONOS; si no existe, no dibuja nada en vez de
     ensuciar la pantalla con un cuadrito. */
  function icono(nombre, clase) {
    if (nombre === "marca") {
      return clase ? MARCA_SVG.replace("ico-marca", "ico-marca " + clase) : MARCA_SVG;
    }
    const d = ICONOS[nombre];
    if (!d) return "";
    return '<svg class="ico' + (clase ? " " + clase : "") + '" viewBox="0 0 24 24" ' +
      'aria-hidden="true" focusable="false"><path d="' + d + '"/></svg>';
  }

  /* Icono + texto, que es como aparece en casi todos los menús. */
  function iconoTexto(nombre, texto) {
    return icono(nombre) + "<span>" + esc(texto) + "</span>";
  }

  /* ---------------------------------------------------------- campana */

  /* El botón y el panel son iguales en las dos aplicaciones; lo que cambia
     es a dónde lleva cada aviso, y de eso se encarga quien la monta. */
  function campana(sinVer) {
    return '<button class="btn btn-plano campana" id="btnCampana" aria-haspopup="true" ' +
      'aria-expanded="false" title="Novedades">' +
      icono("campana") +
      (sinVer > 0
        ? '<span class="campana-contador">' + (sinVer > 9 ? "9+" : sinVer) + "</span>" +
          '<span class="sr">' + sinVer + " novedades sin ver</span>"
        : '<span class="sr">Novedades</span>') + "</button>";
  }

  function panelNovedades(lista) {
    let html = '<div class="novedades" id="panelNovedades" role="dialog" ' +
      'aria-label="Novedades"><header class="novedades-cab"><strong>Novedades</strong>' +
      '<button type="button" class="modal-x" id="cerrarNovedades" aria-label="Cerrar">&times;</button>' +
      "</header>";

    if (!lista.length) {
      html += '<p class="novedades-vacio">Nada nuevo por ahora. Cuando algo cambie, ' +
        "aparecerá aquí.</p></div>";
      return html;
    }

    html += '<ul class="novedades-lista">';
    lista.forEach(function (n) {
      html += '<li class="novedad novedad-' + esc(n.tipo) + (n.nuevo ? " novedad-nueva" : "") +
        '"><button type="button" class="novedad-btn" data-novedad="' + esc(n.ir) + '"' +
        (n.lote ? ' data-novedad-lote="' + esc(n.lote) + '"' : "") + ">" +
        '<span class="novedad-icono" aria-hidden="true">' + icono(n.icono) + "</span>" +
        '<span class="novedad-texto"><strong>' + esc(n.titulo) + "</strong>" +
        "<small>" + esc(n.detalle) + "</small></span>" +
        '<span class="novedad-fecha">' + fechaCorta(n.fecha) + "</span>" +
        (n.nuevo ? '<span class="novedad-punto" aria-label="sin ver"></span>' : "") +
        "</button></li>";
    });
    return html + "</ul></div>";
  }

  function insignia(estado) {
    return '<span class="estado estado-' + esc(String(estado).toLowerCase()) + '">' +
      esc(estado) + "</span>";
  }

  /* Etiqueta de línea de producto con su color propio. */
  function etiquetaLinea(lineaId) {
    const l = DB.linea(lineaId);
    if (!l) return "—";
    return '<span class="linea-tag" style="--linea:' + esc(l.color) + '">' +
      '<span class="linea-punto" aria-hidden="true"></span>' + esc(l.nombre) + "</span>";
  }

  /* ---------------------------------------------------------- formularios */

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
      /* Un formulario que borra se confirma con un botón que lo parece. */
      '<button type="submit" class="btn ' + (o.peligro ? "btn-peligro" : "btn-primario") +
      '">' + esc(o.aceptar || "Guardar") + "</button>" +
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

    enlazarRepetibles(form, campos, o);

    if (o.alCambiar) {
      const refrescar = function () { o.alCambiar(leer(form, campos), form); };
      form.addEventListener("input", refrescar);
      form.addEventListener("change", refrescar);
      refrescar();
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

      /* Si el guardado es asíncrono —derivar una contraseña, por ejemplo— el
         formulario NO se cierra hasta que termina. Cerrarlo antes deja la
         operación en el aire: basta con que la persona salga enseguida para
         que el cambio se pierda sin avisar. */
      if (resultado && typeof resultado.then === "function") {
        const boton = $("button[type=submit]", form);
        const textoPrevio = boton.textContent;
        boton.disabled = true;
        boton.textContent = "Guardando…";
        resultado.then(function (r) {
          if (r && r.error) {
            error.innerHTML = r.error;
            error.hidden = false;
            boton.disabled = false;
            boton.textContent = textoPrevio;
            return;
          }
          cerrar();
        }).catch(function (e) {
          error.textContent = "No se pudo guardar: " + (e && e.message ? e.message : "error inesperado");
          error.hidden = false;
          boton.disabled = false;
          boton.textContent = textoPrevio;
        });
        return;
      }

      if (resultado && resultado.error) {
        error.innerHTML = resultado.error;
        error.hidden = false;
        return;
      }
      cerrar();
    });

    const primero = $("input:not([readonly]), select:not([disabled]), textarea", form);
    if (primero) primero.focus();
    return { cerrar: cerrar, form: form };
  }

  function campoHTML(c) {
    if (c.tipo === "separador") return '<h3 class="form-sep">' + esc(c.etiqueta) + "</h3>";
    if (c.tipo === "html") return '<div class="campo campo-full">' + c.contenido + "</div>";

    if (c.tipo === "calculado") {
      return '<div class="campo campo-' + (c.ancho || "full") + ' campo-calculado">' +
        "<label>" + esc(c.etiqueta) + '</label><output id="' + esc(c.nombre) + '">—</output>' +
        textoAyuda(c) + "</div>";
    }

    /* Campo repetible: una fila por elemento, con columnas configurables.
       Lo usa el reparto de mermas (causa raíz + kg + destino). */
    if (c.tipo === "repetible") {
      return '<div class="campo campo-full repetible" data-repetible="' + esc(c.nombre) + '">' +
        "<label>" + esc(c.etiqueta) + "</label>" +
        textoAyuda(c) +
        '<div class="rep-filas"></div>' +
        '<button type="button" class="btn btn-plano btn-sm rep-agregar">+ ' +
        esc(c.textoAgregar || "Agregar") + "</button>" +
        '<div class="balance" data-balance></div></div>';
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
      /* inputmode saca el teclado correcto en el móvil sin cambiar el tipo. */
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
      textoAyuda(c) + "</div>";
  }

  /* Filas dinámicas de un campo repetible. */
  function enlazarRepetibles(form, campos, opciones) {
    campos.filter(function (c) { return c.tipo === "repetible"; }).forEach(function (c) {
      const bloque = $('[data-repetible="' + c.nombre + '"]', form);
      if (!bloque) return;
      const filas = $(".rep-filas", bloque);

      function agregar(valores) {
        const div = document.createElement("div");
        div.className = "rep-fila";
        let html = "";
        c.columnas.forEach(function (col) {
          const v = (valores && valores[col.nombre]) || "";
          if (col.tipo === "select") {
            html += '<select class="rep-campo" data-campo="' + esc(col.nombre) + '" aria-label="' +
              esc(col.etiqueta) + '">';
            col.opciones().forEach(function (op) {
              html += '<option value="' + esc(op.valor) + '"' +
                (String(v) === String(op.valor) ? " selected" : "") + ">" + esc(op.texto) + "</option>";
            });
            html += "</select>";
          } else {
            html += '<input type="number" inputmode="decimal" class="rep-campo" data-campo="' +
              esc(col.nombre) + '" min="0" step="0.1" placeholder="' + esc(col.etiqueta) +
              '" value="' + esc(v) + '" aria-label="' + esc(col.etiqueta) + '">';
          }
        });
        html += '<button type="button" class="btn-mini btn-mini-peligro rep-quitar" aria-label="Quitar fila">' + icono("equis") + "</button>";
        div.innerHTML = html;
        div.querySelector(".rep-quitar").addEventListener("click", function () {
          div.remove();
          form.dispatchEvent(new Event("input", { bubbles: true }));
        });
        filas.appendChild(div);
      }

      $(".rep-agregar", bloque).addEventListener("click", function () {
        agregar(null);
        form.dispatchEvent(new Event("input", { bubbles: true }));
      });

      (opciones.filasIniciales && opciones.filasIniciales[c.nombre] || []).forEach(agregar);
      if (!filas.children.length) agregar(null);
    });
  }

  function leerRepetible(form, nombre, columnas) {
    const bloque = $('[data-repetible="' + nombre + '"]', form);
    if (!bloque) return [];
    return $$(".rep-fila", bloque).map(function (fila) {
      const out = {};
      columnas.forEach(function (col) {
        const el = $('[data-campo="' + col.nombre + '"]', fila);
        if (!el) return;
        out[col.nombre] = col.tipo === "select" ? el.value : (Number(el.value) || 0);
      });
      return out;
    }).filter(function (x) {
      return columnas.some(function (col) { return col.tipo !== "select" && x[col.nombre] > 0; });
    });
  }

  function leer(form, campos) {
    const datos = {};
    campos.forEach(function (c) {
      if (c.tipo === "separador" || c.tipo === "calculado" || c.tipo === "html") return;
      if (c.tipo === "repetible") {
        datos[c.nombre] = leerRepetible(form, c.nombre, c.columnas);
        return;
      }
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
        if (c.min !== undefined && v < c.min) {
          return "«" + esc(c.etiqueta) + "» no puede ser menor que " + nf(c.min, 1) + ".";
        }
        if (c.max !== undefined && v > c.max) {
          return "«" + esc(c.etiqueta) + "» no puede ser mayor que " + nf(c.max, 1) + ".";
        }
      }
      if (c.validar) {
        const err = c.validar(v, datos);
        if (err) return err;
      }
    }
    return null;
  }

  /* ---------------------------------------------------------- exportación */

  let guardadoDelVisor = null;

  function prepararGuardado() {
    if (typeof window === "undefined" || !window.claude ||
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
          if (e && e.code === "declined") return;
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
    descargar(new Blob(["﻿" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8;" }),
      nombre + "_" + DB.hoy() + ".csv");
  }

  /* ------------------------------------------------------------- sesión */

  /* La sesión puede vivir solo en la pestaña (por defecto) o recordarse en
     el dispositivo. En el celular del proveedor, recordarla es la
     diferencia entre usar la aplicación y abandonarla. */
  const DIAS_RECUERDO = 30;

  function abrirSesion(clave, usuarioId, recordar) {
    const dato = JSON.stringify({
      id: usuarioId,
      expira: Date.now() + DIAS_RECUERDO * 86400000
    });
    try {
      sessionStorage.setItem(clave, dato);
      if (recordar) localStorage.setItem(clave, dato);
      else localStorage.removeItem(clave);
    } catch (e) { /* modo privado */ }
  }

  function sesionAbierta(clave) {
    for (const almacen of ["sessionStorage", "localStorage"]) {
      try {
        const raw = window[almacen].getItem(clave);
        if (!raw) continue;
        const d = JSON.parse(raw);
        if (d && d.id && (!d.expira || d.expira > Date.now())) return d.id;
        window[almacen].removeItem(clave);
      } catch (e) { /* noop */ }
    }
    return null;
  }

  function cerrarSesion(clave) {
    try { sessionStorage.removeItem(clave); localStorage.removeItem(clave); }
    catch (e) { /* noop */ }
  }

  function guardarSesion(clave, valor) {
    try { sessionStorage.setItem(clave, valor); } catch (e) { /* modo privado */ }
  }

  function leerSesion(clave) {
    try { return sessionStorage.getItem(clave); } catch (e) { return null; }
  }

  function borrarSesion(clave) {
    try { sessionStorage.removeItem(clave); } catch (e) { /* noop */ }
  }

  /* ------------------------------------------- formularios en uso */

  /* Un repintado que llega solo —porque terminó la conexión o porque otro
     dispositivo cambió algo— no puede reconstruir la pantalla encima de
     alguien que está llenando un formulario: le borraría lo escrito. Aquí
     se marca cuándo hay un formulario empezado. */
  let formEnUso = false;

  function vigilarFormulario(form) {
    if (!form) return;
    const marcar = function () { formEnUso = true; };
    form.addEventListener("input", marcar);
    form.addEventListener("change", marcar);
  }

  function formularioEnUso() { return formEnUso; }

  /* Un repintado pedido por la propia persona sí puede seguir adelante. */
  function soltarFormulario() { formEnUso = false; }

  /* Decide si es seguro repintar ahora. Si no lo es, lo aplaza — pero SIEMPRE
     deja un reintento en marcha. Esperar solo al `blur` dejaba el cambio sin
     llegar nunca si la persona no volvía a tocar nada: quien mira la pantalla
     sin escribir tiene el mismo derecho a ver lo que pasó. */
  let reintentoPendiente = null;

  function repintarSiSeguro(repintar, reintentar) {
    const volver = function () { repintarSiSeguro(repintar, reintentar); };

    const activo = document.activeElement;
    const enCampo = activo && /^(INPUT|SELECT|TEXTAREA)$/.test(activo.tagName);

    if (enCampo || formEnUso) {
      if (enCampo) activo.addEventListener("blur", volver, { once: true });
      if (!reintentoPendiente) {
        reintentoPendiente = setTimeout(function () {
          reintentoPendiente = null;
          volver();
        }, 2500);
      }
      return false;
    }

    if (reintentoPendiente) { clearTimeout(reintentoPendiente); reintentoPendiente = null; }
    repintar();
    return true;
  }

  /* Enlace a la otra aplicación. Cambia según el despliegue: carpetas
     separadas en el repositorio, o rutas con # dentro de un solo paquete. */
  function rutaOtraApp(cual) {
    const rutas = (typeof window !== "undefined" && window.TF_RUTAS) || null;
    if (rutas && rutas[cual]) return 'href="' + rutas[cual] + '"';
    return 'href="../' + cual + '/"';
  }

  /* Arranca cuando el DOM esté listo, incluso si ya lo estaba. */
  function alArrancar(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else { fn(); }
  }

  return {
    $: $, $$: $$,
    esc: esc, nf: nf, pct: pct, pctFirmado: pctFirmado, money: money,
    cajas: cajas, minutos: minutos, fechaLarga: fechaLarga, fechaCorta: fechaCorta,
    origen: origen, aviso: aviso, tabla: tabla, kpi: kpi, insignia: insignia,
    campana: campana, panelNovedades: panelNovedades,
    icono: icono, iconoTexto: iconoTexto, ICONOS: ICONOS,
    etiquetaLinea: etiquetaLinea,
    abrirFormulario: abrirFormulario, leerRepetible: leerRepetible,
    prepararGuardado: prepararGuardado, descargar: descargar, descargarCSV: descargarCSV,
    abrirSesion: abrirSesion,
    sesionAbierta: sesionAbierta,
    cerrarSesion: cerrarSesion,
    guardarSesion: guardarSesion, leerSesion: leerSesion, borrarSesion: borrarSesion,
    vigilarFormulario: vigilarFormulario,
    formularioEnUso: formularioEnUso,
    soltarFormulario: soltarFormulario,
    repintarSiSeguro: repintarSiSeguro,
    rutaOtraApp: rutaOtraApp,
    alArrancar: alArrancar
  };
})();
