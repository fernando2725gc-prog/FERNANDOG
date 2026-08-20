/* ============================================================
   Sonrisa Imperial — interacciones de la landing
   ============================================================ */
(function () {
  "use strict";

  /** Número de WhatsApp de la clínica (formato internacional, sin +). */
  var WHATSAPP = "525512345678";

  /* ---------- Menú móvil ---------- */
  var toggle = document.getElementById("navToggle");
  var nav = document.getElementById("nav");

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    });

    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------- Año del footer ---------- */
  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------- Fecha mínima = hoy ---------- */
  var fecha = document.getElementById("fecha");
  if (fecha) {
    var hoy = new Date();
    var iso = new Date(hoy.getTime() - hoy.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
    fecha.min = iso;
  }

  /* ---------- Animación al hacer scroll ---------- */
  var animables = document.querySelectorAll(
    ".card, .member, .quote, .steps li, .feature-list, .hero-card, .faq details"
  );

  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    animables.forEach(function (el, i) {
      el.classList.add("reveal");
      el.style.transitionDelay = (i % 3) * 80 + "ms";
      observer.observe(el);
    });
  }

  /* ---------- Validación del formulario de cita ---------- */
  var form = document.getElementById("bookingForm");
  if (!form) return;

  var success = document.getElementById("formSuccess");
  var successName = document.getElementById("successName");

  var REGLAS = {
    nombre: function (v) {
      if (!v.trim()) return "Escribe tu nombre completo.";
      if (v.trim().length < 3) return "El nombre es demasiado corto.";
      return "";
    },
    telefono: function (v) {
      var digitos = v.replace(/\D/g, "");
      if (!digitos) return "Necesitamos un teléfono para confirmarte.";
      if (digitos.length < 10) return "Ingresa 10 dígitos, incluida la lada.";
      return "";
    },
    email: function (v) {
      if (!v.trim()) return ""; // opcional
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())
        ? ""
        : "Revisa el formato del correo.";
    },
    servicio: function (v) {
      return v ? "" : "Selecciona el motivo de tu cita.";
    },
    fecha: function (v) {
      if (!v) return "Elige una fecha preferida.";
      var hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      var elegida = new Date(v + "T00:00:00");
      if (elegida < hoy) return "La fecha no puede ser anterior a hoy.";
      if (elegida.getDay() === 0) return "Los domingos permanecemos cerrados.";
      return "";
    },
    horario: function (v) {
      return v ? "" : "Selecciona un horario preferido.";
    },
    aviso: function (_v, campo) {
      return campo.checked ? "" : "Necesitamos tu autorización para contactarte.";
    }
  };

  function mostrarError(campo, mensaje) {
    var contenedor = campo.closest(".field");
    var salida = form.querySelector('[data-error-for="' + campo.name + '"]');
    if (contenedor) contenedor.classList.toggle("invalid", Boolean(mensaje));
    if (salida) salida.textContent = mensaje;
    campo.setAttribute("aria-invalid", mensaje ? "true" : "false");
  }

  function validarCampo(campo) {
    var regla = REGLAS[campo.name];
    if (!regla) return true;
    var mensaje = regla(campo.value, campo);
    mostrarError(campo, mensaje);
    return !mensaje;
  }

  Object.keys(REGLAS).forEach(function (nombre) {
    var campo = form.elements[nombre];
    if (!campo) return;
    campo.addEventListener("blur", function () { validarCampo(campo); });
    campo.addEventListener("input", function () {
      if (campo.closest(".field").classList.contains("invalid")) validarCampo(campo);
    });
    campo.addEventListener("change", function () { validarCampo(campo); });
  });

  function formatearFecha(valor) {
    try {
      return new Date(valor + "T00:00:00").toLocaleDateString("es-MX", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      });
    } catch (e) {
      return valor;
    }
  }

  function construirMensaje(datos) {
    var lineas = [
      "Hola Sonrisa Imperial, quiero agendar una cita:",
      "",
      "• Nombre: " + datos.nombre,
      "• Teléfono: " + datos.telefono,
      datos.email ? "• Correo: " + datos.email : "",
      "• Motivo: " + datos.servicio,
      "• Fecha preferida: " + formatearFecha(datos.fecha),
      "• Horario preferido: " + datos.horario,
      datos.mensaje ? "• Notas: " + datos.mensaje : ""
    ].filter(Boolean);

    return lineas.join("\n");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var valido = true;
    var primerError = null;

    Object.keys(REGLAS).forEach(function (nombre) {
      var campo = form.elements[nombre];
      if (!campo) return;
      if (!validarCampo(campo)) {
        valido = false;
        if (!primerError) primerError = campo;
      }
    });

    if (!valido) {
      if (primerError) primerError.focus();
      return;
    }

    var datos = {
      nombre: form.elements.nombre.value.trim(),
      telefono: form.elements.telefono.value.trim(),
      email: form.elements.email.value.trim(),
      servicio: form.elements.servicio.value,
      fecha: form.elements.fecha.value,
      horario: form.elements.horario.value,
      mensaje: form.elements.mensaje.value.trim()
    };

    var url =
      "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(construirMensaje(datos));
    window.open(url, "_blank", "noopener");

    if (successName) successName.textContent = datos.nombre.split(" ")[0];
    if (success) {
      success.hidden = false;
      success.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    form.reset();
    Object.keys(REGLAS).forEach(function (nombre) {
      var campo = form.elements[nombre];
      if (campo) mostrarError(campo, "");
    });
  });
})();
