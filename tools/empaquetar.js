/* =========================================================================
   empaquetar.js — Arma el archivo único que se publica como artefacto.

   El artefacto es una sola página: no hay servidor que sirva core/, ni
   módulos, ni build. Este script concatena los mismos archivos que usa el
   desarrollo, en el orden en que las dependencias lo exigen, para que lo
   publicado y lo versionado no puedan separarse.

       node tools/empaquetar.js            → dist/acopia.html

   Las dos aplicaciones comparten dirección a propósito: el almacén de datos
   pertenece a la página, así que separarlas en dos direcciones les daría dos
   repositorios distintos y dejarían de consolidarse.
   ========================================================================= */

const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const APP = path.join(RAIZ, "app");
const SALIDA = path.join(RAIZ, "dist", "acopia.html");

/* El orden importa: auth y db no dependen de nadie; indicadores necesita db;
   ui es transversal; las dos aplicaciones van al final, y el enrutador
   después de las dos, porque las monta. */
const GUION = [
  "core/nube-config.js",
  "core/nube.js",
  "core/sesion.js",
  "core/excel.js",
  "core/auth.js",
  "core/db.js",
  "core/indicadores.js",
  "core/graficos.js",
  "core/ui.js",
  "core/novedades.js",
  "core/guia.js",
  "proveedor/portal.js",
  "interno/planta.js"
];

function leer(rel) { return fs.readFileSync(path.join(APP, rel), "utf8"); }

const ENRUTADOR = `/* =========================================================================
   Paquete de las dos aplicaciones en una sola dirección.
   ========================================================================= */
(function () {
  "use strict";

  window.AC_RUTAS = { proveedor: "#/proveedor", interno: "#/planta" };

  function portada() {
    document.getElementById("app").innerHTML =
      '<main class="portada"><header class="portada-hero"><div class="portada-hero-cuerpo"><div class="portada-sello"><svg class="ico portada-marca" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 10.5h16l-1.3 8.6a1.7 1.7 0 0 1-1.7 1.4H7a1.7 1.7 0 0 1-1.7-1.4z M12 10.5V6.2M12 8.4C9.8 8.4 8.2 6.8 8.2 4.6c2.2 0 3.8 1.6 3.8 3.8zM12 7.6c0-2.2 1.6-3.8 3.8-3.8 0 2.2-1.6 3.8-3.8 3.8z"/></svg></div><h1>Acopia</h1><p class="portada-sub">Trazabilidad, control de pérdidas y economía circular para una planta exportadora de fruta fresca.</p><ul class="portada-lineas"><li><span class="portada-punto" style="background:var(--linea-1)"></span>Pitahaya roja</li><li><span class="portada-punto" style="background:var(--linea-2)"></span>Tomate de árbol</li><li><span class="portada-punto" style="background:var(--linea-3)"></span>Granadilla</li></ul></div></header><div class="portada-cuerpo"><div class="portada-apps"><a class="portada-app portada-app-ext" href="#/proveedor"><span class="portada-icono-caja"><svg class="ico portada-icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 21v-9M12 14C9 14 6.8 11.8 6.8 8.8 9.8 8.8 12 11 12 14zM12 12c0-3 2.2-5.2 5.2-5.2 0 3-2.2 5.2-5.2 5.2z"/></svg></span><span class="portada-quien">Para las fincas y cooperativas</span><h2>Portal del Proveedor</h2><p>Anuncian sus envíos desde el celular y siguen el resultado de cada lote: cuánto llegó, cuánto salió a exportación y cuánto se paga.</p><span class="portada-cta">Entrar al portal <span aria-hidden="true">&rarr;</span></span></a><a class="portada-app portada-app-int" href="#/planta"><span class="portada-icono-caja"><svg class="ico portada-icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 20.5h18M4.5 20.5V11l4.6 2.6V11L13.7 13.6V9l6.3 3.6v7.9M7.5 20.5v-3.2h3.2v3.2"/></svg></span><span class="portada-quien">Uso interno de la planta</span><h2>Sistema de Planta</h2><p>Recepción pesa, Producción registra las pérdidas por causa raíz y Supervisión planifica el día, costea las causas y cierra los lotes.</p><span class="portada-cta">Entrar al sistema <span aria-hidden="true">&rarr;</span></span></a></div><section class="portada-nota"><h3>Un solo dato, capturado una sola vez</h3><p>Lo que un proveedor anuncia en el portal aparece al instante en la cola de recepción de la planta, y todo lo que la planta registra sobre ese lote vuelve al proveedor como reporte. Nadie vuelve a teclear lo que otro ya escribió.</p></section><p class="portada-pie">Acopia · prototipo del trabajo de integración curricular</p></div></main>';
    document.body.classList.add("portada-body");
  }

  function montar() {
    const ruta = location.hash.replace(/^#\\/?/, "");
    document.body.classList.remove("portada-body");

    if (ruta === "/proveedor" || ruta === "proveedor") {
      window.PortalProveedor.iniciar();
    } else if (ruta === "/planta" || ruta === "planta") {
      window.PlantaApp.iniciar();
    } else {
      portada();
    }
  }

  /* Cambiar de aplicación recarga la página: cada una monta su propia sesión
     y su propio estado, y así no se mezclan. */
  window.addEventListener("hashchange", function () { location.reload(); });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", montar);
  } else { montar(); }
})();`;

