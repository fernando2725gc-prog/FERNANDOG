/* =========================================================================
   guia.js — La guía de uso, dentro de la propia aplicación

   Un manual aparte envejece y nadie lo abre. Esta guía vive en el sistema,
   se imprime desde él y habla de lo que la persona tiene delante: se arma
   con los catálogos reales (líneas, estados, causas, destinos), así que si
   mañana cambia un parámetro, la guía cambia con él.

   Cada rol ve primero lo suyo y después el resto, porque entender el
   recorrido completo es justamente lo que hace que cada quien registre
   bien su parte.
   ========================================================================= */

const Guia = (function () {
  "use strict";

  function esc(s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ------------------------------------------------------------ piezas */

  function seccion(id, titulo, cuerpo) {
    return '<section class="guia-seccion" id="guia-' + esc(id) + '">' +
      "<h2>" + esc(titulo) + "</h2>" + cuerpo + "</section>";
  }

  /* El título del paso se escapa: va en negrita y no admite marcado, para
     que nadie pueda meter HTML por aquí el día que estos textos salgan de
     un catálogo en vez de estar escritos a mano. El cuerpo sí lo admite. */
  function pasos(lista) {
    let html = '<ol class="guia-pasos">';
    lista.forEach(function (p) {
      html += "<li><strong>" + esc(p[0]) + "</strong><span>" + p[1] + "</span></li>";
    });
    return html + "</ol>";
  }

  function preguntas(lista) {
    let html = '<div class="guia-faq">';
    lista.forEach(function (p) {
      html += "<details><summary>" + esc(p[0]) + "</summary><div>" + p[1] + "</div></details>";
    });
    return html + "</div>";
  }

  function tarjetasRol(resaltado) {
    let html = '<div class="guia-roles">';
    DB.ROLES.forEach(function (r) {
      html += '<div class="guia-rol' + (r.id === resaltado ? " guia-rol-tuyo" : "") + '">' +
        '<span class="guia-rol-icono" aria-hidden="true">' + UI.icono(r.icono) + "</span>" +
        "<strong>" + esc(r.nombre) + (r.id === resaltado ? " · tú" : "") + "</strong>" +
        "<small>" + esc(r.lema) + "</small></div>";
    });
    return html + "</div>";
  }

  /* Lo que el proveedor ve de cada paso. La ayuda del catálogo está escrita
     para planta —habla de causas raíz y de mermas— y eso ni le sirve ni le
     corresponde: ve el recorrido de SU fruta, no el interior del proceso. */
  const PASO_PROVEEDOR = {
    Anunciado: "Avisaste que envías. La planta ya lo tiene en su cola y lo espera.",
    Recibido: "Tu fruta llegó: contaron las gavetas y la pesaron en báscula.",
    Procesado: "La planta ya trabajó tu lote. Falta que lo revisen y lo cierren.",
    Cerrado: "Terminado. Aquí ves cuántas cajas salieron para exportación.",
    Rechazado: "La fruta no cumplió los mínimos y no entró. Verás el motivo escrito."
  };

  /* El recorrido del pedido, estado por estado, con quién lo mueve. */
  function recorrido(paraProveedor) {
    let html = '<ol class="guia-recorrido">';
    DB.ESTADOS.filter(function (e) { return e.id !== "Rechazado"; })
      .sort(function (a, b) { return a.orden - b.orden; })
      .forEach(function (e) {
        const rol = DB.ROLES.find(function (r) { return r.id === e.rol; });
        html += '<li><span class="guia-estado">' + esc(e.nombre) + "</span>" +
          '<span class="guia-quien">' + (rol ? UI.icono(rol.icono) + " " + esc(rol.nombre) : "—") + "</span>" +
          "<span>" + esc(paraProveedor ? (PASO_PROVEEDOR[e.id] || e.ayuda) : e.ayuda) +
          "</span></li>";
      });
    const rech = DB.ESTADOS.find(function (e) { return e.id === "Rechazado"; });
    if (rech) {
      html += '<li class="guia-recorrido-desvio"><span class="guia-estado">' + esc(rech.nombre) +
        '</span><span class="guia-quien">' + UI.icono("balanza") + ' Recepción</span><span>' +
        esc(paraProveedor ? PASO_PROVEEDOR.Rechazado
          : rech.ayuda + " El proveedor lo ve en su portal con el motivo.") +
        "</span></li>";
    }
    return html + "</ol>";
  }

  function sinSenal() {
    return "<p>La app <strong>no se cae si se cae la señal</strong>. Lo que registres " +
      "queda guardado en el propio equipo y sale solo cuando vuelva la conexión. " +
      "Mientras tanto verás una franja arriba que dice cuántos registros están " +
      "sin enviar, y cada uno aparece marcado como <em>Pendiente de enviar</em>.</p>" +
      "<p class='guia-ojo'>Lo que <strong>no</strong> hay que hacer: volver a registrar " +
      "lo mismo porque parece que no se guardó. Se guardó. Repetirlo crea un duplicado " +
      "que después hay que limpiar a mano.</p>";
  }

  function origenes() {
    return "<p>Junto a muchos números verás una letra pequeña. Dice de dónde sale ese dato, " +
      "y está ahí porque el documento del proyecto exige declararlo:</p>" +
      '<ul class="guia-origenes">' +
      "<li>" + UI.origen("M") + " <strong>Medido</strong> — cronometrado o pesado en planta.</li>" +
      "<li>" + UI.origen("E") + " <strong>Estimado</strong> — valor de trabajo, pendiente de " +
      "confirmar con la empresa.</li>" +
      "<li>" + UI.origen("S") + " <strong>Fuente secundaria</strong> — tomado de norma o " +
      "bibliografía (por ejemplo los suplementos de la OIT).</li></ul>" +
      "<p>Un número con <strong>E</strong> no está mal: está sin confirmar. Antes de usar " +
      "la app para decidir algo serio, conviene revisar esos en <em>Parámetros</em>.</p>";
  }

  /* ===================================================== guía de planta */

  function planta(rol) {
    const esSupervisor = rol === "supervisor";
    const esRecepcion = rol === "recepcion";
    const esProduccion = rol === "produccion";

    let html = '<div class="guia">';

    html += '<header class="guia-cab"><p class="guia-eyebrow">' + esc(DB.nombreEmpresa(true)) +
      '</p><h1>Guía del Sistema de Planta</h1>' +
      '<p class="sub">Qué hace cada quien, en qué orden, y qué significa lo que se ve ' +
      "en pantalla. Se puede imprimir y dejar en el escritorio de planta.</p></header>";

    html += seccion("quien", "Quién hace qué",
      "<p>Son cuatro papeles. Cada pedido pasa por los cuatro, en este orden, y nadie " +
      "puede hacer el paso de otro: así cada dato lo captura quien lo conoce de " +
      "primera mano.</p>" + tarjetasRol(rol));

    html += seccion("recorrido", "El recorrido de un pedido",
      "<p>Un pedido (en el sistema, un <strong>lote</strong>) nace cuando el proveedor " +
      "anuncia el envío desde su celular y termina cuando Supervisión lo cierra.</p>" +
      "<p class='guia-ojo'><strong>Dos unidades, no una.</strong> Del campo llega la " +
      "<strong>gaveta</strong> (11 kg en pitahaya, 20 en tomate, 12 en granadilla). Al " +
      "contenedor sale la <strong>caja de exportación</strong> (3 / 2,5 / 2 kg). " +
      "Todo lo que se cuenta en recepción y en proceso son gavetas; las cajas aparecen " +
      "al empacar. Confundirlas hace que ningún indicador signifique nada.</p>" +
      recorrido() +
      "<p class='guia-ojo'><strong>Ningún estado se marca a mano.</strong> Cada uno se " +
      "alcanza haciendo el trabajo: el lote pasa a <em>Recibido</em> cuando Recepción lo " +
      "pesa, a <em>Procesado</em> cuando Producción registra lo que salió, y a " +
      "<em>Cerrado</em> cuando Supervisión lo cierra. En la ficha de cualquier lote, " +
      "arriba, dice qué sigue y a quién le toca.</p>" +
      "<p class='guia-ojo'>Mientras un lote no esté <strong>Cerrado</strong>, se puede " +
      "corregir. Una vez cerrado, no: hay que reabrirlo, y eso queda anotado.</p>");

    /* --- lo tuyo primero --- */
    if (esRecepcion || esSupervisor) {
      html += seccion("pesar", "Recibir y pesar lo que llega",
        pasos([
          ["Abre «Recepción y pesaje»",
           "Arriba está <em>Esperando en el patio</em>: todo lo que los proveedores " +
           "anunciaron y aún no se ha pesado. El número rojo del menú es esa misma cola."],
          ["Pulsa «Pesar» en el lote que acaba de llegar",
           "Verás lo que el proveedor declaró. Escribe las gavetas que realmente contaste " +
           "y los kilos de la báscula."],
          ["Mira la diferencia que calcula la pantalla",
           "Si lo pesado se aparta mucho de lo anunciado, el sistema lo señala. Esa " +
           "diferencia es la causa raíz <strong>CR6</strong> hecha número, y es la base " +
           "de la conversación con el proveedor."],
          ["¿Se retiró fruta al descargar?",
           "Si parte del lote no entra —bajo calibre, golpeada, podrida— se anota en " +
           "<em>kilos retirados</em>, con su causa y su destino. Es la primera etapa del " +
           "balance de masa y hasta ahora no se registraba en ninguna parte: esa fruta " +
           "desaparecía entre lo pesado y lo procesado. Déjalo vacío si entró todo."],
          ["Verifica la calidad",
           "Puedes confirmar la calidad declarada o corregirla. Si la fruta no cumple, " +
           "usa <em>Rechazar</em> y escribe el motivo: el proveedor lo verá."],
          ["¿Te equivocaste al teclear?",
           "<em>Corregir pesaje</em>, en la misma fila. Se puede mientras el lote no esté " +
           "cerrado, y la bitácora guarda el valor anterior, quién lo cambió y cuándo."]
        ]));
    }

    if (esProduccion || esSupervisor) {
      html += seccion("procesar", "Registrar la producción",
        pasos([
          ["Abre «Producción» y elige un lote recibido",
           "Solo aparecen los que Recepción ya pesó."],
          ["Anota gavetas procesadas, cajas exportables y el tiempo real",
           "El tiempo es el que de verdad tomó. El sistema lo compara contra el " +
           "<strong>contenido de trabajo</strong> del estudio de tiempos —minutos-persona, " +
           "no minutos de reloj— y de ahí sale la eficiencia."],
          ["Reparte la merma por causa y por destino",
           "Cada kilo de descarte lleva dos cosas: <strong>por qué</strong> se perdió " +
           "(la causa raíz) y <strong>a dónde</strong> fue. Ese segundo dato es el que " +
           "hace posible la economía circular; sin él, todo el descarte parece basura."],
          ["Di DÓNDE se perdió cada kilo",
           "Cada línea de pérdida lleva su etapa: en la <em>selección</em> —sopleteado, " +
           "clasificación o limpieza, según la línea— o ya en el <em>empaque</em>. " +
           "No es burocracia: caerse en selección es un problema de método y caerse en " +
           "empaque es un problema de presentación; mezclarlos deja un solo número que " +
           "no dice dónde actuar."],
          ["Cuadra el balance de masa, en kilos",
           "Lo empacado más la merma tiene que dar lo que entró a proceso. Se cuadra en " +
           "<strong>kilos</strong>, no en bultos, porque la gaveta que entra y la caja que " +
           "sale pesan cosas distintas. La pantalla no deja guardar si no cuadra: es lo " +
           "que evita que los indicadores salgan mentirosos."],
          ["Al guardar, el pedido pasa a Supervisión",
           "Queda en estado <em>Procesado</em>, esperando el cierre."]
        ]));
    }

    if (esSupervisor) {
      html += seccion("cerrar", "Cerrar el pedido  ·  dónde está",
        "<p>Es el paso que termina el ciclo, y solo lo puede hacer Supervisión. Hay " +
        "<strong>tres sitios</strong> desde donde se hace, todos llevan a lo mismo:</p>" +
        pasos([
          ["Menú «Lotes» → bloque «Terminados, esperando el cierre»",
           "Es la vía normal. Ese bloque junta todos los pedidos ya procesados y sin " +
           "cerrar, con los días que llevan abiertos. El número junto a <em>Lotes</em> " +
           "en el menú es esa misma cuenta."],
          ["Desde la ficha del pedido",
           "Abre <em>Ficha</em> en cualquier lote procesado: abajo tienes " +
           "<em>Cerrar pedido</em>."],
          ["En la tabla de todos los lotes",
           "El botón <em>Cerrar</em> aparece en la fila de cualquier lote en estado " +
           "<em>Procesado</em>."]
        ]) +
        "<p>Antes de cerrar verás la ficha completa para revisarla. En el cuadro de " +
        "cierre hay una casilla: <strong>publicar el reporte en el portal del " +
        "proveedor</strong>. Si la dejas marcada, el proveedor ve el resultado de su " +
        "lote en cuanto cierras.</p>" +
        "<p class='guia-ojo'>Un pedido cerrado <strong>no admite cambios</strong>. Si " +
        "hace falta enmendarlo, usa <em>Reabrir</em> en la fila del lote: vuelve a " +
        "<em>Procesado</em> y la reapertura queda en la bitácora con tu nombre.</p>");

      html += seccion("tiempos", "Estudio de tiempos y asignación",
        "<p>En <em>Estudio de tiempos</em> está la cadena completa, actividad por " +
        "actividad: la lectura del cronómetro (TO), la valoración del ritmo, el " +
        "suplemento de la OIT y el tiempo estándar que sale de ahí. <strong>El estándar " +
        "no se teclea: se calcula.</strong> Cuando se cronometren ciclos nuevos, basta " +
        "cambiar la lectura y se recalculan solos el takt, los operarios, el costo por " +
        "caja y el costeo de las causas.</p>" +
        "<p><strong>Hay dos relojes y conviene no mezclarlos:</strong></p>" +
        '<dl class="guia-defs">' +
        "<dt>Tiempo de ciclo (min por gaveta)</dt><dd>Lo que tarda una gaveta en recorrer " +
        "la línea. Sirve para prometer entregas y para compararse con el takt. No depende " +
        "de cuánta gente haya.</dd>" +
        "<dt>Contenido de trabajo (minutos-persona por gaveta)</dt><dd>La mano de obra que " +
        "consume esa misma gaveta. Sirve para asignar personal y para costear. Sí depende: " +
        "una actividad atendida por dos personas tarda lo mismo y cuesta el doble.</dd></dl>" +
        "<p>La gente se asigna con el segundo dividido para el takt, y por estación, no en " +
        "bloque. La estación que concentra más contenido es la que manda: es donde una " +
        "mejora de método se nota, y donde un operario de más se desperdicia.</p>" +
        "<p class='guia-ojo'>Si una lectura tiene pocas repeticiones, el estándar que sale " +
        "de ella es frágil. La columna de origen lo dice: " + UI.origen("M") + " es " +
        "cronometrado, " + UI.origen("E") + " es estimado y hay que confirmarlo midiendo.</p>");

      html += seccion("planificar", "Planificar el día",
        "<p>En <em>Planificación diaria</em> escribes cuántas <strong>gavetas</strong> hay " +
        "que procesar por línea y el sistema responde tres cosas: cuánta mano de obra pide " +
        "(el contenido de trabajo), cuántos operarios hacen falta y cada cuántos minutos " +
        "debe salir una gaveta (el <em>takt time</em>). Si el plan no cabe en el turno, lo dice y calcula " +
        "cuánta gente falta. También avisa si no hay materia prima suficiente en cámara.</p>");

      html += seccion("costeo", "Costeo y simulador de mejora",
        "<p>En <em>Costeo y mejora</em> la pérdida deja de estar en kilos y pasa a " +
        "dólares al año, causa por causa. El costo de cada causa suma tres cosas: la " +
        "fruta que no se exportó, menos lo que el destino recupera, más las horas-hombre " +
        "que ya se gastaron en esa fruta.</p>" +
        "<p>Debajo está el simulador: activas las medidas que se proponen, o mueves a " +
        "mano cuánto crees que bajaría cada causa, y te devuelve el ahorro al año, en " +
        "cuánto se recupera la inversión y los indicadores antes y después.</p>" +
        "<p class='guia-ojo'>Todo lo del simulador es <strong>supuesto</strong> " +
        "(" + UI.origen("S") + "), no medido. Sirve para decidir y para defender la " +
        "propuesta, no para prometer un resultado.</p>");

      html += seccion("liquidar", "Pagar al proveedor",
        "<p>En <em>Liquidaciones</em> está, por proveedor y por período, lo que hay que " +
        "pagarle. <strong>Se liquida sobre el kilo de báscula</strong> —no sobre lo que el " +
        "proveedor declaró ni sobre bultos—, porque es el único dato que las dos partes " +
        "vieron.</p>" +
        "<p>Cada proveedor tiene su documento imprimible, con el detalle lote por lote, el " +
        "total y dos espacios de firma. El mismo período y el mismo proveedor dan siempre " +
        "el mismo número de documento, así que reimprimirlo no crea uno nuevo.</p>" +
        "<p class='guia-ojo'>Dos cosas que conviene saber antes de la primera discusión: " +
        "un lote <strong>ya pesado se paga aunque siga en planta</strong> —se liquida lo " +
        "que entró, no lo que salió— y un lote <strong>rechazado aparece igual</strong>, " +
        "con importe cero y su motivo escrito. No decirlo es lo que genera la llamada.</p>" +
        "<p>El proveedor ve su propia liquidación en el portal, en <em>Pagos</em>, con el " +
        "mismo cálculo. Si una cifra no le cuadra, tiene el detalle de cada lote en " +
        "<em>Mis envíos</em>.</p>");

      html += seccion("gente", "Dar acceso a alguien",
        pasos([
          ["Persona de planta",
           "<em>Usuarios</em> → <em>Nuevo usuario</em>. El sistema genera una clave " +
           "temporal que <strong>se muestra una sola vez</strong>: anótala o imprímela y " +
           "entrégala. Quien entre con ella tendrá que cambiarla de inmediato."],
          ["Proveedor nuevo",
           "<em>Proveedores</em> → <em>Nuevo</em>. Se le entrega un código de activación " +
           "y él mismo crea su contraseña desde el portal, con su documento. Nadie en " +
           "planta conoce la clave de un proveedor."],
          ["Se le olvidó la contraseña",
           "No se puede recuperar, solo reemplazar: <em>Restablecer</em> junto a la " +
           "persona. A un proveedor se le vuelve a habilitar la activación."]
        ]));
    }

    /* --- lo común --- */
    html += seccion("indicadores", "Cómo leer los indicadores",
      '<dl class="guia-defs">' +
      "<dt>Rendimiento exportable</dt><dd>De cada 100 kilos que entran a proceso, cuántos " +
      "salen empacados. Se mide <strong>en kilos</strong>, no en bultos: la gaveta que " +
      "entra y la caja que sale pesan cosas distintas, así que contar bultos no diría " +
      "nada. Se compara contra la meta de cada línea.</dd>" +
      "<dt>Merma</dt><dd>Kilos perdidos sobre kilos procesados. El Pareto por causa raíz " +
      "dice de dónde viene y cuáles pocas causas explican la mayor parte.</dd>" +
      "<dt>¿Dónde se pierde la fruta?</dt><dd>El balance de masa en cascada: de la " +
      "báscula a la caja, cuánto se cae al <strong>recibir</strong>, cuánto en la " +
      "<strong>selección</strong> y cuánto en el <strong>empaque</strong>. Cada etapa " +
      "tiene un dueño distinto: el retiro al recibir es un problema del proveedor, el " +
      "descarte en selección es de método, y la pérdida en empaque es de presentación. " +
      "Por eso el rendimiento se da dos veces: el <em>global</em> cuenta desde la " +
      "báscula, el <em>de proceso</em> solo desde la mesa.</dd>" +
      "<dt>Aprovechado</dt><dd>Qué parte del descarte NO fue al relleno sanitario. Es el " +
      "indicador de economía circular.</dd>" +
      "<dt>Eficiencia</dt><dd>Contenido de trabajo estándar dividido para el tiempo que " +
      "de verdad consumió la gente. Por debajo de 100% la línea tardó más de lo que el " +
      "estudio de tiempos dice.</dd>" +
      "<dt>Diferencia en gavetas y en kilos</dt><dd>Lo pesado contra lo que el proveedor " +
      "declaró. Pueden llegar todas las gavetas y aun así pesar menos, si vienen " +
      "incompletas: por eso son dos indicadores y no uno.</dd></dl>");

    html += seccion("origen", "La letra pequeña junto a los números", origenes());
    html += seccion("senal", "Cuando no hay señal", sinSenal());

    html += seccion("dudas", "Dudas frecuentes", preguntas([
      ["¿Dónde marco que un lote ya fue procesado?",
       "En ningún sitio: <strong>no hay un botón de «marcar como procesado»</strong>. El " +
       "lote pasa a <em>Procesado</em> solo, en cuanto Producción registra el trabajo " +
       "—cajas obtenidas, tiempo y reparto de la merma— desde <em>Producción</em>. Lo " +
       "mismo vale para los demás estados: ninguno se marca a mano, cada uno se alcanza " +
       "haciendo su parte. Si tienes dudas con un lote concreto, abre su <em>Ficha</em>: " +
       "arriba dice qué sigue y a quién le toca."],
      ["No encuentro el botón para cerrar un pedido.",
       "Solo aparece en pedidos en estado <em>Procesado</em> y solo para Supervisión. " +
       "Si el lote todavía no tiene la producción registrada, no hay nada que cerrar."],
      ["Me equivoqué y el lote ya está cerrado.",
       "Supervisión puede reabrirlo desde <em>Lotes</em>. Vuelve a <em>Procesado</em>, se " +
       "corrige y se vuelve a cerrar. Todo queda en la bitácora."],
      ["¿Por qué no me deja guardar la producción?",
       "Casi siempre es el balance de masa: exportable + merma debe igualar lo procesado. " +
       "La pantalla muestra en rojo cuánto falta o sobra."],
      ["Dos personas tocaron el mismo lote a la vez.",
       "Queda lo que guardó el último. Conviene que cada rol trabaje lo suyo; si pasa, " +
       "la bitácora muestra los dos movimientos."],
      ["¿Los datos son reales?",
       "No. Lo que viene cargado son datos de demostración con semilla fija, para que " +
       "las capturas del documento se puedan repetir. Antes de concluir algo hay que " +
       "reemplazarlos por registros reales."]
    ]));

    html += '<footer class="guia-pie"><p>' + esc(DB.MARCA.producto) + " · " +
      esc(DB.MARCA.descripcion) + " · Guía generada el " +
      UI.fechaLarga(DB.hoy()) + ".</p></footer>";

    return html + "</div>";
  }

  /* ==================================================== guía del portal */

  function portal() {
    let html = '<div class="guia">';

    html += '<header class="guia-cab"><h1>Cómo usar el portal</h1>' +
      '<p class="sub">Todo lo que hace falta saber para anunciar tus envíos y seguir ' +
      "cada lote. Son cinco minutos de lectura.</p></header>";

    html += seccion("para-que", "¿Para qué sirve este portal?",
      "<p>Para dos cosas, y las dos te ahorran llamadas:</p>" +
      "<ul><li><strong>Avisar que envías fruta</strong>, antes de que el camión llegue. " +
      "La planta ve tu envío en su cola en el mismo instante y lo espera.</li>" +
      "<li><strong>Ver qué pasó con tu fruta</strong>: cuántas gavetas se recibieron de " +
      "verdad, cuántas salieron para exportación y cómo quedó tu lote.</li></ul>" +
      "<p>Solo ves lo tuyo. Ningún otro proveedor ve tus envíos, y tú no ves los suyos.</p>");

    html += seccion("anunciar", "Anunciar un envío",
      pasos([
        ["Pulsa el botón grande «Anunciar envío»", "Está en la pantalla de inicio."],
        ["Elige la línea y escribe las gavetas",
         "Pitahaya, tomate de árbol o granadilla. Son las gavetas que vas a mandar, " +
         "tal como salen de la finca —no las cajas de exportación, que las arma la planta."],
        ["Indica el peso aproximado de cada gaveta",
         "No tiene que ser exacto. Sirve para que planta sepa cuánto peso esperar, y " +
         "para ir comparando lo declarado con la báscula."],
        ["Declara la calidad y, si quieres, deja una observación",
         "Por ejemplo, si parte del lote viene de una cosecha distinta."],
        ["Guarda",
         "Listo. El lote queda en estado <em>Anunciado</em> y lo ves en <em>Mis envíos</em>."]
      ]) +
      "<p class='guia-ojo'>Anunciar no es un compromiso de facturación: es un aviso. " +
      "Lo que vale para la liquidación es lo que la báscula de planta registre.</p>");

    html += seccion("seguir", "Seguir tu lote",
      "<p>En <em>Mis envíos</em> cada tarjeta muestra en qué punto va:</p>" + recorrido(true) +
      "<p>Cuando Supervisión cierra el lote y publica el reporte, en tu tarjeta aparece " +
      "el resultado: cajas recibidas, diferencia con lo que anunciaste y cuántas cajas " +
      "salieron para exportación.</p>" +
      "<p class='guia-ojo'>Verás el resultado de <strong>tu</strong> fruta, no el detalle " +
      "interno de la planta. Las causas de pérdida del proceso no se publican.</p>");

    html += seccion("pagos", "Lo que te van a pagar",
      "<p>En <em>Pagos</em> está el total del período y el detalle de cada entrega: " +
      "kilos de báscula, precio por kilo e importe. Se paga <strong>por kilo pesado en " +
      "planta</strong>, no por lo que declaraste al enviar ni por gavetas.</p>" +
      "<p>Una entrega <strong>ya pesada cuenta aunque siga en planta</strong>: se paga lo " +
      "que entró, no lo que salió. Y si una entrega fue rechazada, aparece con importe " +
      "cero y el motivo escrito, para que sepas exactamente por qué.</p>" +
      "<p class='guia-ojo'>Si una cifra no te cuadra, entra a <em>Mis envíos</em>: ahí " +
      "está, lote por lote, lo que declaraste y lo que marcó la báscula.</p>");

    html += seccion("desempeno", "Tu desempeño",
      "<p>La sección <em>Mi desempeño</em> es la que más conviene mirar cada mes. " +
      "Compara lo que declaras con lo que la báscula encuentra. Si la diferencia es " +
      "pequeña y constante, tu fruta entra sin fricción; si es grande o cambia mucho de " +
      "un envío a otro, es señal de algo corregible: cajas mal llenadas, pesaje en " +
      "finca, o cosecha despareja.</p>" +
      "<p>Esa constancia es, para la planta, tan importante como el volumen.</p>");

    html += seccion("cuenta", "Tu cuenta y tu contraseña",
      pasos([
        ["La primera vez: activas tú mismo",
         "Con el código que te dio la empresa y tu número de documento. La contraseña la " +
         "eliges tú y nadie de la planta la conoce."],
        ["Si la olvidas",
         "No se puede recuperar, solo cambiar. Pide a la empresa que habilite otra vez la " +
         "activación y vuelves a elegir una."],
        ["En tu teléfono de siempre",
         "Marca <em>Recordarme</em> y no tendrás que escribirla cada vez."]
      ]));

    html += seccion("senal", "Si no hay señal en la finca", sinSenal());

    html += '<footer class="guia-pie"><p>Portal del Proveedor · ' +
      esc(DB.nombreEmpresa()) + " · Guía generada el " + UI.fechaLarga(DB.hoy()) +
      ".</p></footer>";

    return html + "</div>";
  }

  /* Un <details> cerrado no se imprime: el navegador oculta su contenido y
     ninguna regla de CSS lo saca. Se abren antes de imprimir y se devuelven
     a como estaban después, para que la guía en papel salga completa. */
  if (typeof window !== "undefined") {
    window.addEventListener("beforeprint", function () {
      Array.prototype.forEach.call(
        document.querySelectorAll(".guia-faq details:not([open])"), function (d) {
          d.dataset.reabrir = "1";
          d.open = true;
        });
    });
    window.addEventListener("afterprint", function () {
      Array.prototype.forEach.call(
        document.querySelectorAll(".guia-faq details[data-reabrir]"), function (d) {
          d.open = false;
          delete d.dataset.reabrir;
        });
    });
  }

  return { planta: planta, portal: portal };
})();
