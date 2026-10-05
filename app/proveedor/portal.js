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
  const SESION = "acopia.portal.sesion";

  let usuario = null;
  let vista = "inicio";
  let novedadesAbiertas = false;
  /* Texto escrito en el buscador de «Mis envíos». */
  let busqueda = "";

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
      return { error: "Tu cuenta aún no está activada. Usa «Activa tu cuenta aquí» " +
        "para crear tu contraseña." };
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
    novedadesAbiertas = false;
    busqueda = "";
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
    let kgProc = 0, kgExp = 0;
    lotes.forEach(function (l) {
      cajasAnun += Number(l.gavetasAnunciadas) || 0;
      if (l.estado === "Rechazado") { rech += 1; return; }
      if (l.gavetasRecibidas === null) return;
      cajasRec += Number(l.gavetasRecibidas) || 0;
      valor += (Number(l.kgRecibidos) || 0) * (Number(l.precioKg) || 0);
      if (l.calidadVerificada === "A") calA += Number(l.gavetasRecibidas) || 0;
      const p = produccionDe(l.id);
      if (p) {
        cajasProc += Number(p.gavetasProcesadas) || 0;
        cajasExp += Number(p.cajasExportables) || 0;
        /* El rendimiento se mide en kilos: la gaveta que entrega y la caja
           que sale pesan cosas distintas. */
        kgProc += Number(p.kgProcesados) || 0;
        kgExp += Number(p.kgExportable) || 0;
      }
    });

    const pesados = lotes.filter(function (l) {
      return l.gavetasRecibidas !== null && l.estado !== "Rechazado";
    });
    const anunPesadas = pesados.reduce(function (a, l) { return a + l.gavetasAnunciadas; }, 0);

    return {
      lotes: lotes.length, enCurso: enCurso.length, rechazados: rech,
      gavetasAnunciadas: cajasAnun, gavetasRecibidas: cajasRec,
      diferencia: cajasRec - anunPesadas,
      tasaDiferencia: anunPesadas > 0 ? (cajasRec - anunPesadas) / anunPesadas : 0,
      cajasExportables: cajasExp,
      tasaExportable: kgProc > 0 ? kgExp / kgProc : 0,
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
    html += UI.kpi("Cajas entregadas", nf(r.gavetasRecibidas),
      r.lotes + " envíos en total", "linea1");
    html += UI.kpi("Exactitud al declarar", UI.pctFirmado(r.tasaDiferencia),
      "Diferencia entre lo que anuncias y lo que pesa la planta",
      Math.abs(r.tasaDiferencia) <= 0.01 ? "bien" : Math.abs(r.tasaDiferencia) <= 0.03 ? "regular" : "mal");
    html += UI.kpi("Tu fruta exportable", pct(r.tasaExportable),
      "De cada 100 kg que entregas", r.tasaExportable >= 0.78 ? "bien" : "regular");
    html += UI.kpi("Valor liquidado", money(r.valor),
      pct(r.pctCalidadA) + " de tu fruta entra como calidad A", "neutro");
    html += "</section>";

    return html;
  }

  function tarjetaLote(l) {
    const linea = DB.linea(l.lineaId);
    const paso = DB.ESTADOS.find(function (e) { return e.id === l.estado; });
    const orden = paso ? paso.orden : 0;

    const sinEnviar = DB.estaPendiente("lotes", l.id);

    let html = '<article class="lote-tarjeta' + (sinEnviar ? " lote-pendiente" : "") +
      '" data-ficha="' + esc(l.id) + '" tabindex="0" role="button">' +
      '<div class="lote-cab"><span class="lote-codigo">' + esc(l.codigoLote) + "</span>" +
      (sinEnviar
        ? '<span class="estado estado-pendienteenvio">Pendiente de enviar</span>'
        : UI.insignia(l.estado)) + "</div>" +
      '<div class="lote-cuerpo">' + UI.etiquetaLinea(l.lineaId) +
      "<strong>" + nf(l.gavetasAnunciadas) + " gavetas</strong>" +
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

    if (l.gavetasRecibidas !== null && l.estado !== "Rechazado") {
      const dif = l.gavetasRecibidas - l.gavetasAnunciadas;
      html += '<p class="lote-dato">Pesado en planta: <strong>' + nf(l.gavetasRecibidas) +
        " gavetas</strong>" + (dif !== 0
          ? ' <span class="etq ' + (Math.abs(dif / l.gavetasAnunciadas) <= 0.01 ? "etq-ok" : "etq-bajo") +
            '">' + (dif > 0 ? "+" : "") + nf(dif) + "</span>" : "") + "</p>";
    }

    /* Repetir: casi todos los envíos se parecen al anterior. Es el atajo
       que convierte minuto y medio de formulario en diez segundos. */
    html += '<div class="lote-acciones">' +
      '<button type="button" class="btn-mini" data-repetir="' + esc(l.id) + '">' +
      "Repetir este envío</button></div>";

    html += "</article>";
    return html;
  }

  /* Buscar por código, por producto o por estado. Con tres meses de envíos
     encima, desplazarse hasta encontrar uno deja de ser razonable. */
  function coincide(l, texto) {
    if (!texto) return true;
    const t = texto.toLowerCase();
    return [l.codigoLote, l.estado, Indicadores.nombreLinea(l.lineaId),
            UI.fechaCorta(l.fecha), String(l.gavetasAnunciadas)]
      .some(function (c) { return String(c).toLowerCase().indexOf(t) !== -1; });
  }

  function vistaLotes() {
    const todos = misLotes();
    const lotes = todos.filter(function (l) { return coincide(l, busqueda); });

    let html = '<div class="vista-cab"><div><h1>Mis envíos</h1>' +
      '<p class="sub">' + todos.length + " lotes registrados</p></div>" +
      '<button class="btn btn-primario" data-ir="anunciar">+ Anunciar</button></div>';

    if (!todos.length) {
      return html + '<p class="vacio">Todavía no has anunciado ningún envío.</p>';
    }

    html += '<div class="buscador"><label class="sr" for="buscar">Buscar envío</label>' +
      '<input type="search" id="buscar" value="' + esc(busqueda) + '" ' +
      'placeholder="Buscar por código, producto o estado…" autocomplete="off">' +
      (busqueda ? '<button type="button" class="btn btn-plano btn-sm" id="btnLimpiarBusca">Limpiar</button>' : "") +
      "</div>";

    if (!lotes.length) {
      return html + '<p class="vacio">Ningún envío coincide con «' + esc(busqueda) + '».</p>';
    }
    if (busqueda) {
      html += '<p class="sub buscador-cuenta">' + lotes.length + " de " + todos.length +
        " envíos</p>";
    }

    html += '<div class="pila">';
    lotes.forEach(function (l) { html += tarjetaLote(l); });
    html += "</div>";
    return html;
  }

  function novedadesActuales() {
    const lista = Novedades.listar(usuario);
    Novedades.marcarVistos(usuario, lista);
    return lista;
  }

  function enlazarNovedades() {
    const btn = $("#btnCampana");
    if (btn) {
      btn.addEventListener("click", function () {
        novedadesAbiertas = !novedadesAbiertas;
        render();
      });
    }
    const cerrar = $("#cerrarNovedades");
    if (cerrar) {
      cerrar.addEventListener("click", function () { novedadesAbiertas = false; render(); });
    }
    $$("[data-novedad]").forEach(function (b) {
      b.addEventListener("click", function () {
        novedadesAbiertas = false;
        const lote = b.dataset.novedadLote;
        vista = b.dataset.novedad;
        render();
        if (lote) verFicha(lote);
      });
    });
  }

  /* Cuántos días atrás mira la liquidación que ve el proveedor. */
  let diasPago = 30;

  function vistaPagos() {
    const liq = Indicadores.liquidacion(usuario.proveedorId, {
      desde: DB.diasAtras(diasPago), hasta: DB.hoy()
    });

    let html = '<div class="portal-saludo"><h1>Pagos</h1>' +
      '<p class="sub">Lo que la planta te debe por lo que entregaste, sobre el kilo ' +
      "de báscula.</p></div>";

    html += '<div class="atajos"><span>Período:</span>' +
      [[30, "30 días"], [90, "3 meses"], [365, "12 meses"]].map(function (o) {
        return '<button type="button" class="chip' + (diasPago === o[0] ? " chip-activo" : "") +
          '" data-dias-pago="' + o[0] + '">' + o[1] + "</button>";
      }).join("") + "</div>";

    if (!liq || !liq.lotes) {
      return html + '<p class="vacio">No hay entregas registradas en este período.</p>';
    }

    html += '<div class="kpis kpis-portal">' +
      UI.kpi("Total del período", money(liq.importe),
        nf(liq.kg) + " kg en " + nf(liq.lotesPagables) + " entregas", "bien") +
      UI.kpi("Precio promedio", money(liq.precioPromedio) + "/kg",
        "ponderado por kilo") +
      (liq.lotesRechazados
        ? UI.kpi("No recibidas", nf(liq.lotesRechazados),
            "entregas rechazadas, sin pago", "mal")
        : "") +
      "</div>";

    if (liq.enProceso > 0) {
      html += '<p class="aviso-inline"><strong>' + nf(liq.enProceso) +
        (liq.enProceso === 1 ? " entrega sigue" : " entregas siguen") +
        " en planta.</strong> Ya están pesadas, así que ya cuentan en este total: " +
        "se paga por lo que entra, no por lo que sale.</p>";
    }

    html += '<section class="panel"><h2>Detalle</h2>' +
      UI.tabla([
        { titulo: "Fecha", valor: function (d) { return UI.fechaCorta(d.fecha); } },
        { titulo: "Lote", valor: function (d) { return "<code>" + esc(d.codigoLote) + "</code>"; } },
        { titulo: "Kilos", num: true, valor: function (d) {
          return d.rechazado ? "—" : nf(d.kg); } },
        { titulo: "$/kg", num: true, valor: function (d) {
          return d.rechazado ? "—" : money(d.precioKg); } },
        { titulo: "Importe", num: true, valor: function (d) {
          return d.rechazado
            ? '<span class="etq etq-bajo">Rechazado</span>'
            : "<strong>" + money(d.importe) + "</strong>"; } }
      ], liq.detalle, {}) +
      '<div class="liq-total"><span>Total</span><strong>' + money(liq.importe) +
      "</strong></div></section>";

    const rech = liq.detalle.filter(function (d) { return d.rechazado; });
    if (rech.length) {
      html += '<section class="panel"><h2>Lo que no se recibió</h2><ul class="liq-rechazos-lista">';
      rech.forEach(function (d) {
        html += "<li><code>" + esc(d.codigoLote) + "</code> · " + UI.fechaCorta(d.fecha) +
          "<br><small>" + esc(d.motivo) + "</small></li>";
      });
      html += "</ul></section>";
    }

    html += '<p class="nota-info">Este resumen sale de la báscula de planta. Si una cifra ' +
      "no te cuadra, el detalle de cada lote está en <strong>Mis envíos</strong>, con lo " +
      "que declaraste y lo que se pesó.</p>" +
      '<button class="btn btn-plano btn-ancho" id="btnImprimirPago">Guardar o imprimir</button>';

    return html;
  }

  function vistaAyuda() {
    return '<div class="portal-saludo"><h1>Ayuda</h1>' +
      '<p class="sub">Cómo funciona el portal, paso a paso.</p></div>' +
      '<section class="panel">' + Guia.portal() + "</section>" +
      '<button class="btn btn-plano btn-ancho" id="btnImprimirGuia">Guardar o imprimir esta guía</button>';
  }

  function vistaDesempeno() {
    const r = resumen();
    const lotes = misLotes();

    /* Desempeño por línea de producto, solo del propio proveedor. */
    const porLinea = {};
    lotes.forEach(function (l) {
      if (l.estado === "Rechazado" || l.gavetasRecibidas === null) return;
      if (!porLinea[l.lineaId]) {
        const ln = DB.linea(l.lineaId);
        porLinea[l.lineaId] = {
          nombre: ln ? ln.nombre : "—", color: ln ? ln.color : "#888",
          meta: ln ? ln.metaRendimiento : 0,
          cajas: 0, anunciadas: 0, proc: 0, exp: 0, valor: 0
        };
      }
      const b = porLinea[l.lineaId];
      b.cajas += l.gavetasRecibidas;
      b.anunciadas += l.gavetasAnunciadas;
      b.valor += (l.kgRecibidos || 0) * (l.precioKg || 0);
      const p = produccionDe(l.id);
      if (p) { b.proc += p.kgProcesados; b.exp += p.kgExportable; }
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
      nf(Math.abs(r.diferencia)) + " gavetas de diferencia acumulada",
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
          { titulo: "Gavetas", num: true, valor: function (b) { return nf(b.cajas); } },
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

  /* `base` es un envío anterior del que se copian los datos que suelen
     repetirse. La fecha NO se copia: ese envío es de hoy, no de aquel día. */
  function formAnunciar(base) {
    const lineas = DB.all("lineas").filter(function (l) { return l.activa; });
    const b = base || {};

    /* El orden es el de la cabeza de quien lo llena: qué mando, cuánto,
       cuánto pesa y —de inmediato— a cuántos kilos y a cuánto dinero
       equivale. El resumen iba al final, donde el pie del celular lo
       tapaba justo antes de guardar. */
    const campos = [
      { nombre: "lineaId", etiqueta: "¿Qué producto envías?", tipo: "select", requerido: true,
        vacio: "Selecciona…", valor: b.lineaId || "",
        ayuda: "Al elegirlo se precarga el peso nominal de su gaveta.",
        opciones: lineas.map(function (l) { return { valor: l.id, texto: l.nombre }; }) },
      { nombre: "gavetasAnunciadas", etiqueta: "¿Cuántas gavetas envías?", tipo: "number",
        requerido: true, min: 1, max: 5000, paso: "1", ancho: "mitad",
        valor: b.gavetasAnunciadas || "",
        ayuda: "Gavetas tal como salen de la finca. Recepción las contará y pesará al llegar." },
      { nombre: "pesoGavetaDeclarado", etiqueta: "Peso estimado por gaveta (kg)", tipo: "number",
        requerido: true, min: 1, max: 60, paso: "0.1", ancho: "mitad",
        valor: b.pesoGavetaDeclarado || "",
        ayuda: "Ajústalo si tus gavetas van más llenas o más livianas: la planta " +
          "pesará en báscula y comparará.",
        validar: function (v, d) {
          const l = DB.linea(d.lineaId);
          if (!l) return null;
          const min = l.pesoGavetaKg * 0.6, max = l.pesoGavetaKg * 1.5;
          if (v < min || v > max) {
            return "Un peso de " + nf(v, 1) + " kg por gaveta se aleja mucho del nominal (" +
              nf(l.pesoGavetaKg, 1) + " kg). Si es correcto, avísale a la planta en las observaciones.";
          }
          return null;
        } },
      { nombre: "resumenCalc", etiqueta: "Esto es lo que estás enviando", tipo: "calculado",
        ayuda: "Peso y valor aproximados. Se liquida sobre lo que pese la báscula de planta." },
      { nombre: "fecha", etiqueta: "Fecha del envío", tipo: "date", valor: DB.hoy(),
        requerido: true, ancho: "mitad",
        validar: function (v) { return v > DB.hoy() ? "La fecha no puede ser futura." : null; } },
      { nombre: "calidadDeclarada", etiqueta: "Calidad que declaras", tipo: "select",
        requerido: true, ancho: "mitad", valor: b.calidadDeclarada || "A",
        opciones: DB.CALIDADES.map(function (c) { return { valor: c.id, texto: c.nombre }; }) },
      { nombre: "transporte", etiqueta: "Transporte", tipo: "select", ancho: "mitad",
        valor: b.transporte || "Propio",
        opciones: [{ valor: "Propio", texto: "Propio" }, { valor: "Contratado", texto: "Contratado" }] },
      { nombre: "observacionesProveedor", etiqueta: "¿Algo que deba saber la planta?",
        tipo: "textarea", marcador: "Estado de la fruta, hora de salida, novedades del viaje." }
    ];

    UI.abrirFormulario(base ? "Repetir el envío " + base.codigoLote : "Anunciar un envío",
      campos, function (d) {
      const linea = DB.linea(d.lineaId);
      const n = DB.all("lotes").length + 1;
      const lote = DB.insert("lotes", {
        folio: DB.siguienteFolio("lotes", "LOT"),
        codigoLote: linea.codigo + d.fecha.replace(/-/g, "").slice(2) + "-" + String(n).padStart(3, "0"),
        fecha: d.fecha,
        proveedorId: usuario.proveedorId,
        lineaId: d.lineaId,
        gavetasAnunciadas: Number(d.gavetasAnunciadas),
        pesoGavetaDeclarado: Number(d.pesoGavetaDeclarado),
        kgAnunciados: Math.round(Number(d.gavetasAnunciadas) * Number(d.pesoGavetaDeclarado)),
        calidadDeclarada: d.calidadDeclarada,
        precioKg: linea.valorKgProductor,
        transporte: d.transporte || "Propio",
        observacionesProveedor: d.observacionesProveedor || "",
        anunciadoPor: usuario.id,
        creadoEn: new Date().toISOString(),
        fechaRecepcion: null, gavetasRecibidas: null, kgRecibidos: null,
        calidadVerificada: null, observacionesRecepcion: "", recibidoPor: null,
        estado: "Anunciado",
        fechaCierre: null, cerradoPor: null, reporteEnviado: false, fechaReporte: null
      });

      DB.registrarBitacora(usuario.id, "Anuncio de envío",
        lote.codigoLote + " · " + nf(lote.gavetasAnunciadas) + " gavetas de " + linea.nombre);
      UI.aviso(DB.estaPendiente("lotes", lote.id)
        ? "Envío " + lote.codigoLote + " guardado. Se enviará solo cuando vuelva la señal."
        : "Envío " + lote.codigoLote + " anunciado. La planta ya lo ve en su cola.");
      vista = "inicio";
      render();
    }, {
      aceptar: "Anunciar envío",
      nota: base
        ? "Copiado de <strong>" + esc(base.codigoLote) + "</strong>, con la fecha de hoy. " +
          "Cambia lo que sea distinto antes de guardar."
        : "La planta verá tu envío al instante y lo pesará cuando llegue.",
      alCambiar: function (d, form) {
        const linea = DB.linea(d.lineaId);
        const campoPeso = $("#campo_pesoGavetaDeclarado", form);

        /* Al elegir la línea se sugiere su peso nominal, pero solo si el
           proveedor todavía no escribió el suyo. */
        if (linea && campoPeso && !campoPeso.value) campoPeso.value = linea.pesoGavetaKg;

        const out = $("#resumenCalc", form);
        if (!out) return;
        const c = Number(d.gavetasAnunciadas) || 0;
        const peso = Number(d.pesoGavetaDeclarado) || (linea ? linea.pesoGavetaKg : 0);
        if (!linea || !c) { out.textContent = "—"; return; }
        const kg = c * peso;
        const nominal = c * linea.pesoGavetaKg;
        out.innerHTML = nf(kg) + " kg · " + '<span class="tenue">aprox.</span> ' +
          money(kg * linea.valorKgProductor) +
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
     [l.estado === "Rechazado" ? "Rechazado" : "Pesado", l.fechaRecepcion, l.gavetasRecibidas !== null],
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
      "<dt>Cajas anunciadas</dt><dd>" + nf(l.gavetasAnunciadas) + "</dd>" +
      "<dt>Peso que declaraste</dt><dd>" + nf(l.pesoGavetaDeclarado || 0, 1) + " kg/gaveta · " +
      nf(l.kgAnunciados || 0) + " kg</dd>" +
      "<dt>Calidad declarada</dt><dd>" + esc(l.calidadDeclarada) + "</dd>" +
      "<dt>Transporte</dt><dd>" + esc(l.transporte) + "</dd></dl></section>";

    if (l.gavetasRecibidas !== null && l.estado !== "Rechazado") {
      cuerpo += "<section><h4>Lo que recibió la planta</h4><dl>" +
        "<dt>Gavetas pesadas</dt><dd><strong>" + nf(l.gavetasRecibidas) + "</strong></dd>" +
        "<dt>Peso real</dt><dd>" + nf(l.kgRecibidos) + " kg · " +
        nf(f.pesoGavetaReal || 0, 1) + " kg/gaveta</dd>" +
        "<dt>Diferencia de peso</dt><dd>" + (f.tasaDiferenciaKg === null ? "—" :
          '<span class="etq ' + (Math.abs(f.tasaDiferenciaKg) <= 0.02 ? "etq-ok" : "etq-bajo") + '">' +
          (f.diferenciaKg > 0 ? "+" : "") + nf(f.diferenciaKg) + " kg · " +
          UI.pctFirmado(f.tasaDiferenciaKg) + "</span>") + "</dd>" +
        "<dt>Diferencia</dt><dd>" + (f.diferenciaGavetas === null ? "—" :
          '<span class="etq ' + (Math.abs(f.tasaDiferencia) <= 0.01 ? "etq-ok" : "etq-bajo") + '">' +
          (f.diferenciaGavetas > 0 ? "+" : "") + nf(f.diferenciaGavetas) + " gavetas · " +
          UI.pctFirmado(f.tasaDiferencia) + "</span>") + "</dd>" +
        "<dt>Calidad verificada</dt><dd>" + esc(l.calidadVerificada || "—") +
        (l.calidadVerificada && l.calidadVerificada !== l.calidadDeclarada
          ? ' <span class="etq etq-bajo">bajó</span>' : "") + "</dd>" +
        "<dt>A liquidar</dt><dd><strong>" + money(f.valor) + "</strong></dd></dl></section>";
    }

    if (p) {
      cuerpo += "<section><h4>Cómo rindió tu fruta</h4><dl>" +
        "<dt>Cajas procesadas</dt><dd>" + nf(p.gavetasProcesadas) + "</dd>" +
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
      '<div class="acceso-marca"><span class="logo" aria-hidden="true">' + UI.icono("marca") + '</span>' +
      "<div><strong>Portal del Proveedor</strong><small>" + esc(DB.MARCA.producto) +
      "</small></div></div>" +
      '<p class="acceso-intro">Entra con el código que te dio la planta.</p>' +
      '<form id="formAcceso" novalidate>' +
      '<div class="campo"><label for="acceso">Código de proveedor</label>' +
      '<input type="text" id="acceso" name="acceso" autocomplete="username" ' +
      'placeholder="PRV-001" autocapitalize="characters" spellcheck="false" required></div>' +
      '<div class="campo"><label for="clave">Contraseña</label>' +
      '<div class="campo-clave">' +
      '<input type="password" id="clave" name="clave" autocomplete="current-password" required>' +
      '<button type="button" class="ver-clave" id="verClave" aria-label="Mostrar la contraseña">' + UI.icono("ojo") + '</button>' +
      "</div></div>" +
      '<label class="check check-recordar"><input type="checkbox" id="recordar" checked> ' +
      "No cerrar sesión en este teléfono</label>" +
      '<p class="form-error" id="accesoError" role="alert" hidden></p>' +
      estadoConexionHTML() +
      '<button type="submit" class="btn btn-primario btn-ancho btn-grande" id="btnEntrar">Entrar</button>' +
      "</form>" + demoHTML();

    html += '<p class="acceso-ayuda">¿Es tu primera vez? ' +
      '<button type="button" class="enlace" id="btnActivar">Activa tu cuenta aquí</button>' +
      " — creas tu propia contraseña, nadie te la dicta.<br>" +
      "¿La olvidaste? Pide en la planta que habiliten la reactivación y vuelve aquí.</p>";
    html += '<p class="acceso-pie">¿Trabajas en la planta? ' +
      '<a ' + UI.rutaOtraApp("interno") + ">Entra al sistema interno</a></p>";
    html += "</div></div>";
    return html;
  }

  /* Activación: el proveedor elige su propia contraseña la primera vez. La
     planta solo le dio su código; nadie tuvo que dictarle una clave, que es
     el paso donde estas cosas se pierden o se filtran. */
  function formActivar() {
    UI.abrirFormulario("Activa tu cuenta", [
      { tipo: "html", contenido: '<p class="modal-nota">Necesitas el <strong>código' +
        "</strong> que te dio la planta y el <strong>RUC o cédula</strong> con el que " +
        "te registraron. Después eliges tu contraseña: solo la sabrás tú.</p>" },
      { nombre: "codigo", etiqueta: "Código de proveedor", tipo: "text", requerido: true,
        marcador: "PRV-001", ancho: "mitad" },
      { nombre: "documento", etiqueta: "Tu RUC o cédula", tipo: "text", requerido: true,
        marcador: "0991234567001", ancho: "mitad",
        ayuda: "El mismo con el que te registró la planta." },
      { nombre: "clave", etiqueta: "Crea tu contraseña", tipo: "password", requerido: true,
        ayuda: Auth.politica("proveedor").ayuda,
        validar: function (v) { return Auth.revisar(v, "proveedor"); } },
      { nombre: "repetir", etiqueta: "Repítela", tipo: "password", requerido: true,
        validar: function (v, d) { return v === d.clave ? null : "Las dos no coinciden."; } }
    ], function (d) {
      const r = DB.comprobarActivacion(d.codigo, d.documento);

      if (r.error === "ya-activa") {
        return { error: "Esa cuenta ya está activa. Entra con tu contraseña, o pide en " +
          "la planta que habiliten la reactivación." };
      }
      if (r.error === "inactivo") {
        return { error: "Ese proveedor está desactivado. Comunícate con la planta." };
      }
      if (r.error) {
        return { error: "El código y el documento no coinciden con ningún proveedor " +
          "registrado. Revísalos o consulta con la planta." };
      }

      return Auth.crearCredencial(d.clave).then(function (cred) {
        DB.update("usuarios", r.usuario.id, {
          credencial: cred, debeCambiar: false, pendienteActivacion: false,
          activadoEn: new Date().toISOString()
        });
        usuario = DB.get("usuarios", r.usuario.id);
        UI.abrirSesion(SESION, usuario.id, true);
        DB.registrarBitacora(usuario.id, "Activación de cuenta",
          r.proveedor.nombre + " creó su contraseña");
        UI.aviso("Cuenta activada. Bienvenido, " + r.proveedor.nombre + ".");
        render();
      });
    }, { aceptar: "Activar y entrar" });
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
      /* Se captura el id ahora: para cuando la promesa resuelva, la sesión
         podría haberse cerrado y `usuario` ya no serviría. */
      const id = usuario.id;
      return Auth.crearCredencial(d.nueva).then(function (cred) {
        DB.update("usuarios", id, { credencial: cred, debeCambiar: false });
        if (usuario && usuario.id === id) usuario = DB.get("usuarios", id);
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
      { id: "inicio", texto: "Inicio", icono: "casa" },
      { id: "lotes", texto: "Mis envíos", icono: "caja" },
      { id: "desempeno", texto: "Mi desempeño", icono: "tendencia" },
      { id: "pagos", texto: "Pagos", icono: "recibo" },
      { id: "ayuda", texto: "Ayuda", icono: "libro" }
    ];

    let html = '<div class="portal">';
    html += '<header class="portal-barra">' +
      '<div class="portal-marca"><span aria-hidden="true">' + UI.icono("marca") + '</span>' +
      "<div><strong>Portal del Proveedor</strong><small>" + esc(miProveedor().nombre) +
      "</small></div></div>" +
      '<div class="portal-acciones">' +
      UI.campana(Novedades.sinVer(usuario)) +
      '<button class="btn btn-plano btn-sm" id="btnClave" title="Cambiar contraseña" aria-label="Cambiar contraseña">' + UI.icono("llave") + '</button>' +
      '<button class="btn btn-plano btn-sm" id="btnSalir">Salir</button></div>' +
      (novedadesAbiertas ? UI.panelNovedades(novedadesActuales()) : "") + "</header>";

    html += '<main id="contenido" tabindex="-1">';
    const sinEnviar = DB.pendientes();
    if (sinEnviar > 0) {
      html += '<p class="banda-pendiente"><strong>' + sinEnviar +
        (sinEnviar === 1 ? " registro sin enviar." : " registros sin enviar.") +
        "</strong> Están guardados en tu teléfono y saldrán solos cuando " +
        "vuelva la señal. No hace falta que repitas nada.</p>";
    }
    if (vista === "inicio") html += vistaInicio();
    else if (vista === "lotes") html += vistaLotes();
    else if (vista === "desempeno") html += vistaDesempeno();
    else if (vista === "pagos") html += vistaPagos();
    else if (vista === "ayuda") html += vistaAyuda();
    html += "</main>";

    /* Barra inferior: en el celular es la navegación natural. */
    html += '<nav class="portal-nav" aria-label="Secciones">';
    menu.forEach(function (m) {
      html += '<button type="button" class="portal-nav-item' + (m.id === vista ? " activo" : "") +
        '" data-ir="' + m.id + '"' + (m.id === vista ? ' aria-current="page"' : "") + ">" +
        UI.icono(m.icono) + "<span>" + esc(m.texto) + "</span></button>";
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

    const activar = $("#btnActivar");
    if (activar) activar.addEventListener("click", formActivar);

    $$(".demo").forEach(function (b) {
      b.addEventListener("click", function () {
        $("#acceso").value = b.dataset.usr;
        $("#clave").value = b.dataset.clave;
        $("#btnEntrar").focus();
      });
    });

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

    $$("[data-repetir]").forEach(function (b) {
      b.addEventListener("click", function (ev) {
        /* La tarjeta entera abre la ficha; este botón no debe hacerlo. */
        ev.stopPropagation();
        const l = DB.get("lotes", b.dataset.repetir);
        if (l) formAnunciar(l);
      });
    });

    const buscar = $("#buscar");
    if (buscar) {
      buscar.addEventListener("input", function () {
        busqueda = buscar.value;
        render();
        /* Repintar devuelve el foco al cuadro y lo deja al final del texto,
           para poder seguir escribiendo sin tocar la pantalla otra vez. */
        const otra = $("#buscar");
        if (otra) { otra.focus(); otra.setSelectionRange(otra.value.length, otra.value.length); }
      });
    }
    const limpiar = $("#btnLimpiarBusca");
    if (limpiar) {
      limpiar.addEventListener("click", function () { busqueda = ""; render(); });
    }

    enlazarNovedades();

    $$("[data-dias-pago]").forEach(function (b) {
      b.addEventListener("click", function () {
        diasPago = Number(b.dataset.diasPago) || 30;
        render();
      });
    });
    const impPago = $("#btnImprimirPago");
    if (impPago) impPago.addEventListener("click", function () { window.print(); });

    const impGuia = $("#btnImprimirGuia");
    if (impGuia) impGuia.addEventListener("click", function () { window.print(); });

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


  /* Las cuentas de prueba se enseñan DENTRO de la aplicación. Tenerlas solo
     en la documentación deja a quien abre la app sin saber qué escribir. */
  let demo = [];

  function demoHTML() {
    if (!demo.length) return "";
    let h = '<details class="demo-cuentas"><summary>¿Estás probando el sistema? ' +
      "Cuentas de demostración</summary><ul>";
    demo.forEach(function (c) {
      h += '<li><button type="button" class="demo" data-usr="' + esc(c.usuario) +
        '" data-clave="' + esc(c.clave) + '">' + esc(c.usuario) + "</button>" +
        '<span><strong>' + esc(c.nombre) + "</strong>" +
        (c.detalle ? " · " + esc(c.detalle) : "") + "</span></li>";
    });
    h += "</ul><p>Al pulsar una se rellena el formulario. Desaparecen solas " +
      "en cuanto se cambian sus claves.</p></details>";
    return h;
  }

  /* La pantalla de acceso avisa de que está conectando: sin esto, la espera
     parece que la aplicación no responde. */
  let conectado = false;

  function marcarConectado() {
    conectado = true;
    const el = UI.$("#estadoConexion");
    if (el) el.outerHTML = estadoConexionHTML();
  }

  function textoConexion() {
    if (!conectado) return "Conectando con el sistema…";
    const n = DB.pendientes();
    const pend = n === 1 ? "1 registro pendiente" : n + " registros pendientes";
    if (!DB.esCompartido()) {
      return "Sin conexión" + (n > 0 ? " — " + pend + ", se enviarán al volver" : "");
    }
    return n > 0 ? pend + " de enviar" : "Conectado al sistema";
  }

  function claseConexion() {
    if (!conectado) return "conexion";
    if (DB.pendientes() > 0) return "conexion conexion-pendiente";
    return DB.esCompartido() ? "conexion conexion-ok" : "conexion conexion-sinred";
  }

  function estadoConexionHTML() {
    return '<p class="' + claseConexion() + '" id="estadoConexion">' +
      '<span class="conexion-punto" aria-hidden="true"></span>' + textoConexion() + "</p>";
  }

  function iniciar() {
    UI.prepararGuardado();
    DB.load();
    restaurar();
    render();

    DB.vigilarRed();
    DB.alCambiarCola(function () { UI.repintarSiSeguro(render); });
    DB.alFallarEscritura(function () {
      UI.aviso("No se pudo enviar el cambio. Revisa tu conexión.", "error");
    });

    /* Al conectar cambian los datos, pero si la persona ya está llenando el
       acceso NO se repinta: seria borrarle lo escrito justo antes de entrar. */
    DB.conectar(repintarPorSincronizacion).then(function () {
      return DB.sembrarCredenciales();
    }).then(function () {
      return DB.cuentasDemo(["proveedor"]);
    }).then(function (lista) {
      demo = lista;
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