/* El service worker tiene que ser un archivo aparte —así lo exige el
   navegador— y solo se registra donde puede funcionar: contexto seguro y
   con la página servida, no abierta con file://. */
const REGISTRO_SW = `(function () {
  "use strict";
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && location.hostname !== "localhost") return;
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js", { scope: "./" })
      .then(function (reg) { window.AC_SW = reg; })
      .catch(function (e) {
        /* Sin él la app sigue funcionando: solo necesita señal para abrir. */
        console.warn("No se pudo preparar el uso sin conexión:", e && e.message);
      });
  });
})();`;

const partes = [];
/* Sin charset explícito el navegador lee el archivo como latin-1 y toda la
   página sale con acentos rotos. El anfitrión del artefacto añade el suyo,
   pero el archivo tiene que sostenerse solo. */
partes.push('<meta charset="utf-8">');
/* Instalable en el celular: con esto, «Añadir a pantalla de inicio» deja un
   icono propio y la app abre a pantalla completa, sin barra de navegador.
   El manifiesto y los iconos viajan como archivos sueltos junto a la
   página; no pueden ir dentro del HTML. */
partes.push('<link rel="manifest" href="manifest.json">');
partes.push('<meta name="theme-color" content="#14313f">');
partes.push('<link rel="apple-touch-icon" href="pwa/icono-192.png">');
partes.push('<meta name="apple-mobile-web-app-capable" content="yes">');
partes.push('<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">');
partes.push('<meta name="apple-mobile-web-app-title" content="Acopia">');
partes.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
partes.push("<title>Acopia</title>\n");
partes.push('<link rel="preconnect" href="https://fonts.googleapis.com">');
partes.push('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
partes.push('<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800' +
  '&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">\n');
partes.push("<style>\n" + leer("core/estilos.css") + "\n</style>\n");
partes.push('<a class="salto" href="#contenido">Saltar al contenido</a>');
partes.push('<div id="app" aria-live="polite"></div>');
partes.push('<div id="avisos" class="avisos" aria-live="polite"></div>\n');

GUION.forEach(function (rel) {
  partes.push("<script>\n" + leer(rel) + "\n<\/script>\n");
});
partes.push("<script>\n" + ENRUTADOR + "\n<\/script>\n");
partes.push("<script>\n" + REGISTRO_SW + "\n<\/script>\n");

const html = partes.join("\n");

/* Una etiqueta de cierre dentro de una cadena de JavaScript cerraría el
   <script> antes de tiempo y rompería la página entera, en silencio. */
const dentro = html.split("<script>").slice(1)
  .map(function (b) { return b.split("<\/script>")[0]; }).join("");
if (/<\/script/i.test(dentro)) {
  console.error("Hay una etiqueta </script> dentro del código: el paquete quedaría roto.");
  process.exit(1);
}

fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
fs.writeFileSync(SALIDA, html);

/* Los archivos sueltos de la instalación móvil se copian junto a la página,
   con la misma estructura que el manifiesto declara. */
const ACOMPANAN = ["pwa/manifest.json", "pwa/sw.js", "pwa/icono-192.png", "pwa/icono-512.png"];
/* El manifiesto y el service worker van en la raíz: el alcance de un
   service worker no puede subir por encima de su propia carpeta. */
const EN_RAIZ = { "pwa/manifest.json": "manifest.json", "pwa/sw.js": "sw.js" };
ACOMPANAN.forEach(function (rel) {
  const destino = path.join(path.dirname(SALIDA), EN_RAIZ[rel] || rel);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.copyFileSync(path.join(APP, rel), destino);
});
console.log("Paquete escrito en " + path.relative(RAIZ, SALIDA) +
  " · " + (html.length / 1024).toFixed(0) + " KB · " + (GUION.length + 1) + " bloques");

/* ------------------------------------------------- despliegue a la web

   `dist/` es lo que se sube como artefacto de Claude. `docs/` es lo mismo
   para un sitio web de verdad, que es lo que hace falta para instalar la
   app en el celular: un artefacto no puede registrar un service worker ni
   dejar un icono en la pantalla de inicio.

   La única diferencia es el nombre de la página: un sitio sirve `index.html`
   cuando se pide la carpeta, y el service worker necesita exactamente eso
   para poder devolver la app sin conexión.

   GitHub Pages publica esta carpeta tal cual. El `.nojekyll` evita que
   Jekyll se meta a procesarla y se coma archivos por el camino. */
const WEB = path.join(RAIZ, "docs");
fs.mkdirSync(path.join(WEB, "pwa"), { recursive: true });
fs.writeFileSync(path.join(WEB, "index.html"), html);
fs.writeFileSync(path.join(WEB, ".nojekyll"), "");
ACOMPANAN.forEach(function (rel) {
  fs.copyFileSync(path.join(APP, rel), path.join(WEB, EN_RAIZ[rel] || rel));
});
console.log("Sitio web escrito en docs/ (index.html + manifiesto + sw + iconos)");
