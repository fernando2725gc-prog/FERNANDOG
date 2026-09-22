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
        (c.ayuda ? '<small class="ayuda">' + esc(c.ayuda) + "</small>" : "") + "</div>";
    }

    /* Campo repetible: una fila por elemento, con columnas configurables.
       Lo usa el reparto de mermas (causa raíz + kg + destino). */
    if (c.tipo === "repetible") {
      return '<div class="campo campo-full repetible" data-repetible="' + esc(c.nombre) + '">' +
        "<label>" + esc(c.etiqueta) + "</label>" +
        (c.ayuda ? '<small class="ayuda">' + esc(c.ayuda) + "</small>" : "") +
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
      (c.ayuda ? '<small class="ayuda">' + esc(c.ayuda) + "</small>" : "") + "</div>";
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
        html += '<button type="button" class="btn-mini btn-mini-peligro rep-quitar" aria-label="Quitar fila">✕</button>';
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

  function guardarSesion(clave, valor) {
    try { sessionStorage.setItem(clave, valor); } catch (e) { /* modo privado */ }
  }

  function leerSesion(clave) {
    try { return sessionStorage.getItem(clave); } catch (e) { return null; }
  }

  function borrarSesion(clave) {
    try { sessionStorage.removeItem(clave); } catch (e) { /* noop */ }
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
    etiquetaLinea: etiquetaLinea,
    abrirFormulario: abrirFormulario, leerRepetible: leerRepetible,
    prepararGuardado: prepararGuardado, descargar: descargar, descargarCSV: descargarCSV,
    guardarSesion: guardarSesion, leerSesion: leerSesion, borrarSesion: borrarSesion,
    alArrancar: alArrancar
  };
})();
