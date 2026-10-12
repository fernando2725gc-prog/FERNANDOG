/* =========================================================================
   sesion.js — Quién entra, comprobado en el servidor

   Lo que había antes, y por qué no bastaba: la contraseña se comprobaba en
   el navegador contra un hash guardado junto a los demás datos. El hash era
   real (PBKDF2-SHA256, sal por persona), pero estaba a la vista de cualquiera
   que pudiera leer el almacén, y los permisos eran una guía: ordenaban el
   trabajo, no contenían a nadie. Quien abriera la consola del navegador podía
   pedir lo que quisiera.

   Ahora la contraseña la verifica Supabase Auth y su hash no sale de allí
   nunca. Lo que el navegador recibe es un token firmado, y con ese token
   Postgres decide qué puede ver cada quien (`tools/supabase-auth.sql`). Un
   proveedor que pida los lotes de otro no recibe un error de la aplicación:
   recibe cero filas de la base de datos.

   Dos decisiones que conviene entender:

   · **El correo es un identificador, no un buzón.** La gente de planta entra
     con un usuario y un PIN; no tiene un correo que pueda abrir, y pedirle
     uno sería inventar un trámite. Supabase nombra las cuentas por correo,
     así que se compone uno a partir del usuario, bajo `acopia.invalid`: el
     RFC 2606 reserva ese dominio precisamente para esto, de modo que ningún
     mensaje puede acabar por error en el buzón de un desconocido.

   · **Nadie se inventa su propio rol.** Cualquiera puede registrarse en
     Supabase con la clave pública —así funciona—, pero una cuenta sin perfil
     no ve absolutamente nada. Y un perfil solo puede crearse si Supervisión
     dejó antes una invitación que coincide en usuario, rol y finca. Eso no se
     comprueba aquí: se comprueba en la base, porque lo que decide el
     navegador lo decide quien controle el navegador.
   ========================================================================= */

