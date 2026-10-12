/* Un Supabase de mentira con una base de datos de verdad.

   Las pruebas anteriores (`falsosupabase.js`) guardaban las filas en un Map
   de JavaScript. Eso sirve para comprobar que el cliente sincroniza, pero no
   sirve para nada cuando lo que hay que comprobar es la SEGURIDAD: unas
   políticas escritas en SQL no se pueden verificar contra una imitación en
   JavaScript, porque entonces lo que se prueba es la imitación.

   Así que aquí solo se imita la parte tonta —la API de autenticación, que
   reparte tokens— y las consultas van a un PostgreSQL real con las políticas
   reales de `tools/supabase-auth.sql`, cada una ejecutada con el rol y el
   `auth.uid()` de quien la pide. Si una política tiene un agujero, se ve.

   Se habla con la base por `psql` en vez de por una librería: el proyecto no
   tiene dependencias y las pruebas tampoco van a empezar a tenerlas. */
const http = require("http");
const { execFileSync } = require("child_process");
const crypto = require("crypto");

function crear(puerto, opciones) {
  const o = opciones || {};
  const PSQL = o.psql || "psql";
  const CONEXION = o.conexion || ["-h", "/var/tmp", "-p", "5433", "-U", "postgres"];
  const clave = o.clave || "sb_publishable_prueba";

  const sesiones = new Map();   // token -> { uid, correo, expira }
  const cuentas = new Map();    // correo -> { uid, clave }
  const bitacora = { consultas: 0, escrituras: 0, auth: 0, rechazos: 0 };

  /* ------------------------------------------------------------ base */

  function sql(texto, uid) {
    /* Tres modos, y conviene no confundirlos: `undefined` corre como dueño
       de la base —lo que hace Supabase por dentro al registrar una cuenta—,
       `null` corre como anónimo, y un uuid corre como esa persona. */
    const guion =
      "begin;\n" +
      (uid === undefined
        ? ""
        : uid === null
          ? "set local role anon;\n"
          : "set local role authenticated;\nset local request.jwt.claim.sub = " + lit(uid) + ";\n") +
      texto + "\ncommit;\n";
    try {
      return execFileSync(PSQL, CONEXION.concat(["-v", "ON_ERROR_STOP=1", "-t", "-A", "-q", "-f", "-"]),
        { input: guion, encoding: "utf8" }).trim();
    } catch (e) {
      const salida = String((e.stderr || "") + (e.stdout || ""));
      const err = new Error(salida.split("\n")[0] || "error de base");
      err.sql = salida;
      err.rls = /row-level security|permission denied/i.test(salida);
      throw err;
    }
  }

  function lit(v) {
    if (v === null || v === undefined) return "null";
    return "'" + String(v).replace(/'/g, "''") + "'";
  }

  function filas(select, uid) {
    const r = sql("select coalesce(json_agg(t), '[]'::json) from (" + select + ") t;", uid);
    /* psql imprime el json en una línea; si hubiera saltos, se reúnen. */
    return JSON.parse(r.replace(/\n/g, ""));
  }

  /* ------------------------------------------- traducción de PostgREST */

  /* Solo el subconjunto que usa la app: igualdades, select, order y upsert.
     No es un PostgREST; es lo justo para que las consultas de la aplicación
     lleguen a la base tal como las escribe. */
  function donde(params) {
    const cond = [];
    for (const [k, v] of params) {
      if (["select", "order", "on_conflict", "limit"].includes(k)) continue;
      const m = /^(eq|gt|lt)\.(.*)$/s.exec(v);
      if (!m) continue;
      const op = { eq: "=", gt: ">", lt: "<" }[m[1]];
      cond.push('"' + k.replace(/"/g, "") + '" ' + op + " " + lit(decodeURIComponent(m[2])));
    }
    return cond.length ? " where " + cond.join(" and ") : "";
  }

  function columnas(params) {
    const s = params.get("select");
    if (!s) return "*";
    return s.split(",").map(function (c) { return '"' + c.trim() + '"'; }).join(", ");
  }

  function orden(params) {
    const s = params.get("order");
    if (!s) return "";
    return " order by " + s.split(",").map(function (c) {
      const p = c.split(".");
      return '"' + p[0] + '" ' + (p[1] === "desc" ? "desc" : "asc");
    }).join(", ");
  }

  /* ------------------------------------------------------------- HTTP */

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "apikey,authorization,content-type,prefer,accept",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS"
  };

  const srv = http.createServer(function (req, res) {
    if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }

    let cuerpo = "";
    req.on("data", function (d) { cuerpo += d; });
    req.on("end", function () {
      const responder = function (codigo, datos) {
        res.writeHead(codigo, Object.assign({ "Content-Type": "application/json" }, cors));
        res.end(datos === undefined ? "" : JSON.stringify(datos));
      };
      try { manejar(req, cuerpo, responder); }
      catch (e) {
        if (e.rls) { bitacora.rechazos++; return responder(403, { message: e.message, code: "42501" }); }
        responder(500, { message: e.message });
      }
    });
  });

  function uidDe(req) {
    const a = req.headers.authorization || "";
    const t = a.replace(/^Bearer\s+/i, "");
    if (!t || t === clave) return null;              // sin sesión: anónimo
    const s = sesiones.get(t);
    if (!s) return null;
    if (Date.now() > s.expira) return null;
    return s.uid;
  }

  function nuevaSesion(cuenta) {
    const token = crypto.randomBytes(24).toString("hex");
    const refresco = crypto.randomBytes(24).toString("hex");
    const expira = Date.now() + (o.vidaTokenMs || 3600000);
    sesiones.set(token, { uid: cuenta.uid, correo: cuenta.correo, expira, refresco });
    return {
      access_token: token, refresh_token: refresco, token_type: "bearer",
      expires_in: Math.round((expira - Date.now()) / 1000),
      expires_at: Math.round(expira / 1000),
      user: { id: cuenta.uid, email: cuenta.correo }
    };
  }

  function manejar(req, cuerpo, responder) {
    const u = new URL(req.url, "http://x");
    if (req.headers.apikey !== clave) return responder(401, { message: "clave" });
    if (o.caido) return responder(503, { message: "caido" });

    /* ---------------------------- autenticación ---------------------- */
    if (u.pathname.startsWith("/auth/v1/")) {
      bitacora.auth++;
      const datos = cuerpo ? JSON.parse(cuerpo) : {};

      if (u.pathname === "/auth/v1/signup") {
        const correo = String(datos.email || "").toLowerCase();
        if (cuentas.has(correo)) {
          return responder(400, { error_code: "user_already_exists", msg: "ya existe" });
        }
        if (String(datos.password || "").length < 6) {
          return responder(400, { error_code: "weak_password", msg: "corta" });
        }
        const cuenta = { uid: crypto.randomUUID(), correo: correo, clave: String(datos.password) };
        cuentas.set(correo, cuenta);
        sql("insert into auth.users (id, email) values (" + lit(cuenta.uid) + ", " + lit(correo) +
            ") on conflict do nothing;", undefined);
        if (o.confirmarCorreo) return responder(200, { user: { id: cuenta.uid } });
        return responder(200, nuevaSesion(cuenta));
      }

      if (u.pathname === "/auth/v1/token") {
        if (u.searchParams.get("grant_type") === "refresh_token") {
          for (const [t, s] of sesiones) {
            if (s.refresco === datos.refresh_token) {
              sesiones.delete(t);
              return responder(200, nuevaSesion({ uid: s.uid, correo: s.correo }));
            }
          }
          return responder(400, { error_code: "invalid_grant", msg: "refresco inválido" });
        }
        const correo = String(datos.email || "").toLowerCase();
        const cuenta = cuentas.get(correo);
        if (!cuenta || cuenta.clave !== String(datos.password)) {
          return responder(400, { error_code: "invalid_credentials", msg: "credenciales" });
        }
        return responder(200, nuevaSesion(cuenta));
      }

      if (u.pathname === "/auth/v1/logout") {
        const a = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
        sesiones.delete(a);
        return responder(204);
      }

      if (u.pathname === "/auth/v1/user" && req.method === "PUT") {
        const uid = uidDe(req);
        if (!uid) return responder(401, { msg: "sin sesión" });
        for (const c of cuentas.values()) {
          if (c.uid === uid && datos.password) c.clave = String(datos.password);
        }
        return responder(200, { id: uid });
      }
      return responder(404, { msg: "ruta de auth desconocida" });
    }

    /* ------------------------------- datos --------------------------- */
    if (!u.pathname.startsWith("/rest/v1/")) return responder(404, { message: "ruta" });

    /* Funciones: PostgREST las publica bajo /rpc/. La app usa una para
       comprobar una invitación sin tener cuenta todavía. */
    if (u.pathname.startsWith("/rest/v1/rpc/")) {
      const fn = u.pathname.slice("/rest/v1/rpc/".length).replace(/[^a-z_]/gi, "");
      const args = cuerpo ? JSON.parse(cuerpo) : {};
      const nombres = Object.keys(args);
      const llamada = fn + "(" + nombres.map(function (k) {
        return k + " => " + lit(args[k]);
      }).join(", ") + ")";
      const uidRpc = uidDe(req);
      const r = sql("select " + llamada + " as v;", uidRpc === null ? null : uidRpc);
      bitacora.consultas++;
      const limpio = r.trim();
      return responder(200, limpio === "t" ? true : limpio === "f" ? false : limpio);
    }
    const tabla = u.pathname.slice("/rest/v1/".length).replace(/[^a-z_]/gi, "");
    const uid = uidDe(req);
    const p = u.searchParams;

    if (req.method === "GET") {
      bitacora.consultas++;
      return responder(200, filas(
        "select " + columnas(p) + " from " + tabla + donde(p) + orden(p),
        uid === null ? null : uid));
    }

    if (req.method === "POST") {
      bitacora.escrituras++;
      const lista = Array.isArray(JSON.parse(cuerpo)) ? JSON.parse(cuerpo) : [JSON.parse(cuerpo)];
      const upsert = !!p.get("on_conflict");
      lista.forEach(function (f) {
        const cols = Object.keys(f);
        const vals = cols.map(function (c) {
          const v = f[c];
          return v !== null && typeof v === "object" ? lit(JSON.stringify(v)) : lit(v);
        });
        let q = "insert into " + tabla + " (" + cols.map(function (c) { return '"' + c + '"'; }).join(",") +
          ") values (" + vals.join(",") + ")";
        if (upsert) {
          const llaves = p.get("on_conflict").split(",").map(function (k) { return '"' + k + '"'; });
          const set = cols.filter(function (c) { return llaves.indexOf('"' + c + '"') === -1; })
            .map(function (c) { return '"' + c + '" = excluded."' + c + '"'; });
          q += " on conflict (" + llaves.join(",") + ") do update set " + set.join(", ");
        }
        sql(q + ";", uid);
      });
      return responder(201);
    }

    if (req.method === "PATCH") {
      bitacora.escrituras++;
      const f = JSON.parse(cuerpo);
      const set = Object.keys(f).map(function (c) {
        const v = f[c];
        return '"' + c + '" = ' + (v !== null && typeof v === "object" ? lit(JSON.stringify(v)) : lit(v));
      }).join(", ");
      sql("update " + tabla + " set " + set + donde(p) + ";", uid);
      return responder(204);
    }

    if (req.method === "DELETE") {
      bitacora.escrituras++;
      sql("delete from " + tabla + donde(p) + ";", uid);
      return responder(204);
    }
    return responder(405, { message: "método" });
  }

  return new Promise(function (ok) {
    srv.listen(puerto, function () {
      ok({
        srv, bitacora, sesiones, cuentas, opciones: o, clave,
        sql: function (texto, uid) { return sql(texto, uid === undefined ? undefined : uid); },
        filas: function (q, uid) { return filas(q, uid); },
        cerrar: function () { return new Promise(function (r) { srv.close(r); }); }
      });
    });
  });
}

module.exports = { crear };
