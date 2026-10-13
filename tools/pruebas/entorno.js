/* =========================================================================
   entorno.js — Lo que toda suite necesita antes de empezar

   Las suites anteriores repetían en cada archivo la ruta de Chromium, la
   dirección del servidor y el mismo armazón de «✓ / ✗». Repetirlo tiene dos
   costes: la ruta de Chromium cambia con la versión del contenedor y había
   que corregirla en veinte sitios, y cada suite contaba sus fallos a su
   manera, de modo que ejecutarlas todas no daba un resultado, daba veinte.

   Aquí está una vez. El hook de arranque (.claude/hooks/session-start.sh)
   deja las variables puestas; si no están, se adivinan, para que una suite
   pueda ejecutarse suelta sin ceremonia.
   ========================================================================= */
const fs = require("fs");
const { execFileSync } = require("child_process");

/* ------------------------------------------------------------- dónde */

function chromium() {
  if (process.env.ACOPIA_CHROMIUM && fs.existsSync(process.env.ACOPIA_CHROMIUM)) {
    return process.env.ACOPIA_CHROMIUM;
  }
  /* La versión va en el nombre de la carpeta y cambia con el contenedor:
     se busca en vez de escribirla. */
  const base = "/opt/pw-browsers";
  if (fs.existsSync(base)) {
    const dir = fs.readdirSync(base)
      .filter(function (n) { return /^chromium-\d+$/.test(n); })
      .sort().pop();
    if (dir) {
      const ruta = base + "/" + dir + "/chrome-linux/chrome";
      if (fs.existsSync(ruta)) return ruta;
    }
  }
  return undefined;   // que Playwright use el suyo
}

const BASE = process.env.ACOPIA_BASE || "http://localhost:8199/app";
const SITIO = process.env.ACOPIA_SITIO || "http://localhost:8202";
const PG = (process.env.ACOPIA_PG || "-h /var/tmp -p 5433 -U postgres").split(/\s+/);

/* --------------------------------------------------------- navegador */

async function navegador(opciones) {
  const { chromium: motor } = require("playwright");
  return motor.launch(Object.assign({
    executablePath: chromium(),
    args: ["--no-sandbox"]
  }, opciones || {}));
}

/* El celular de planta: 390 px, táctil, como el de quien pesa en el patio. */
const MOVIL = { viewport: { width: 390, height: 820 }, isMobile: true, hasTouch: true };
const ESCRITORIO = { viewport: { width: 1400, height: 950 } };

/* ------------------------------------------------------------ armazón */

/* Una suite es un nombre y una función. `paso` apunta cada comprobación y
   sigue adelante cuando una falla: parar en la primera esconde las otras
   diecinueve, y entonces cada vuelta solo enseña un problema. */
function suite(nombre) {
  const errores = [];
  let bloque = "";

  return {
    bloque: function (t) { bloque = t; console.log("\n" + t); },

    paso: async function (n, fn) {
      try {
        await fn();
        console.log("  ✓ " + n);
      } catch (e) {
        const msg = (e && e.message ? e.message : String(e)).split("\n")[0];
        console.log("  ✗ " + n + " → " + msg);
        errores.push((bloque ? bloque + " · " : "") + n + ": " + msg);
      }
    },

    /* Un error de la página no lo nota ninguna comprobación —la pantalla
       simplemente deja de responder— así que se recoge aparte y hunde la
       suite igual. */
    vigilar: function (pagina, etiqueta) {
      pagina.on("pageerror", function (e) {
        errores.push((etiqueta || "página") + ": " + e.message);
        console.log("  ✗ error en " + (etiqueta || "la página") + " → " + e.message);
      });
      return pagina;
    },

    fin: function () {
      if (errores.length) {
        console.log("\n" + nombre + ": FALLOS (" + errores.length + ")");
        process.exitCode = 1;
      } else {
        console.log("\n" + nombre + ": todo en orden.");
      }
      return errores.length;
    },

    errores: errores
  };
}

/* ------------------------------------------------------- entrar */

/* Las dos aplicaciones piden lo mismo en la misma pantalla. */
async function entrar(p, usuario, clave, espera) {
  await p.waitForSelector("#acceso", { timeout: 25000 });
  await p.fill("#acceso", usuario);
  await p.fill("#clave", clave);
  await p.click("#btnEntrar");
  if (espera) await p.waitForSelector(espera, { timeout: 25000 });
}

/* ------------------------------------------------------- PostgreSQL */

/* Solo para las suites que necesitan la base real. Se habla por `psql`:
   el proyecto no tiene dependencias y las pruebas tampoco. */
function psql(texto) {
  return execFileSync("psql", PG.concat(["-v", "ON_ERROR_STOP=1", "-t", "-A", "-q", "-f", "-"]),
    { input: texto, encoding: "utf8" }).trim();
}

function hayPostgres() {
  try { psql("select 1;"); return true; } catch (e) { return false; }
}

module.exports = {
  BASE, SITIO, PG, MOVIL, ESCRITORIO,
  chromium, navegador, suite, entrar, psql, hayPostgres
};
