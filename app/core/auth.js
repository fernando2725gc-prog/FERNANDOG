/* =========================================================================
   auth.js — Credenciales de Acopia

   Las contraseñas NUNCA se guardan. Se guarda el resultado de derivarlas
   con PBKDF2-SHA256 y una sal distinta por persona, de modo que dos
   personas con la misma contraseña produzcan hashes distintos y no se
   pueda ir hacia atrás desde el almacén.

   Límite honesto de un prototipo sin servidor: quien pueda leer el almacén
   ve los hashes y puede intentar adivinarlos sin conexión. Por eso las
   iteraciones son altas y la política exige longitud. Un despliegue real
   debe verificar la contraseña en el servidor. Ver README §11.
   ========================================================================= */

const Auth = (function () {
  "use strict";

  const ITERACIONES = 150000;
  const LARGO_SAL = 16;
  const LARGO_CLAVE = 32;

  /* crypto.subtle solo existe en contexto seguro (https o localhost). Al
     abrir los archivos con file:// no está, y conviene decirlo en vez de
     fingir que la contraseña quedó protegida igual. */
  function disponible() {
    return typeof crypto !== "undefined" && crypto.subtle &&
      typeof crypto.subtle.deriveBits === "function";
  }

  function aHex(buffer) {
    return Array.prototype.map.call(new Uint8Array(buffer), function (b) {
      return b.toString(16).padStart(2, "0");
    }).join("");
  }

  function deHex(hex) {
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  }

  function salAleatoria() {
    const s = new Uint8Array(LARGO_SAL);
    crypto.getRandomValues(s);
    return aHex(s);
  }

  async function derivar(clave, salHex, iteraciones) {
    const material = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(clave), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({
      name: "PBKDF2", salt: deHex(salHex), iterations: iteraciones, hash: "SHA-256"
    }, material, LARGO_CLAVE * 8);
    return aHex(bits);
  }

  /* Reserva para contexto no seguro: sigue siendo con sal, pero es débil.
     Se marca como tal para que la interfaz pueda advertirlo. */
  function derivarDebil(clave, salHex) {
    let h = 0x811c9dc5;
    const texto = salHex + "|" + clave;
    for (let i = 0; i < texto.length; i += 1) {
      h ^= texto.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    let out = "";
    let x = h;
    for (let i = 0; i < 8; i += 1) {
      x = Math.imul(x ^ (x >>> 15), 0x2545f491) >>> 0;
      out += x.toString(16).padStart(8, "0");
    }
    return out;
  }

  async function crearCredencial(clave) {
    if (!disponible()) {
      const sal = "sinseguro" + Math.random().toString(36).slice(2, 10);
      return { algoritmo: "debil", sal: sal, hash: derivarDebil(clave, sal), iteraciones: 0 };
    }
    const sal = salAleatoria();
    return {
      algoritmo: "pbkdf2-sha256",
      sal: sal,
      iteraciones: ITERACIONES,
      hash: await derivar(clave, sal, ITERACIONES)
    };
  }

  async function verificar(clave, cred) {
    if (!cred || !cred.hash) return false;
    if (cred.algoritmo === "debil") return derivarDebil(clave, cred.sal) === cred.hash;
    if (!disponible()) return false;
    const h = await derivar(clave, cred.sal, cred.iteraciones || ITERACIONES);
    /* Comparación de tiempo constante: no revela cuánto acertó el intento. */
    if (h.length !== cred.hash.length) return false;
    let dif = 0;
    for (let i = 0; i < h.length; i += 1) dif |= h.charCodeAt(i) ^ cred.hash.charCodeAt(i);
    return dif === 0;
  }

  /* --------------------------------------------------------- política */

  /* Recepción y producción trabajan en terminales compartidos de planta,
     con guantes y a contraluz: ahí un PIN es más practicable que una
     contraseña larga, y el control de acceso físico lo acompaña.
     Supervisión y los proveedores sí llevan contraseña. */
  const POLITICAS = {
    proveedor: { min: 6, tipo: "text", nombre: "Contraseña",
      ayuda: "Al menos 6 caracteres. La planta te entrega una y la cambias al entrar." },
    recepcion: { min: 4, tipo: "pin", nombre: "PIN",
      ayuda: "4 a 8 dígitos. Es un terminal compartido de planta." },
    produccion: { min: 4, tipo: "pin", nombre: "PIN",
      ayuda: "4 a 8 dígitos. Es un terminal compartido de planta." },
    supervisor: { min: 8, tipo: "text", nombre: "Contraseña",
      ayuda: "Al menos 8 caracteres: este rol edita parámetros y cierra lotes." }
  };

  function politica(rol) { return POLITICAS[rol] || POLITICAS.proveedor; }

  function revisar(clave, rol) {
    const p = politica(rol);
    const v = String(clave || "");
    if (v.length < p.min) {
      return p.nombre + " demasiado corta: mínimo " + p.min +
        (p.tipo === "pin" ? " dígitos." : " caracteres.");
    }
    if (p.tipo === "pin" && !/^\d+$/.test(v)) return "El PIN debe ser solo números.";
    if (p.tipo === "pin" && v.length > 8) return "El PIN no puede pasar de 8 dígitos.";
    if (p.tipo === "text" && /^(\d)\1+$/.test(v)) return "Elige algo menos previsible.";
    return null;
  }

  /* Clave temporal legible en voz alta por teléfono, sin caracteres que se
     confundan (0/O, 1/l). La planta se la dicta al proveedor. */
  function claveTemporal(rol) {
    const p = politica(rol);
    if (p.tipo === "pin") {
      let pin = "";
      const d = new Uint32Array(4);
      crypto.getRandomValues(d);
      for (let i = 0; i < 4; i += 1) pin += String(d[i] % 10);
      return pin;
    }
    const abc = "ABCDEFGHJKMNPQRSTUVWXYZ";
    const num = "23456789";
    const r = new Uint32Array(8);
    crypto.getRandomValues(r);
    let out = "";
    for (let i = 0; i < 4; i += 1) out += abc[r[i] % abc.length];
    out += "-";
    for (let i = 4; i < 8; i += 1) out += num[r[i] % num.length];
    return out;
  }

  /* ----------------------------------------------------- intentos */

  /* Freno simple a la adivinación: tras varios fallos seguidos, la cuenta
     espera. Vive en el propio dispositivo, así que no sustituye a un
     control del servidor; sirve contra el intento manual. */
  const CLAVE_INTENTOS = "acopia.intentos";
  const MAX_INTENTOS = 5;
  const ESPERA_MS = 60000;

  function leerIntentos() {
    try { return JSON.parse(localStorage.getItem(CLAVE_INTENTOS) || "{}"); }
    catch (e) { return {}; }
  }

  function guardarIntentos(d) {
    try { localStorage.setItem(CLAVE_INTENTOS, JSON.stringify(d)); } catch (e) { /* noop */ }
  }

  function bloqueo(usuario) {
    const d = leerIntentos()[String(usuario).toLowerCase()];
    if (!d || d.fallos < MAX_INTENTOS) return 0;
    const restante = d.ultimo + ESPERA_MS - Date.now();
    return restante > 0 ? Math.ceil(restante / 1000) : 0;
  }

  /* Devuelve los segundos de espera si este fallo agota los intentos, para
     poder decirlo en el mismo momento en vez de en el intento siguiente. */
  function anotarFallo(usuario) {
    const d = leerIntentos();
    const k = String(usuario).toLowerCase();
    const prev = d[k] && (Date.now() - d[k].ultimo) < ESPERA_MS ? d[k].fallos : 0;
    d[k] = { fallos: prev + 1, ultimo: Date.now() };
    guardarIntentos(d);
    return d[k].fallos >= MAX_INTENTOS ? Math.ceil(ESPERA_MS / 1000) : 0;
  }

  function limpiarFallos(usuario) {
    const d = leerIntentos();
    delete d[String(usuario).toLowerCase()];
    guardarIntentos(d);
  }

  return {
    disponible: disponible,
    crearCredencial: crearCredencial,
    verificar: verificar,
    politica: politica,
    revisar: revisar,
    claveTemporal: claveTemporal,
    bloqueo: bloqueo,
    anotarFallo: anotarFallo,
    limpiarFallos: limpiarFallos,
    MAX_INTENTOS: MAX_INTENTOS
  };
})();
