/* =========================================================================
   empaquetar.js — Arma el archivo único que se publica como artefacto.

   El artefacto es una sola página: no hay servidor que sirva core/, ni
   módulos, ni build. Este script concatena los mismos archivos que usa el
   desarrollo, en el orden en que las dependencias lo exigen, para que lo
   publicado y lo versionado no puedan separarse.

       node tools/empaquetar.js            → dist/sistema-flp.html

   Las dos aplicaciones comparten dirección a propósito: el almacén de datos
   pertenece a la página, así que separarlas en dos direcciones les daría dos
   repositorios distintos y dejarían de consolidarse.
   ========================================================================= */

const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const APP = path.join(RAIZ, "app");
const SALIDA = path.join(RAIZ, "dist", "sistema-flp.html");

/* El orden importa: auth y db no dependen de nadie; indicadores necesita db;
   ui es transversal; las dos aplicaciones van al final, y el enrutador
   después de las dos, porque las monta. */
const GUION = [
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

  window.FLP_RUTAS = { proveedor: "#/proveedor", interno: "#/planta" };

  function portada() {
    document.getElementById("app").innerHTML =
      '<main class="portada">' +
      '<header class="portada-cab">' +
      '<p class="portada-eyebrow">F.L.P. Latinoamerican Perishables del Ecuador S.A.</p>' +
      "<h1>Sistema FLP</h1>" +
      '<p class="portada-sub">Trazabilidad, control de pérdidas y economía circular en las ' +
      "líneas de pitahaya roja, tomate de árbol y granadilla.</p></header>" +

      '<div class="portada-apps">' +
      '<a class="portada-app portada-app-ext" href="#/proveedor">' +
      '<span class="portada-icono" aria-hidden="true">🚜</span>' +
      "<h2>Portal del Proveedor</h2>" +
      "<p>Para las fincas y cooperativas. Anuncian sus envíos desde el celular y " +
      "siguen el resultado de cada lote.</p>" +
      '<span class="portada-cta">Entrar al portal &rarr;</span></a>' +

      '<a class="portada-app portada-app-int" href="#/planta">' +
      '<span class="portada-icono" aria-hidden="true">🏭</span>' +
      "<h2>Sistema de Planta</h2>" +
      "<p>Uso interno. Recepción pesa, Producción registra pérdidas por causa raíz " +
      "y Supervisión planifica el día, costea las causas y cierra los lotes.</p>" +
      '<span class="portada-cta">Entrar al sistema &rarr;</span></a></div>' +

      '<section class="portada-nota">' +
      "<h3>Las dos aplicaciones comparten un solo repositorio</h3>" +
      "<p>Lo que un proveedor anuncia en el portal aparece al instante en la cola de " +
      "recepción de la planta. Todo lo que la planta registra sobre ese lote vuelve " +
      "al proveedor como reporte. Un solo dato, capturado una sola vez, por quien " +
      "lo conoce de primera mano.</p>" +
      '<p class="portada-prueba"><strong>Para probarlo:</strong> abre esta misma ' +
      "dirección en dos dispositivos —o en dos pestañas— y entra en cada uno por " +
      "una puerta distinta.</p></section></main>";
    document.body.classList.add("portada-body");
  }

  function montar() {
    const ruta = location.hash.replace(/^#\\/?/, "");
    document.body.classList.remove("portada-body");

    if (ruta === "/proveedor" || ruta === "proveedor") {
      window.PortalProveedor.iniciar();
    } else if (ruta === "/planta" || ruta === "planta") {
      window.PlantaFLP.iniciar();
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
partes.push('<meta name="apple-mobile-web-app-title" content="Sistema FLP">');
partes.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
partes.push("<title>Sistema FLP</title>\n");
partes.push('<link rel="preconnect" href="https://fonts.googleapis.com">');
partes.push('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
partes.push('<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700' +
  '&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">\n');
partes.push("<style>\n" + leer("core/estilos.css") + "\n</style>\n");
partes.push('<a class="salto" href="#contenido">Saltar al contenido</a>');
partes.push('<div id="app" aria-live="polite"></div>');
partes.push('<div id="avisos" class="avisos" aria-live="polite"></div>\n');

GUION.forEach(function (rel) {
  partes.push("<script>\n" + leer(rel) + "\n<\/script>\n");
});
partes.push("<script>\n" + ENRUTADOR + "\n<\/script>\n");

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
const ACOMPANAN = ["pwa/manifest.json", "pwa/icono-192.png", "pwa/icono-512.png"];
ACOMPANAN.forEach(function (rel) {
  const destino = path.join(path.dirname(SALIDA), rel === "pwa/manifest.json" ? "manifest.json" : rel);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.copyFileSync(path.join(APP, rel), destino);
});
console.log("Paquete escrito en " + path.relative(RAIZ, SALIDA) +
  " · " + (html.length / 1024).toFixed(0) + " KB · " + (GUION.length + 1) + " bloques");