const Sesion = (function () {
  "use strict";

  const LLAVE = "acopia.sesion.v1";
  /* Reservado por el RFC 2606 para que nunca exista de verdad. */
  const DOMINIO = "acopia.invalid";
  /* Margen para renovar antes de que caduque: si se apura al límite, una
     petición lanzada justo en el cambio sale con un token muerto. */
  const MARGEN_MS = 120000;

  let sesion = null;     // { token, refresco, expira, uid }
  let perfil = null;     // { uid, acceso, rol, nombre, proveedorId, activo }
  let renovando = null;

  function disponible() {
    return typeof Nube !== "undefined" && Nube.configurada();
  }

  /* El usuario se escribe como se quiera —PRV-001, dandrade— y siempre da el
     mismo correo. Sin esto, «DAndrade» y «dandrade» serían dos cuentas. */
  function correoDe(acceso) {
    const limpio = String(acceso || "").trim().toLowerCase()
      .replace(/[^a-z0-9._-]/g, "-").replace(/^-+|-+$/g, "");
    return limpio + "@" + DOMINIO;
  }

  /* ------------------------------------------------------------ errores */

  const MENSAJES = {
    "invalid_credentials": "Usuario o contraseña incorrectos.",
    "email_not_confirmed": "La cuenta existe pero está sin confirmar. " +
      "Supervisión debe desactivar «Confirm email» en Supabase.",
    "user_already_exists": "Esa cuenta ya fue activada. Si la contraseña se " +
      "perdió, Supervisión puede volver a habilitarla.",
    "weak_password": "La contraseña es demasiado corta.",
    "over_request_rate_limit": "Demasiados intentos seguidos. Espera un minuto.",
    "sin-red": "Sin conexión con el servidor de acceso."
  };

  function traducir(codigo, respaldo) {
    return MENSAJES[codigo] || respaldo || "No se pudo completar la operación.";
  }

  /* ------------------------------------------------- llamadas a GoTrue */

  async function auth(ruta, cuerpo, conToken) {
    const base = Nube.base();
    const cab = {
      apikey: Nube.clavePublica(),
      "Content-Type": "application/json"
    };
    if (conToken && sesion) cab.Authorization = "Bearer " + sesion.token;

    let res;
    try {
      res = await fetch(base + "/auth/v1" + ruta, {
        method: cuerpo ? "POST" : "GET",
        headers: cab,
        body: cuerpo ? JSON.stringify(cuerpo) : undefined
      });
    } catch (e) {
      const err = new Error(MENSAJES["sin-red"]);
      err.codigo = "sin-red";
      throw err;
    }

    const texto = await res.text();
    const datos = texto ? JSON.parse(texto) : {};
    if (!res.ok) {
      const codigo = datos.error_code || datos.error || "";
      const err = new Error(traducir(codigo, datos.msg || datos.error_description));
      err.codigo = codigo;
      err.estado = res.status;
      throw err;
    }
    return datos;
  }

  async function authPut(ruta, cuerpo) {
    const res = await fetch(Nube.base() + "/auth/v1" + ruta, {
      method: "PUT",
      headers: {
        apikey: Nube.clavePublica(),
        Authorization: "Bearer " + (sesion ? sesion.token : ""),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(cuerpo)
    });
    const texto = await res.text();
    const datos = texto ? JSON.parse(texto) : {};
    if (!res.ok) {
      const err = new Error(traducir(datos.error_code || datos.error, datos.msg));
      err.codigo = datos.error_code || datos.error;
      throw err;
    }
    return datos;
  }

  /* -------------------------------------------------------- guardado */

  function guardar(datos) {
    sesion = datos
      ? {
          token: datos.access_token,
          refresco: datos.refresh_token,
          /* `expires_at` viene en segundos desde época; si falta, se calcula
             con `expires_in`, que siempre llega. */
          expira: (datos.expires_at
            ? datos.expires_at * 1000
            : Date.now() + (datos.expires_in || 3600) * 1000),
          uid: datos.user ? datos.user.id : (sesion && sesion.uid)
        }
      : null;
    try {
      if (sesion) localStorage.setItem(LLAVE, JSON.stringify(sesion));
      else localStorage.removeItem(LLAVE);
    } catch (e) { /* modo privado: la sesión vive solo en memoria */ }
    if (typeof Nube !== "undefined" && Nube.olvidarResumen) Nube.olvidarResumen();
  }

  function leerGuardada() {
    try {
      const crudo = localStorage.getItem(LLAVE);
      return crudo ? JSON.parse(crudo) : null;
    } catch (e) { return null; }
  }

  /* ------------------------------------------------------- renovación */

  /* El token dura una hora. Se renueva antes de que caduque y una sola vez
     aunque lo pidan diez peticiones a la vez: diez renovaciones simultáneas
     invalidan el refresco y echan a la persona de su propia sesión. */
  async function vigente() {
    if (!sesion) return false;
    if (Date.now() < sesion.expira - MARGEN_MS) return true;
    if (renovando) return renovando;
    renovando = (async function () {
      try {
        const d = await auth("/token?grant_type=refresh_token", { refresh_token: sesion.refresco });
        guardar(d);
        return true;
      } catch (e) {
        /* El refresco caducó o fue revocado: hay que volver a entrar. */
        guardar(null); perfil = null;
        return false;
      } finally { renovando = null; }
    })();
    return renovando;
  }

  function token() { return sesion ? sesion.token : ""; }

  /* ---------------------------------------------------------- perfil */

  async function leerPerfil(uid) {
    const filas = await Nube.rest("perfiles?uid=eq." + encodeURIComponent(uid) +
      "&select=uid,acceso,rol,proveedor_id,nombre,activo");
    const f = filas && filas[0];
    if (!f) return null;
    return {
      uid: f.uid, acceso: f.acceso, rol: f.rol,
      proveedorId: f.proveedor_id, nombre: f.nombre, activo: f.activo
    };
  }

  /* --------------------------------------------------------- entrar */

  async function entrar(acceso, clave) {
    if (!disponible()) return { error: "No hay servidor de acceso configurado." };
    try {
      const d = await auth("/token?grant_type=password",
        { email: correoDe(acceso), password: String(clave) });
      guardar(d);

      const p = await leerPerfil(sesion.uid);
      if (!p) {
        /* La cuenta existe en Supabase pero nadie le dio un papel. Sin perfil
           no ve nada, así que es mejor decirlo que dejarla dentro mirando una
           pantalla vacía. */
        await salir();
        return { error: "Esa cuenta no tiene un rol asignado. Supervisión debe " +
          "crear la invitación y volver a activarla." };
      }
      if (!p.activo) {
        await salir();
        return { error: "Esa cuenta está desactivada. Habla con Supervisión." };
      }
      perfil = p;
      return { perfil: p };
    } catch (e) {
      return { error: e.message, codigo: e.codigo };
    }
  }

  /* -------------------------------------------------------- activar */

  /* La primera vez: la persona crea su propia cuenta con el código que le
     dieron y el dato de verificación. Supervisión nunca teclea la contraseña
     de otro, que es como se filtran. */
  async function activar(acceso, clave, verificacion) {
    if (!disponible()) return { error: "No hay servidor de acceso configurado." };

    let creada = false;
    try {
      /* Hace falta estar autenticado para poder leer la invitación: la
         política no se la enseña a un desconocido. Así que primero se crea
         la cuenta y después se comprueba que había invitación; si no la
         había, la cuenta queda sin perfil y no sirve para nada. */
      let d;
      try {
        d = await auth("/signup", { email: correoDe(acceso), password: String(clave) });
        creada = true;
      } catch (e) {
        if (e.codigo === "user_already_exists") {
          return { error: traducir("user_already_exists") };
        }
        throw e;
      }
      /* Con «Confirm email» activo, signup no devuelve sesión. */
      if (!d.access_token) {
        return { error: "Supabase está pidiendo confirmación por correo. " +
          "Hay que desactivar «Confirm email» en Authentication → Providers." };
      }
      guardar(d);

      const inv = await Nube.rest("invitaciones?acceso=eq." + encodeURIComponent(acceso) +
        "&select=acceso,rol,proveedor_id,nombre,verificacion");
      const i = inv && inv[0];
      if (!i) {
        await salir();
        return { error: "No hay ninguna invitación con ese código. Pídesela a Supervisión." };
      }
      if (i.verificacion && String(i.verificacion).trim() !== String(verificacion || "").trim()) {
        await salir();
        return { error: "El dato de verificación no coincide con el registrado." };
      }

      try {
        await Nube.rest("perfiles", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: {
            uid: sesion.uid, acceso: i.acceso, rol: i.rol,
            proveedor_id: i.proveedor_id, nombre: i.nombre
          }
        });
      } catch (e) {
        await salir();
        /* La base rechaza el perfil si la invitación ya se gastó: el usuario
           es único, así que la segunda persona que lo intente se queda fuera. */
        return { error: "Esa invitación ya fue usada por otra persona." };
      }

      perfil = await leerPerfil(sesion.uid);
      return { perfil: perfil };
    } catch (e) {
      if (creada) { try { await salir(); } catch (x) { /* ya da igual */ } }
      return { error: e.message, codigo: e.codigo };
    }
  }

  /* ---------------------------------------------------------- salir */

  async function salir() {
    if (sesion) {
      try { await auth("/logout", {}, true); } catch (e) { /* da igual: se olvida igual */ }
    }
    guardar(null);
    perfil = null;
  }

  /* -------------------------------------------------------- retomar */

  /* Al abrir la app: si hay una sesión guardada y sigue viva, se retoma sin
     pedir nada. Es lo que hace que la app instalada en el celular no vuelva
     a preguntar cada mañana. */
  async function retomar() {
    if (!disponible()) return null;
    const guardada = leerGuardada();
    if (!guardada) return null;
    sesion = guardada;
    if (!await vigente()) return null;
    try {
      perfil = await leerPerfil(sesion.uid);
    } catch (e) { perfil = null; }
    if (!perfil || !perfil.activo) { await salir(); return null; }
    return perfil;
  }

  async function cambiarClave(nueva) {
    if (!sesion) return { error: "No hay sesión abierta." };
    try {
      await authPut("/user", { password: String(nueva) });
      return { ok: true };
    } catch (e) { return { error: e.message, codigo: e.codigo }; }
  }

  /* ------------------------------------------- administrar personas */

  async function invitar(datos) {
    try {
      await Nube.rest("invitaciones?on_conflict=acceso", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: {
          acceso: datos.acceso, rol: datos.rol,
          proveedor_id: datos.proveedorId || null,
          nombre: datos.nombre,
          verificacion: datos.verificacion || null,
          creada_por: sesion ? sesion.uid : null
        }
      });
      return { ok: true };
    } catch (e) {
      return { error: e.codigo === "permiso-denegado"
        ? "Solo Supervisión puede crear accesos."
        : e.message };
    }
  }

  async function invitaciones() {
    try {
      return await Nube.rest("invitaciones?select=acceso,rol,proveedor_id,nombre,verificacion,creada&order=creada.desc") || [];
    } catch (e) { return []; }
  }

  async function perfiles() {
    try {
      const filas = await Nube.rest("perfiles?select=uid,acceso,rol,proveedor_id,nombre,activo,creado&order=creado.asc") || [];
      return filas.map(function (f) {
        return { uid: f.uid, acceso: f.acceso, rol: f.rol, proveedorId: f.proveedor_id,
          nombre: f.nombre, activo: f.activo, creado: f.creado };
      });
    } catch (e) { return []; }
  }

  async function activarPerfil(uid, activo) {
    try {
      await Nube.rest("perfiles?uid=eq." + encodeURIComponent(uid), {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: { activo: !!activo }
      });
      return { ok: true };
    } catch (e) { return { error: e.message }; }
  }

  async function borrarInvitacion(acceso) {
    try {
      await Nube.rest("invitaciones?acceso=eq." + encodeURIComponent(acceso), {
        method: "DELETE", headers: { Prefer: "return=minimal" }
      });
      return { ok: true };
    } catch (e) { return { error: e.message }; }
  }

  /* --------------------------------------------------------- estado */

  function actual() { return perfil; }
  function uid() { return sesion ? sesion.uid : null; }

  /* Se registra en cuanto carga el módulo: a partir de aquí, toda petición
     al almacén viaja con la sesión de quien esté dentro. */
  if (typeof Nube !== "undefined" && Nube.usarToken) {
    Nube.usarToken(function () {
      /* Renovar aquí sería asíncrono y las cabeceras se arman en caliente;
         `vigente()` lo hace en los puntos donde sí se puede esperar. */
      return sesion ? sesion.token : "";
    });
  }

  return {
    disponible: disponible,
    correoDe: correoDe,
    entrar: entrar,
    activar: activar,
    salir: salir,
    retomar: retomar,
    vigente: vigente,
    token: token,
    actual: actual,
    uid: uid,
    cambiarClave: cambiarClave,
    invitar: invitar,
    invitaciones: invitaciones,
    perfiles: perfiles,
    activarPerfil: activarPerfil,
    borrarInvitacion: borrarInvitacion,
    DOMINIO: DOMINIO
  };
})();

if (typeof module !== "undefined" && module.exports) { module.exports = Sesion; }
