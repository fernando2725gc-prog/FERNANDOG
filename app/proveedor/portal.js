/* =========================================================================
   portal.js — Portal del Proveedor (aplicación externa)

   Lo que el proveedor puede hacer: anunciar sus envíos y seguir el
   resultado de cada lote. Nada más.

   Aislamiento: todas las lecturas pasan por misLotes(), que filtra por el
   proveedor de la sesión. El portal nunca consulta las colecciones sin ese
   filtro, así que un proveedor no puede ver lotes de otro ni aunque
   manipule la interfaz. Tampoco ve las causas internas de planta: solo las
   de origen «Campo», que son las que dependen de él.
   ========================================================================= */

(function () {
  "use strict";

  const $ = UI.$, $$ = UI.$$;
  const esc = UI.esc, nf = UI.nf, pct = UI.pct, money = UI.money;
  const SESION = "flp.portal.sesion";

  let usuario = null;
  let vista = "inicio";

  /* ============================== sesión ============================== */

  async function entrar(acceso, clave, recordar) {
    const codigo = String(acceso).trim();
    if (!codigo) return { error: "Escribe tu código de proveedor." };
    if (!clave) return { error: "Escribe tu contraseña." };

    const espera = Auth.bloqueo(codigo);
    if (espera > 0) {
      return { error: "Demasiados intentos fallidos. Espera " + espera + " segundos." };
    }

    const u = DB.buscarPorAcceso(codigo);
    /* El mismo mensaje para código inexistente y contraseña equivocada: si
       se distinguieran, se podría averiguar qué códigos existen. */
    const generico = "Código o contraseña incorrectos.";

    if (!u || u.rol !== "proveedor") {
      const espera = Auth.anotarFallo(codigo);
      return { error: espera > 0
        ? "Demasiados intentos fallidos. Espera " + espera + " segundos."
        : generico };
    }
    if (!u.credencial) {
      return { error: "Tu cuenta todavía no tiene contraseña. Pídela en la planta." };
    }

    const vale = await Auth.verificar(clave, u.credencial);
    if (!vale) {
      const espera = Auth.anotarFallo(codigo);
      return { error: espera > 0
        ? "Demasiados intentos fallidos. Espera " + espera + " segundos."
        : generico };
    }
    if (!u.activo) return { error: "Tu acceso está desactivado. Comunícate con la planta." };

    Auth.limpiarFallos(codigo);
    usuario = u;
    DB.update("usuarios", u.id, { ultimoAcceso: new Date().toISOString() });
    UI.abrirSesion(SESION, u.id, recordar);
    DB.registrarBitacora(u.id, "Ingreso al portal", u.nombre);
    return { ok: true, debeCambiar: !!u.debeCambiar };
  }

  function salir() {
    if (usuario) DB.registrarBitacora(usuario.id, "Salida del portal", usuario.nombre);
    usuario = null;
    if (repintado) { clearTimeout(repintado); repintado = null; }
    vista = "inicio";
    UI.cerrarSesion(SESION);
    render();
  }

  function restaurar() {
    const id = UI.sesionAbierta(SESION);
    if (!id) return;
    const u = DB.get("usuarios", id);
    if (u && u.rol === "proveedor" && u.activo) usuario = u;
  }

  /* ========================= lectura aislada ========================== */

  /* Único punto de acceso a los datos del portal. */
  function misLotes() {
    if (!usuario) return [];
    return DB.all("lotes")
      .filter(function (l) { return l.proveedorId === usuario.proveedorId; })
      .sort(function (a, b) { return a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0; });
  }

  function miProveedor() { return DB.get("proveedores", usuario.proveedorId); }

  function produccionDe(loteId) {
    return DB.all("producciones").find(function (p) { return p.loteId === loteId; }) || null;
  }

  /* Solo las causas que nacen en campo: son las que el proveedor puede
     corregir. Las de planta (layout, sopleteado) no son asunto suyo. */
  function causasDeCampo(prod) {
    if (!prod) return [];
    return (prod.mermas || []).filter(function (m) {
      const c = DB.causa(m.causaId);
      return c && c.origen === "Campo";
    }).sort(function (a, b) { return b.kg - a.kg; });
  }

  function resumen() {
    const lotes = misLotes();
    const enCurso = lotes.filter(function (l) {
      return l.estado === "Anunciado" || l.estado === "Recibido" || l.estado === "Procesado";
    });

    let cajasAnun = 0, cajasRec = 0, cajasProc = 0, cajasExp = 0, valor = 0, calA = 0, rech = 0;
    lotes.forEach(function (l) {
      cajasAnun += Number(l.cajasAnunciadas) || 0;
      if (l.estado === "Rechazado") { rech += 1; return; }
      if (l.cajasRecibidas === null) return;
      cajasRec += Number(l.cajasRecibidas) || 0;
      valor += (Number(l.cajasRecibidas) || 0) * (Number(l.precioCaja) || 0);
      if (l.calidadVerificada === "A") calA += Number(l.cajasRecibidas) || 0;
      const p = produccionDe(l.id);
      if (p) {
        cajasProc += Number(p.cajasProcesadas) || 0;
        cajasExp += Number(p.cajasExportables) || 0;
      }
    });

    const pesados = lotes.filter(function (l) {
      return l.cajasRecibidas !== null && l.estado !== "Rechazado";
    });
    const anunPesadas = pesados.reduce(function (a, l) { return a + l.cajasAnunciadas; }, 0);

    return {
      lotes: lotes.length, enCurso: enCurso.length, rechazados: rech,
      cajasAnunciadas: cajasAnun, cajasRecibidas: cajasRec,
      diferencia: cajasRec - anunPesadas,
      tasaDiferencia: anunPesadas > 0 ? (cajasRec - anunPesadas) / anunPesadas : 0,
      cajasExportables: cajasExp,
      tasaExportable: cajasProc > 0 ? cajasExp / cajasProc : 0,
      pctCalidadA: cajasRec > 0 ? calA / cajasRec : 0,
      valor: valor,
      tasaRechazo: lotes.length > 0 ? rech / lotes.length : 0
    };
  }

  /* =============================== vistas ============================= */

  function vistaInicio() {
    const r = resumen();
    const lotes = misLotes();
    const activos = lotes.filter(function (l) { return l.estado !== "Cerrado" && l.estado !== "Rechazado"; });

    let html = '<section class="portal-saludo">' +
      "<h1>Hola, " + esc(usuario.nombre.split(" ")[0]) + "</h1>" +
      '<p class="sub">' + esc(miProveedor().nombre) + "</p>" +
      '<button class="btn btn-primario btn-grande" data-ir="anunciar">' +
      "Anunciar un envío</button></section>";

    if (activos.length) {
      html += '<section class="panel"><h2>Tus envíos en curso</h2><div class="pila">';
      activos.slice(0, 6).forEach(function (l) { html += tarjetaLote(l); });
      html += "</div>";
      if (activos.length > 6) {
        html += '<button class="btn btn-plano btn-ancho" data-ir="lotes">Ver los ' +
          activos.length + " envíos</button>";
      }
      html += "</section>";
    } else {
      html += '<section class="panel"><p class="vacio">No tienes envíos en curso. ' +
        "Cuando anuncies uno, aquí verás en qué punto va.</p></section>";
    }

    html += '<section class="kpis kpis-portal">';
    html += UI.kpi("Cajas entregadas", nf(r.cajasRecibidas),
      r.lotes + " envíos en total", "linea1");
    html += UI.kpi("Exactitud al declarar", UI.pctFirmado(r.tasaDiferencia),
      "Diferencia entre lo que anuncias y lo que pesa la planta",
      Math.abs(r.tasaDiferencia) <= 0.01 ? "bien" : Math.abs(r.tasaDiferencia) <= 0.03 ? "regular" : "mal");
    html += UI.kpi("Tu fruta exportable", pct(r.tasaExportable),
      "De cada 100 cajas que entregas", r.tasaExportable >= 0.78 ? "bien" : "regular");
    html += UI.kpi("Valor liquidado", money(r.valor),
      pct(r.pctCalidadA) + " de tu fruta entra como calidad A", "neutro");
    html += "</section>";

    return html;
  }

  function tarjetaLote(l) {
    const linea = DB.linea(l.lineaId);
    const paso = DB.ESTADOS.find(function (e) { return e.id === l.estado; });
    const orden = paso ? paso.orden : 0;

    let html = '<article class="lote-tarjeta" data-ficha="' + esc(l.id) + '" tabindex="0" role="button">' +
      '<div class="lote-cab"><span class="lote-codigo">' + esc(l.codigoLote) + "</span>" +
      UI.insignia(l.estado) + "</div>" +
      '<div class="lote-cuerpo">' + UI.etiquetaLinea(l.lineaId) +
      "<strong>" + nf(l.cajasAnunciadas) + " cajas</strong>" +
      '<span class="tenue">' + UI.fechaCorta(l.fecha) + "</span></div>";

    /* Pasos del recorrido: el proveedor ve dónde está su fruta. */
    if (l.estado !== "Rechazado") {
      html += '<ol class="pasos" aria-label="Avance del lote">';
      ["Anunciado", "Recibido", "Procesado", "Cerrado"].forEach(function (nombre, i) {
        html += '<li class="paso' + (i + 1 <= orden ? " paso-hecho" : "") + '">' +
          '<span class="paso-punto" aria-hidden="true"></span>' +
          '<span class="paso-texto">' + esc(nombre) + "</span></li>";
      });
      html += "</ol>";
    } else {
      html += '<p class="lote-rechazo">' + esc(l.observacionesRecepcion || "Lote rechazado.") + "</p>";
    }

    if (l.cajasRecibidas !== null && l.estado !== "Rechazado") {
      const dif = l.cajasRecibidas - l.cajasAnunciadas;
      html += '<p class="lote-dato">Pesado en planta: <strong>' + nf(l.cajasRecibidas) +
        " cajas</strong>" + (dif !== 0
          ? ' <span class="etq ' + (Math.abs(dif / l.cajasAnunciadas) <= 0.01 ? "etq-ok" : "etq-bajo") +
            '">' + (dif > 0 ? "+" : "") + nf(dif) + "</span>" : "") + "</p>";
    }

    html += "</article>";
    return html;
  }

  function vistaLotes() {
    const lotes = misLotes();
    let html = '<div class="vista-cab"><div><h1>Mis envíos</h1>' +
      '<p class="sub">' + lotes.length + " lotes registrados</p></div>" +
      '<button class="btn btn-primario" data-ir="anunciar">+ Anunciar</button></div>';

    if (!lotes.length) {
      return html + '<p class="vacio">Todavía no has anunciado ningún envío.</p>';
    }

    html += '<div class="pila">';
    lotes.forEach(function (l) { html += tarjetaLote(l); });
    html += "</div>";
    return html;
  }

  function vistaDesempeno() {
    const r = resumen();
    const lotes = misLotes();

    /* Desempeño por línea de producto, solo del propio proveedor. */
    const porLinea = {};
    lotes.forEach(function (l) {
      if (l.estado === "Rechazado" || l.cajasRecibidas === null) return;
      if (!porLinea[l.lineaId]) {
        const ln = DB.linea(l.lineaId);
        porLinea[l.lineaId] = {
          nombre: ln ? ln.nombre : "—", color: ln ? ln.color : "#888",
          meta: ln ? ln.metaExportable : 0,
          cajas: 0, anunciadas: 0, proc: 0, exp: 0, valor: 0
        };
      }
      const b = porLinea[l.lineaId];
      b.cajas += l.cajasRecibidas;
      b.anunciadas += l.cajasAnunciadas;
      b.valor += l.cajasRecibidas * l.precioCaja;
      const p = produccionDe(l.id);
      if (p) { b.proc += p.cajasProcesadas; b.exp += p.cajasExportables; }
    });

    const filas = Object.keys(porLinea).map(function (k) {
      const b = porLinea[k];
      b.tasaExportable = b.proc > 0 ? b.exp / b.proc : 0;
      b.tasaDiferencia = b.anunciadas > 0 ? (b.cajas - b.anunciadas) / b.anunciadas : 0;
      return b;
    }).sort(function (a, b) { return b.cajas - a.cajas; });

    let html = '<div class="vista-cab"><div><h1>Mi desempeño</h1>' +
      '<p class="sub">Cómo rinde tu fruta en planta. Solo tus datos.</p></div></div>';

    html += '<section class="kpis kpis-portal">';
    html += UI.kpi("Exactitud al declarar", UI.pctFirmado(r.tasaDiferencia),
      nf(Math.abs(r.diferencia)) + " cajas de diferencia acumulada",
      Math.abs(r.tasaDiferencia) <= 0.01 ? "bien" : Math.abs(r.tasaDiferencia) <= 0.03 ? "regular" : "mal");
    html += UI.kpi("Fruta exportable", pct(r.tasaExportable), "De lo que entregas",
      r.tasaExportable >= 0.78 ? "bien" : "regular");
    html += UI.kpi("Calidad A", pct(r.pctCalidadA), "Verificada en planta",
      r.pctCalidadA >= 0.6 ? "bien" : "regular");
    html += UI.kpi("Lotes rechazados", nf(r.rechazados), pct(r.tasaRechazo) + " de tus envíos",
      r.rechazados === 0 ? "bien" : "mal");
    html += "</section>";

    if (filas.length) {
      html += '<section class="panel"><h2>Por línea de producto</h2>' +
        UI.tabla([
          { titulo: "Línea", valor: function (b) {
            return '<span class="linea-tag" style="--linea:' + esc(b.color) +
              '"><span class="linea-punto"></span>' + esc(b.nombre) + "</span>";
          } },
          { titulo: "Cajas", num: true, valor: function (b) { return nf(b.cajas); } },
          { titulo: "Exactitud", num: true, valor: function (b) {
            const clase = Math.abs(b.tasaDiferencia) <= 0.01 ? "etq-ok" : "etq-bajo";
            return '<span class="etq ' + clase + '">' + UI.pctFirmado(b.tasaDiferencia) + "</span>";
          } },
          { titulo: "Exportable", num: true, valor: function (b) {
            return '<span class="etq ' + (b.tasaExportable >= b.meta ? "etq-ok" : "etq-bajo") + '">' +
              pct(b.tasaExportable) + "</span>";
          } },
          { titulo: "Meta", num: true, valor: function (b) { return pct(b.meta); } },
          { titulo: "Liquidado", num: true, valor: function (b) { return money(b.valor); } }
        ], filas, {}) + "</section>";
    }

    /* Qué está costando pérdidas, con lo que el proveedor puede corregir. */
    const campo = {};
    lotes.forEach(function (l) {
      const p = produccionDe(l.id);
      causasDeCampo(p).forEach(function (m) {
        campo[m.causaId] = (campo[m.causaId] || 0) + m.kg;
      });
    });
    const causas = Object.keys(campo).map(function (k) {
      const c = DB.causa(k);
      return { nombre: c ? c.nombre : k, kg: campo[k] };
    }).sort(function (a, b) { return b.kg - a.kg; });

    html += '<section class="panel"><h2>Qué se descarta de tu fruta</h2>' +
      '<p class="sub panel-sub">Solo las causas que se originan en campo — las que ' +
      "puedes corregir desde la finca. Las causas internas de la planta no se " +
      "te atribuyen.</p>";
    if (causas.length) {
      html += Graficos.barras(causas, { campo: "kg", sufijo: " kg", color: "#c0246b" });
    } else {
      html += '<p class="vacio">Todavía no hay descarte de origen de campo registrado en tus lotes.</p>';
    }
    html += "</section>";

    return html;
  }

  /* --------------------------------------------------------- anunciar */

  function formAnunciar() {
    const lineas = DB.all("lineas").filter(function (l) { return l.activa; });

    const campos = [
      { nombre: "lineaId", etiqueta: "¿Qué producto envías?", tipo: "select", requerido: true,
        vacio: "Selecciona…", ayuda: "Al elegirlo se precarga el peso nominal de su caja.",
        opciones: lineas.map(function (l) { return { valor: l.id, texto: l.nombre }; }) },
      { nombre: "fecha", etiqueta: "Fecha del envío", tipo: "date", valor: DB.hoy(),
        requerido: true, ancho: "mitad",
        validar: function (v) { return v > DB.hoy() ? "La fecha no puede ser futura." : null; } },
      { nombre: "cajasAnunciadas", etiqueta: "¿Cuántas cajas envías?", tipo: "number",
        requerido: true, min: 1, max: 5000, paso: "1", ancho: "mitad",
        ayuda: "Cajas de " + DB.PESO_CAJA_KG + " kg. Recepción las contará y pesará al llegar." },
      { nombre: "pesoCajaDeclarado", etiqueta: "Peso estimado por caja (kg)", tipo: "number",
        requerido: true, min: 1, max: 60, paso: "0.1", ancho: "mitad",
        ayuda: "El peso nominal es " + DB.PESO_CAJA_KG + " kg. Ajústalo si tus cajas " +
          "van más llenas o más livianas: la planta pesará en báscula y comparará.",
        validar: function (v, d) {
          const l = DB.linea(d.lineaId);
          if (!l) return null;
          const min = l.pesoCajaKg * 0.6, max = l.pesoCajaKg * 1.5;
          if (v < min || v > max) {
            return "Un peso de " + nf(v, 1) + " kg por caja se aleja mucho del nominal (" +
              nf(l.pesoCajaKg, 1) + " kg). Si es correcto, avísale a la planta en las observaciones.";
          }
          return null;
        } },
      { nombre: "calidadDeclarada", etiqueta: "Calidad que declaras", tipo: "select",
        requerido: true, ancho: "mitad", valor: "A",
        opciones: DB.CALIDADES.map(function (c) { return { valor: c.id, texto: c.nombre }; }) },
      { nombre: "transporte", etiqueta: "Transporte", tipo: "select", ancho: "mitad",
        valor: "Propio",
        opciones: [{ valor: "Propio", texto: "Propio" }, { valor: "Contratado", texto: "Contratado" }] },
      { nombre: "resumenCalc", etiqueta: "Equivalencia del envío", tipo: "calculado",
        ayuda: "Peso y valor estimados. Se liquidará sobre lo que pese la báscula." },
      { nombre: "observacionesProveedor", etiqueta: "¿Algo que deba saber la planta?",
        tipo: "textarea", marcador: "Estado de la fruta, hora de salida, novedades del viaje." }
    ];

    UI.abrirFormulario("Anunciar un envío", campos, function (d) {
      const linea = DB.linea(d.lineaId);
      const n = DB.all("lotes").length + 1;
      const lote = DB.insert("lotes", {
        folio: DB.siguienteFolio("lotes", "LOT"),
        codigoLote: linea.codigo + d.fecha.replace(/-/g, "").slice(2) + "-" + String(n).padStart(3, "0"),
        fecha: d.fecha,
        proveedorId: usuario.proveedorId,
        lineaId: d.lineaId,
        cajasAnunciadas: Number(d.cajasAnunciadas),
        pesoCajaDeclarado: Number(d.pesoCajaDeclarado),
        kgAnunciados: Math.round(Number(d.cajasAnunciadas) * Number(d.pesoCajaDeclarado)),
        calidadDeclarada: d.calidadDeclarada,
        precioCaja: linea.precioCaja,
        transporte: d.transporte || "Propio",
        observacionesProveedor: d.observacionesProveedor || "",
        anunciadoPor: usuario.id,
        creadoEn: new Date().toISOString(),
        fechaRecepcion: null, cajasRecibidas: null, kgRecibidos: null,
        calidadVerificada: null, observacionesRecepcion: "", recibidoPor: null,
        estado: "Anunciado",
        fechaCierre: null, cerradoPor: null, reporteEnviado: false, fechaReporte: null
      });

      DB.registrarBitacora(usuario.id, "Anuncio de envío",
        lote.codigoLote + " · " + nf(lote.cajasAnunciadas) + " cajas de " + linea.nombre);
      UI.aviso("Envío " + lote.codigoLote + " anunciado. La planta ya lo ve en su cola.");
      vista = "inicio";
      render();
    }, {
      aceptar: "Anunciar envío",
      nota: "La planta verá tu envío al instante y lo pesará cuando llegue.",
      alCambiar: function (d, form) {
        const linea = DB.linea(d.lineaId);
        const campoPeso = $("#campo_pesoCajaDeclarado", form);

        /* Al elegir la línea se sugiere su peso nominal, pero solo si el
           proveedor todavía no escribió el suyo. */
        if (linea && campoPeso && !campoPeso.value) campoPeso.value = linea.pesoCajaKg;

        const out = $("#resumenCalc", form);
        if (!out) return;
        const c = Number(d.cajasAnunciadas) || 0;
        const peso = Number(d.pesoCajaDeclarado) || (linea ? linea.pesoCajaKg : 0);
        if (!linea || !c) { out.textContent = "—"; return; }
        const kg = c * peso;
        const nominal = c * linea.pesoCajaKg;
        out.innerHTML = nf(kg) + " kg · " + '<span class="tenue">aprox.</span> ' +
          money(c * linea.precioCaja) +
          (Math.abs(kg - nominal) > nominal * 0.02
            ? '<br><small class="tenue">' + (kg > nominal ? "+" : "") + nf(kg - nominal) +
              " kg respecto al peso nominal</small>" : "");
      }
    });
  }

  /* ------------------------------------------------ ficha / reporte */

  function verFicha(loteId) {
    const l = DB.get("lotes", loteId);
    if (!l || l.proveedorId !== usuario.proveedorId) return;   // aislamiento
    const f = Indicadores.fichaLote(loteId);
    const p = f.produccion;

    let cuerpo = '<div class="ficha">';

    cuerpo += '<div class="ficha-linea">';
    [["Anunciado", l.fecha, true],
     [l.estado === "Rechazado" ? "Rechazado" : "Pesado", l.fechaRecepcion, l.cajasRecibidas !== null],
     ["Procesado", p ? p.fecha : null, !!p],
     ["Cerrado", l.fechaCierre, l.estado === "Cerrado"]].forEach(function (h, i) {
      cuerpo += '<div class="ficha-hito' + (h[2] ? " hito-hecho" : "") + '">' +
        '<span class="hito-punto">' + (i + 1) + "</span><strong>" + esc(h[0]) + "</strong>" +
        "<small>" + (h[1] ? UI.fechaLarga(h[1]) : "Pendiente") + "</small></div>";
    });
    cuerpo += "</div>";

    cuerpo += '<div class="ficha-bloques">';

    cuerpo += "<section><h4>Tu envío</h4><dl>" +
      "<dt>Lote</dt><dd><code>" + esc(l.codigoLote) + "</code></dd>" +
      "<dt>Producto</dt><dd>" + esc(f.linea ? f.linea.nombre : "—") + "</dd>" +
      "<dt>Cajas anunciadas</dt><dd>" + nf(l.cajasAnunciadas) + "</dd>" +
      "<dt>Peso que declaraste</dt><dd>" + nf(l.pesoCajaDeclarado || 0, 1) + " kg/caja · " +
      nf(l.kgAnunciados || 0) + " kg</dd>" +
      "<dt>Calidad declarada</dt><dd>" + esc(l.calidadDeclarada) + "</dd>" +
      "<dt>Transporte</dt><dd>" + esc(l.transporte) + "</dd></dl></section>";

    if (l.cajasRecibidas !== null && l.estado !== "Rechazado") {
      cuerpo += "<section><h4>Lo que recibió la planta</h4><dl>" +
        "<dt>Cajas pesadas</dt><dd><strong>" + nf(l.cajasRecibidas) + "</strong></dd>" +
        "<dt>Peso real</dt><dd>" + nf(l.kgRecibidos) + " kg · " +
        nf(f.pesoCajaReal || 0, 1) + " kg/caja</dd>" +
        "<dt>Diferencia de peso</dt><dd>" + (f.tasaDiferenciaKg === null ? "—" :
          '<span class="etq ' + (Math.abs(f.tasaDiferenciaKg) <= 0.02 ? "etq-ok" : "etq-bajo") + '">' +
          (f.diferenciaKg > 0 ? "+" : "") + nf(f.diferenciaKg) + " kg · " +
          UI.pctFirmado(f.tasaDiferenciaKg) + "</span>") + "</dd>" +
        "<dt>Diferencia</dt><dd>" + (f.diferenciaCajas === null ? "—" :
          '<span class="etq ' + (Math.abs(f.tasaDiferencia) <= 0.01 ? "etq-ok" : "etq-bajo") + '">' +
          (f.diferenciaCajas > 0 ? "+" : "") + nf(f.diferenciaCajas) + " cajas · " +
          UI.pctFirmado(f.tasaDiferencia) + "</span>") + "</dd>" +
        "<dt>Calidad verificada</dt><dd>" + esc(l.calidadVerificada || "—") +
        (l.calidadVerificada && l.calidadVerificada !== l.calidadDeclarada
          ? ' <span class="etq etq-bajo">bajó</span>' : "") + "</dd>" +
        "<dt>A liquidar</dt><dd><strong>" + money(f.valor) + "</strong></dd></dl></section>";
    }

    if (p) {
      cuerpo += "<section><h4>Cómo rindió tu fruta</h4><dl>" +
        "<dt>Cajas procesadas</dt><dd>" + nf(p.cajasProcesadas) + "</dd>" +
        "<dt>Cajas exportables</dt><dd><strong>" + nf(p.cajasExportables) + "</strong></dd>" +
        "<dt>Rendimiento</dt><dd>" +
        '<span class="etq ' + (f.tasaExportable >= f.meta ? "etq-ok" : "etq-bajo") + '">' +
        pct(f.tasaExportable) + "</span> (meta " + pct(f.meta) + ")</dd></dl></section>";

      const campo = causasDeCampo(p);
      if (campo.length) {
        const totalCampo = campo.reduce(function (a, m) { return a + m.kg; }, 0);
        cuerpo += '<section class="ficha-mermas"><h4>Descarte originado en campo</h4>' +
          '<ul class="lista-mermas">';
        campo.forEach(function (m) {
          const c = DB.causa(m.causaId);
          cuerpo += "<li><span>" + esc(c ? c.nombre : m.causaId) + "</span>" +
            '<span class="barra-mini"><span style="width:' +
            ((m.kg / totalCampo) * 100).toFixed(1) + '%"></span></span>' +
            "<strong>" + nf(m.kg) + " kg</strong></li>";
        });
        cuerpo += "</ul></section>";
      }
    }

    if (l.observacionesRecepcion) {
      cuerpo += '<section class="ficha-notas"><h4>Nota de la planta</h4><p>' +
        esc(l.observacionesRecepcion) + "</p></section>";
    }

    cuerpo += "</div></div>";
    abrirPanel("Lote " + l.codigoLote, cuerpo);
  }

  function abrirPanel(titulo, cuerpo) {
    const capa = document.createElement("div");
    capa.className = "modal-capa";
    capa.innerHTML = '<div class="modal modal-ancho" role="dialog" aria-modal="true" aria-labelledby="panelTitulo">' +
      '<header class="modal-cab"><h2 id="panelTitulo">' + esc(titulo) + "</h2>" +
      '<button type="button" class="modal-x" aria-label="Cerrar">&times;</button></header>' +
      '<div class="modal-cuerpo modal-cuerpo-libre">' + cuerpo + "</div>" +
      '<footer class="modal-pie modal-pie-fijo">' +
      '<button type="button" class="btn btn-plano" data-cancelar>Cerrar</button></footer></div>';

    document.body.appendChild(capa);
    document.body.classList.add("sin-scroll");

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
  }

  /* =============================== acceso ============================= */

  function vistaAcceso() {
    let html = '<div class="acceso-capa acceso-proveedor"><div class="acceso-caja">' +
      '<div class="acceso-marca"><span class="logo" aria-hidden="true">🚜</span>' +
      "<div><strong>Portal del Proveedor</strong><small>" + esc(DB.EMPRESA.nombre) +
      "</small></div></div>" +
      '<p class="acceso-intro">Entra con el código que te dio la planta.</p>' +
      '<form id="formAcceso" novalidate>' +
      '<div class="campo"><label for="acceso">Código de proveedor</label>' +
      '<input type="text" id="acceso" name="acceso" autocomplete="username" ' +
      'placeholder="PRV-001" autocapitalize="characters" spellcheck="false" required></div>' +
      '<div class="campo"><label for="clave">Contraseña</label>' +
      '<div class="campo-clave">' +
      '<input type="password" id="clave" name="clave" autocomplete="current-password" required>' +
      '<button type="button" class="ver-clave" id="verClave" aria-label="Mostrar la contraseña">👁</button>' +
      "</div></div>" +
      '<label class="check check-recordar"><input type="checkbox" id="recordar" checked> ' +
      "No cerrar sesión en este teléfono</label>" +
      '<p class="form-error" id="accesoError" role="alert" hidden></p>' +
      estadoConexionHTML() +
      '<button type="submit" class="btn btn-primario btn-ancho btn-grande" id="btnEntrar">Entrar</button>' +
      "</form>";

    html += '<p class="acceso-ayuda">¿Olvidaste tu contraseña? La planta puede generarte ' +
      "una nueva desde el sistema interno.</p>";
    html += '<p class="acceso-pie">¿Trabajas en la planta? ' +
      '<a ' + UI.rutaOtraApp("interno") + ">Entra al sistema interno</a></p>";
    html += "</div></div>";
    return html;
  }

  /* Al entrar con una contraseña temporal hay que cambiarla antes de seguir:
     la que entregó la planta la conocen dos personas. */
  function formCambiarClave(obligatorio) {
    const pol = Auth.politica("proveedor");
    UI.abrirFormulario(obligatorio ? "Crea tu contraseña" : "Cambiar contraseña", [
      { tipo: "html", contenido: '<p class="modal-nota">' + (obligatorio
        ? "Estás usando la contraseña temporal que te dio la planta. Crea la tuya para continuar."
        : "Elige una contraseña nueva para este acceso.") + "</p>" },
      { nombre: "nueva", etiqueta: pol.nombre + " nueva", tipo: "password", requerido: true,
        ayuda: pol.ayuda,
        validar: function (v) { return Auth.revisar(v, "proveedor"); } },
      { nombre: "repetir", etiqueta: "Repítela", tipo: "password", requerido: true,
        validar: function (v, d) { return v === d.nueva ? null : "Las dos no coinciden."; } }
    ], function (d) {
      Auth.crearCredencial(d.nueva).then(function (cred) {
        DB.update("usuarios", usuario.id, { credencial: cred, debeCambiar: false });
        usuario = DB.get("usuarios", usuario.id);
        DB.registrarBitacora(usuario.id, "Cambio de contraseña", usuario.nombre);
        UI.aviso("Contraseña actualizada.");
        render();
      });
    }, { aceptar: "Guardar contraseña" });
  }

  /* =============================== render ============================= */

  function render() {
    const app = $("#app");

    if (!usuario) {
      UI.soltarFormulario();
      app.innerHTML = vistaAcceso();
      enlazarAcceso();
      return;
    }

    const menu = [
      { id: "inicio", texto: "Inicio", icono: "🏠" },
      { id: "lotes", texto: "Mis envíos", icono: "📦" },
      { id: "desempeno", texto: "Mi desempeño", icono: "📈" }
    ];

    let html = '<div class="portal">';
    html += '<header class="portal-barra">' +
      '<div class="portal-marca"><span aria-hidden="true">🚜</span>' +
      "<div><strong>Portal del Proveedor</strong><small>" + esc(miProveedor().nombre) +
      "</small></div></div>" +
      '<div class="portal-acciones">' +
      '<button class="btn btn-plano btn-sm" id="btnClave" title="Cambiar contraseña">🔑</button>' +
      '<button class="btn btn-plano btn-sm" id="btnSalir">Salir</button></div></header>';

    html += '<main id="contenido" tabindex="-1">';
    if (vista === "inicio") html += vistaInicio();
    else if (vista === "lotes") html += vistaLotes();
    else if (vista === "desempeno") html += vistaDesempeno();
    html += "</main>";

    /* Barra inferior: en el celular es la navegación natural. */
    html += '<nav class="portal-nav" aria-label="Secciones">';
    menu.forEach(function (m) {
      html += '<button type="button" class="portal-nav-item' + (m.id === vista ? " activo" : "") +
        '" data-ir="' + m.id + '"' + (m.id === vista ? ' aria-current="page"' : "") + ">" +
        '<span aria-hidden="true">' + m.icono + "</span>" + esc(m.texto) + "</button>";
    });
    html += "</nav></div>";

    UI.soltarFormulario();
    app.innerHTML = html;
    enlazar();
  }

  function enlazarAcceso() {
    const form = $("#formAcceso");
    const error = $("#accesoError");
    const boton = $("#btnEntrar");
    UI.vigilarFormulario(form);

    const ver = $("#verClave");
    if (ver) {
      ver.addEventListener("click", function () {
        const campo = $("#clave");
        const oculto = campo.type === "password";
        campo.type = oculto ? "text" : "password";
        ver.setAttribute("aria-label", oculto ? "Ocultar la contraseña" : "Mostrar la contraseña");
        campo.focus();
      });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      error.hidden = true;
      boton.disabled = true;
      boton.textContent = "Comprobando…";

      entrar(form.acceso.value, form.clave.value, $("#recordar").checked)
        .then(function (r) {
          if (r.error) {
            error.textContent = r.error;
            error.hidden = false;
            boton.disabled = false;
            boton.textContent = "Entrar";
            $("#clave").value = "";
            $("#clave").focus();
            return;
          }
          render();
          UI.aviso("Bienvenido, " + usuario.nombre + ".");
          if (r.debeCambiar) formCambiarClave(true);
        });
    });
  }

  function enlazar() {
    $$("[data-ir]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.dataset.ir === "anunciar") { formAnunciar(); return; }
        vista = b.dataset.ir;
        render();
        const m = $("#contenido");
        if (m) m.focus();
      });
    });

    $$("[data-ficha]").forEach(function (el) {
      el.addEventListener("click", function () { verFicha(el.dataset.ficha); });
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); verFicha(el.dataset.ficha); }
      });
    });

    const salirBtn = $("#btnSalir");
    if (salirBtn) salirBtn.addEventListener("click", salir);

    const claveBtn = $("#btnClave");
    if (claveBtn) claveBtn.addEventListener("click", function () { formCambiarClave(false); });
  }

  /* ============================== arranque ============================ */

  /* Un cambio llegado de otro dispositivo no debe reconstruir la pantalla
     encima de alguien que está escribiendo: se perdería lo tecleado. Se
     posterga hasta que el campo suelte el foco, y en la pantalla de acceso
     no se repinta en absoluto, porque ahí no hay nada que sincronizar. */
  let repintado = null;

  function repintarPorSincronizacion() {
    if (!usuario) return;
    if (repintado) return;
    repintado = setTimeout(function () {
      repintado = null;
      /* La sesión se vuelve a comprobar aquí: pudo cerrarse entre que se
         programó el repintado y el momento en que dispara. */
      if (!usuario) return;
      UI.repintarSiSeguro(render, repintarPorSincronizacion);
    }, 200);
  }

  /* La pantalla de acceso avisa de que está conectando: sin esto, la espera
     parece que la aplicación no responde. */
  let conectado = false;

  function marcarConectado() {
    conectado = true;
    const el = UI.$("#estadoConexion");
    if (el) {
      el.className = "conexion conexion-ok";
      el.innerHTML = '<span class="conexion-punto" aria-hidden="true"></span>' +
        (DB.esCompartido() ? "Conectado al sistema" : "Modo local, sin conexión compartida");
    }
  }

  function estadoConexionHTML() {
    return '<p class="conexion' + (conectado ? " conexion-ok" : "") + '" id="estadoConexion">' +
      '<span class="conexion-punto" aria-hidden="true"></span>' +
      (conectado
        ? (DB.esCompartido() ? "Conectado al sistema" : "Modo local, sin conexión compartida")
        : "Conectando con el sistema…") + "</p>";
  }

  function iniciar() {
    UI.prepararGuardado();
    DB.load();
    restaurar();
    render();

    DB.alFallarEscritura(function () {
      UI.aviso("No se pudo enviar el cambio. Revisa tu conexión.", "error");
    });

    /* Al conectar cambian los datos, pero si la persona ya está llenando el
       acceso NO se repinta: seria borrarle lo escrito justo antes de entrar. */
    DB.conectar(repintarPorSincronizacion).then(function () {
      return DB.sembrarCredenciales();
    }).then(function () {
      marcarConectado();
      UI.repintarSiSeguro(render, function () { UI.repintarSiSeguro(render); });
    }).catch(function (e) {
      console.warn("Fallo al preparar el acceso:", e);
      marcarConectado();
      UI.repintarSiSeguro(render);
    });
  }

  /* Se expone en vez de arrancar sola: la página propia la inicia, y el
     paquete de las dos aplicaciones decide cuál montar. */
  window.PortalProveedor = { iniciar: function () { UI.alArrancar(iniciar); } };
})();
