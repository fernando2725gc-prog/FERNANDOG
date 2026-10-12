/* Autenticación real, de punta a punta: la aplicación tal cual se publica,
   hablando con un PostgreSQL de verdad que lleva las políticas de
   tools/supabase-auth.sql. Lo único simulado es el reparto de tokens.

   Lo que se comprueba no es que la interfaz esconda botones —eso ya se sabía
   hacer— sino que la BASE se niegue, que es lo único que de verdad contiene
   a alguien con la consola del navegador abierta. */
const { chromium } = require("playwright");
const G = require("./falsogotrue.js");
const BASE = "http://localhost:8199/app";
const PUERTO = 8211;
const CLAVE = "sb_publishable_prueba";

(async () => {
  const errores = [];
  const paso = async (n, fn) => {
    try { await fn(); console.log("  ✓ " + n); }
    catch (e) { console.log("  ✗ " + n + " → " + e.message); errores.push(n); }
  };

  const nube = await G.crear(PUERTO, { clave: CLAVE });
  nube.sql("truncate documentos, perfiles, invitaciones; delete from auth.users;", undefined);
  nube.sql("insert into invitaciones(acceso,rol,proveedor_id,nombre,verificacion) values " +
    "('supervision','supervisor',null,'Supervisión de planta',null);", undefined);

  const b = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"]
  });

  const nuevoCtx = async () => {
    const ctx = await b.newContext();
    await ctx.addInitScript(({ url, clave }) => {
      window.ACOPIA_NUBE = { url: url, clave: clave };
      delete window.claude;                       // nada de almacén de artefacto
    }, { url: "http://localhost:" + PUERTO, clave: CLAVE });
    return ctx;
  };

  const abrir = async (ctx, ruta) => {
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errores.push("pagina: " + e.message));
    await p.goto(BASE + ruta, { waitUntil: "networkidle" });
    return p;
  };

  const entrar = async (p, usuario, clave) => {
    await p.waitForSelector("#acceso", { timeout: 25000 });
    await p.fill("#acceso", usuario);
    await p.fill("#clave", clave);
    await p.click("#btnEntrar");
  };

  /* Activa una cuenta como lo hará la persona: desde el navegador, con la
     invitación que Supervisión dejó escrita. */
  const activar = (p, acceso, clave, verificacion) => p.evaluate(
    ([a, c, v]) => Sesion.activar(a, c, v), [acceso, clave, verificacion]);

  console.log("\n[1] Sin cuenta no se ve nada, ni forzándolo");

  const ctxA = await nuevoCtx();
  const planta = await abrir(ctxA, "/interno/");

  await paso("la pantalla de acceso no ofrece cuentas de ejemplo", async () => {
    await planta.waitForSelector(".acceso-caja", { timeout: 25000 });
    const t = await planta.locator(".acceso-caja").innerText();
    if (/demostraci|pitahaya2026|supervision2026/i.test(t)) {
      throw new Error("sigue ofreciendo contraseñas de ejemplo");
    }
  });

  await paso("pedir los lotes a pelo devuelve cero", async () => {
    const r = await planta.evaluate(async () => {
      try { return (await Nube.rest("documentos?coleccion=eq.lotes&select=id")) || []; }
      catch (e) { return { codigo: e.code || e.codigo || e.message }; }
    });
    if (Array.isArray(r) && r.length > 0) throw new Error("devolvió " + r.length + " lotes");
  });

  console.log("\n[2] La primera supervisión se activa con su invitación");

  await paso("sin invitación no hay manera de entrar", async () => {
    const r = await activar(planta, "colado", "claveinventada", null);
    if (!r.error) throw new Error("activó una cuenta que nadie invitó");
    const perfiles = nube.filas("select count(*) n from perfiles", undefined);
    if (perfiles[0].n !== 0) throw new Error("quedó un perfil creado");
  });

  await paso("con la invitación, sí", async () => {
    const r = await activar(planta, "supervision", "supervision2026", null);
    if (r.error) throw new Error(r.error);
    if (r.perfil.rol !== "supervisor") throw new Error("rol: " + r.perfil.rol);
  });

  await paso("y la base la deja sembrar los datos", async () => {
    await planta.reload({ waitUntil: "networkidle" });
    await planta.waitForSelector(".lateral", { timeout: 30000 });
    await planta.waitForFunction(() => DB.all("lotes").length > 10, null, { timeout: 30000 });
    const n = nube.filas("select count(*) n from documentos", undefined)[0].n;
    if (n < 50) throw new Error("la base quedó con " + n + " documentos");
  });

  await paso("la sesión se retoma sola al volver a abrir", async () => {
    const p2 = await abrir(ctxA, "/interno/");
    await p2.waitForSelector(".lateral", { timeout: 30000 });
    const quien = await p2.evaluate(() => Sesion.actual());
    if (!quien || quien.rol !== "supervisor") throw new Error("no retomó: " + JSON.stringify(quien));
    await p2.close();
  });

  console.log("\n[3] Supervisión da de alta a los demás");

  let PROV = null;
  await paso("crea la invitación de una finca", async () => {
    PROV = nube.filas("select id from documentos where coleccion='proveedores' limit 1", undefined)[0].id;
    const r = await planta.evaluate(([pv]) => Sesion.invitar({
      acceso: "PRV-900", rol: "proveedor", proveedorId: pv,
      nombre: "Finca de prueba", verificacion: "1790000900001"
    }), [PROV]);
    if (r.error) throw new Error(r.error);
  });

  await paso("y la de un pesador", async () => {
    const r = await planta.evaluate(() => Sesion.invitar({
      acceso: "dandrade", rol: "recepcion", proveedorId: null, nombre: "Diego Andrade"
    }));
    if (r.error) throw new Error(r.error);
  });

  console.log("\n[4] El proveedor solo ve lo suyo — y la base lo impone");

  const ctxB = await nuevoCtx();
  const portal = await abrir(ctxB, "/proveedor/");

  await paso("no se activa con un RUC equivocado, y no deja cuenta a medias", async () => {
    const r = await activar(portal, "PRV-900", "finca2026", "0000000000");
    if (!r.error) throw new Error("se activó con un dato de verificación falso");
    /* Lo importante no es solo que falle: es que no quede una cuenta
       creada. Si queda, una errata deja a la persona fuera para siempre. */
    if (nube.cuentas.has("prv-900@acopia.invalid")) {
      throw new Error("creó la cuenta antes de comprobar la invitación");
    }
  });

  await paso("sí con el correcto", async () => {
    const r = await activar(portal, "PRV-900", "finca2026", "1790000900001");
    if (r.error) throw new Error(r.error);
    if (r.perfil.proveedorId !== PROV) throw new Error("finca: " + r.perfil.proveedorId);
  });

  await paso("entra al portal y ve solo los lotes de su finca", async () => {
    await portal.reload({ waitUntil: "networkidle" });
    await portal.waitForSelector(".portal-marca", { timeout: 30000 });
    const r = await portal.evaluate((pv) => {
      const l = DB.all("lotes");
      return { total: l.length, ajenos: l.filter((x) => x.proveedorId !== pv).length };
    }, PROV);
    if (r.ajenos > 0) throw new Error(r.ajenos + " lotes de otras fincas a la vista");
  });

  await paso("aunque pida un lote ajeno por su id, la base no se lo da", async () => {
    const ajeno = nube.filas(
      "select id from documentos where coleccion='lotes' and datos->>'proveedorId' <> " +
      "'" + PROV + "' limit 1", undefined)[0].id;
    const r = await portal.evaluate(async (id) =>
      (await Nube.rest("documentos?coleccion=eq.lotes&id=eq." + id + "&select=id,datos")) || [],
      ajeno);
    if (r.length > 0) throw new Error("le entregó el lote " + ajeno);
  });

  await paso("no ve la bitácora de planta ni la lista de usuarios", async () => {
    const r = await portal.evaluate(async () => ({
      bitacora: (await Nube.rest("documentos?coleccion=eq.sistema&id=eq.bitacora&select=id")) || [],
      usuarios: (await Nube.rest("documentos?coleccion=eq.usuarios&select=id")) || []
    }));
    if (r.bitacora.length) throw new Error("le dejó leer la bitácora");
    if (r.usuarios.length) throw new Error("le dejó leer los usuarios");
  });

  await paso("no puede anunciar a nombre de otra finca", async () => {
    const r = await portal.evaluate(async () => {
      try {
        await Nube.rest("documentos?on_conflict=coleccion,id", { method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: { coleccion: "lotes", id: "robado",
                  datos: { proveedorId: "otro", estado: "Anunciado" } } });
        return "pasó";
      } catch (e) { return e.code || "rechazado"; }
    });
    if (r === "pasó") throw new Error("la base aceptó un lote a nombre de otro");
  });

  await paso("no puede darse por recibido a sí mismo", async () => {
    const r = await portal.evaluate(async (pv) => {
      try {
        await Nube.rest("documentos?on_conflict=coleccion,id", { method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: { coleccion: "lotes", id: "autopesado",
                  datos: { proveedorId: pv, estado: "Recibido", kgRecibidos: 9999 } } });
        return "pasó";
      } catch (e) { return e.code || "rechazado"; }
    }, PROV);
    if (r === "pasó") throw new Error("se pesó el lote a sí mismo");
  });

  await paso("sí puede anunciar un envío suyo, que es su trabajo", async () => {
    /* Se identifica el lote nuevo por su id y no por las gavetas: la semilla
       ya trae lotes de cualquier cantidad, y contar por cantidad daba por
       bueno un lote ajeno que ya estaba ahí. */
    const antes = await portal.evaluate(() => DB.all("lotes").map((l) => l.id));
    await portal.click('[data-ir="anunciar"]');
    await portal.waitForSelector(".modal", { timeout: 15000 });
    await portal.selectOption("#campo_lineaId", { label: "Pitahaya roja" });
    await portal.fill("#campo_gavetasAnunciadas", "55");
    await portal.waitForTimeout(400);
    await portal.click(".modal button[type=submit]");
    try {
      await portal.waitForSelector(".modal", { state: "detached", timeout: 12000 });
    } catch (e) {
      const err = await portal.locator("#formError").textContent().catch(() => "");
      throw new Error("el formulario no cerró · error en pantalla: " + (err || "ninguno"));
    }
    await portal.waitForFunction(() => DB.pendientes() === 0, null, { timeout: 20000 });
    const nuevo = await portal.evaluate((previos) => {
      const l = DB.all("lotes").find((x) => previos.indexOf(x.id) === -1);
      return l ? { id: l.id, estado: l.estado, pv: l.proveedorId } : null;
    }, antes);
    if (!nuevo) throw new Error("no se creó el lote en la aplicación");
    const n = nube.filas("select count(*) n from documentos where coleccion='lotes' " +
      "and id = '" + nuevo.id + "'", undefined)[0].n;
    if (n !== 1) throw new Error("el anuncio no llegó a la base · " + JSON.stringify(nuevo));
  });

  console.log("\n[5] Un pesador no es un supervisor");

  const ctxC = await nuevoCtx();
  const recepcion = await abrir(ctxC, "/interno/");

  await paso("se activa con su invitación", async () => {
    const r = await activar(recepcion, "dandrade", "4521clave", null);
    if (r.error) throw new Error(r.error);
    if (r.perfil.rol !== "recepcion") throw new Error("rol: " + r.perfil.rol);
  });

  await paso("entra y ve la planta entera", async () => {
    await recepcion.reload({ waitUntil: "networkidle" });
    await recepcion.waitForSelector(".lateral", { timeout: 30000 });
    await recepcion.waitForFunction(() => DB.all("lotes").length > 10, null, { timeout: 30000 });
  });

  await paso("pero la base no le deja tocar los catálogos", async () => {
    const antes = nube.filas("select datos->'lineas' l from documentos " +
      "where coleccion='sistema' and id='config'", undefined)[0].l;
    await recepcion.evaluate(async () => {
      try {
        await Nube.rest("documentos?coleccion=eq.sistema&id=eq.config", { method: "PATCH",
          headers: { Prefer: "return=minimal" }, body: { datos: { lineas: [] } } });
      } catch (e) { /* se esperaba */ }
    });
    const despues = nube.filas("select datos->'lineas' l from documentos " +
      "where coleccion='sistema' and id='config'", undefined)[0].l;
    if (JSON.stringify(antes) !== JSON.stringify(despues)) {
      throw new Error("Recepción reescribió los catálogos de la planta");
    }
  });

  await paso("ni borrar lotes", async () => {
    const antes = nube.filas("select count(*) n from documentos where coleccion='lotes'", undefined)[0].n;
    await recepcion.evaluate(async () => {
      try {
        await Nube.rest("documentos?coleccion=eq.lotes", { method: "DELETE",
          headers: { Prefer: "return=minimal" } });
      } catch (e) { /* se esperaba */ }
    });
    const despues = nube.filas("select count(*) n from documentos where coleccion='lotes'", undefined)[0].n;
    if (despues !== antes) throw new Error("borró " + (antes - despues) + " lotes");
  });

  await paso("ni subirse el rol a supervisor", async () => {
    await recepcion.evaluate(async () => {
      try {
        await Nube.rest("perfiles?acceso=eq.dandrade", { method: "PATCH",
          headers: { Prefer: "return=minimal" }, body: { rol: "supervisor" } });
      } catch (e) { /* se esperaba */ }
    });
    const rol = nube.filas("select rol from perfiles where acceso='dandrade'", undefined)[0].rol;
    if (rol !== "recepcion") throw new Error("ahora es " + rol);
  });

  console.log("\n[6] Desactivar a alguien le cierra la puerta");

  await paso("Supervisión lo desactiva", async () => {
    const perfiles = await planta.evaluate(() => Sesion.perfiles());
    const d = perfiles.find((p) => p.acceso === "dandrade");
    if (!d) throw new Error("no aparece en la lista de perfiles");
    const r = await planta.evaluate((uid) => Sesion.activarPerfil(uid, false), d.uid);
    if (r.error) throw new Error(r.error);
  });

  await paso("y deja de poder entrar", async () => {
    const ctxD = await nuevoCtx();
    const p = await abrir(ctxD, "/interno/");
    await entrar(p, "dandrade", "4521clave");
    await p.waitForTimeout(2500);
    const dentro = await p.locator(".lateral").count();
    if (dentro) throw new Error("entró con el perfil desactivado");
    const t = await p.locator(".acceso-caja").innerText();
    if (!/desactivada/i.test(t)) throw new Error("no explica por qué: " + t.slice(0, 120));
    await ctxD.close();
  });

  console.log("\n[7] Las pantallas: activar y dar de alta, con el ratón");

  await paso("Supervisión ve sus cuentas y los accesos sin activar", async () => {
    await planta.click('.nav-item[data-ir="usuarios"]');
    await planta.waitForSelector("#btnNuevoAcceso", { timeout: 20000 });
    await planta.waitForFunction(
      () => !/Consultando las cuentas/.test(document.body.innerText), null, { timeout: 20000 });
    const t = await planta.locator("main").innerText();
    if (!/supervision/.test(t)) throw new Error("no lista su propia cuenta");
    if (!/Sesión actual/.test(t)) throw new Error("no marca cuál es la sesión abierta");
    if (/claveHash|PBKDF2|credencial/i.test(t)) throw new Error("enseña algo de contraseñas");
  });

  await paso("crea un acceso desde el formulario", async () => {
    await planta.click("#btnNuevoAcceso");
    await planta.waitForSelector(".modal", { timeout: 15000 });
    await planta.fill("#campo_acceso", "cmendoza");
    await planta.fill("#campo_nombre", "Carlos Mendoza");
    await planta.selectOption("#campo_rol", "produccion");
    await planta.click(".modal button[type=submit]");
    await planta.waitForSelector(".modal", { state: "detached", timeout: 15000 });
    const n = nube.filas("select count(*) n from invitaciones where acceso='cmendoza'", undefined)[0].n;
    if (n !== 1) throw new Error("la invitación no llegó a la base");
  });

  await paso("un proveedor sin finca no se puede crear", async () => {
    await planta.click("#btnNuevoAcceso");
    await planta.waitForSelector(".modal", { timeout: 15000 });
    await planta.fill("#campo_acceso", "PRV-999");
    await planta.fill("#campo_nombre", "Finca sin dueño");
    await planta.selectOption("#campo_rol", "proveedor");
    await planta.click(".modal button[type=submit]");
    await planta.waitForTimeout(700);
    const err = planta.locator("#formError");
    if (await err.isHidden()) throw new Error("dejó crear un proveedor sin finca");
    await planta.click(".modal [data-cancelar]");
  });

  await paso("la persona nueva se activa desde la pantalla de acceso", async () => {
    const ctxE = await nuevoCtx();
    const p = await abrir(ctxE, "/interno/");
    await p.waitForSelector("#btnActivarInterno", { timeout: 25000 });
    await p.click("#btnActivarInterno");
    await p.waitForSelector(".modal", { timeout: 15000 });
    await p.fill("#campo_acceso", "cmendoza");
    await p.fill("#campo_clave", "produccion2026");
    await p.fill("#campo_repetir", "produccion2026");
    await p.click(".modal button[type=submit]");
    await p.waitForSelector(".lateral", { timeout: 30000 });
    const quien = await p.evaluate(() => Sesion.actual());
    if (!quien || quien.rol !== "produccion") throw new Error("entró como " + JSON.stringify(quien));
    await ctxE.close();
  });

  await paso("y ese acceso ya no sirve para nadie más", async () => {
    const ctxF = await nuevoCtx();
    const p = await abrir(ctxF, "/interno/");
    await p.waitForSelector("#btnActivarInterno", { timeout: 25000 });
    const r = await activar(p, "cmendoza", "otraclave123", null);
    if (!r.error) throw new Error("una segunda persona usó la misma invitación");
    await ctxF.close();
  });

  await b.close();
  await nube.cerrar();
  console.log(errores.length ? "\nFALLOS: " + errores.length : "\nTodo en orden.");
  process.exit(errores.length ? 1 : 0);
})();
