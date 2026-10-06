/* =========================================================================
   excel.js — Libros de Excel de verdad, sin librerías

   Por qué no basta el CSV que ya había: un CSV es una sola tabla, sin
   formato, y en español depende de que Excel adivine el separador y la coma
   decimal. Para los anexos de un TIC eso significa reconstruir a mano, hoja
   por hoja, lo que el sistema ya sabe. Un .xlsx lleva varias hojas, los
   números como números —no como texto que parece número— y la cabecera
   destacada, que es lo que hace falta para pegarlo en el documento.

   Un .xlsx es un ZIP de archivos XML. Aquí se escriben los dos:

     · El ZIP, con entradas SIN comprimir («stored»), que el formato admite
       y evita tener que implementar DEFLATE. Un libro de mil filas pesa unos
       cientos de kilobytes; comprimirlo ahorraría tiempo de descarga que
       aquí no le importa a nadie.
     · El libro mínimo que Excel, LibreOffice y Google Sheets abren sin
       quejarse: tipos de contenido, relaciones, workbook, estilos y una
       hoja por tabla.

   Las cadenas van «en línea» (`inlineStr`) en vez de en la tabla compartida
   de textos. Repite texto y engorda el archivo, pero quita una pieza entera
   que podría quedar descuadrada, y un descuadre ahí lo que produce es un
   archivo que no abre.
   ========================================================================= */

const Excel = (function () {
  "use strict";

  /* ------------------------------------------------------------ CRC-32 */

  /* La tabla se calcula una vez, la primera vez que se exporta: son 256
     entradas y no vale la pena llevarlas escritas. */
  let TABLA = null;
  function tablaCRC() {
    if (TABLA) return TABLA;
    TABLA = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      TABLA[i] = c >>> 0;
    }
    return TABLA;
  }

  function crc32(bytes) {
    const t = tablaCRC();
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  /* --------------------------------------------------------------- ZIP */

  function bytes(texto) { return new TextEncoder().encode(texto); }

  /* Fecha y hora en el formato de MS-DOS que usa el ZIP: dos palabras de
     16 bits, con los segundos en pasos de dos y el año contado desde 1980. */
  function fechaDOS(d) {
    return {
      hora: (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2)),
      fecha: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
    };
  }

  function zip(archivos) {
    const t = fechaDOS(new Date());
    const partes = [];
    const central = [];
    let offset = 0;

    archivos.forEach(function (a) {
      const nombre = bytes(a.nombre);
      const datos = bytes(a.contenido);
      const crc = crc32(datos);

      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034B50, true);   // firma de cabecera local
      local.setUint16(4, 20, true);           // versión necesaria
      local.setUint16(6, 0, true);            // sin banderas
      local.setUint16(8, 0, true);            // método 0 = almacenado
      local.setUint16(10, t.hora, true);
      local.setUint16(12, t.fecha, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, datos.length, true); // comprimido = sin comprimir
      local.setUint32(22, datos.length, true);
      local.setUint16(26, nombre.length, true);
      local.setUint16(28, 0, true);            // sin campo extra

      partes.push(new Uint8Array(local.buffer), nombre, datos);

      const dir = new DataView(new ArrayBuffer(46));
      dir.setUint32(0, 0x02014B50, true);     // firma de directorio central
      dir.setUint16(4, 20, true);
      dir.setUint16(6, 20, true);
      dir.setUint16(8, 0, true);
      dir.setUint16(10, 0, true);
      dir.setUint16(12, t.hora, true);
      dir.setUint16(14, t.fecha, true);
      dir.setUint32(16, crc, true);
      dir.setUint32(20, datos.length, true);
      dir.setUint32(24, datos.length, true);
      dir.setUint16(28, nombre.length, true);
      dir.setUint32(42, offset, true);        // dónde empieza su cabecera local
      central.push(new Uint8Array(dir.buffer), nombre);

      offset += 30 + nombre.length + datos.length;
    });

    const tamCentral = central.reduce(function (n, p) { return n + p.length; }, 0);
    const fin = new DataView(new ArrayBuffer(22));
    fin.setUint32(0, 0x06054B50, true);       // fin del directorio central
    fin.setUint16(8, archivos.length, true);
    fin.setUint16(10, archivos.length, true);
    fin.setUint32(12, tamCentral, true);
    fin.setUint32(16, offset, true);

    return new Blob(partes.concat(central, [new Uint8Array(fin.buffer)]),
      { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  /* --------------------------------------------------------------- XML */

  function esc(v) {
    return String(v === null || v === undefined ? "" : v)
      /* XML 1.0 no admite los caracteres de control; si se cuela uno, el
         archivo entero deja de abrirse. Mejor perderlo que perder el libro. */
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* Excel nombra las columnas con letras: 1→A, 27→AA. */
  function columna(n) {
    let s = "";
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - r) / 26);
    }
    return s;
  }

  /* Un número en es-EC viene como «1.234,5». Se devuelve a número para que
     Excel pueda sumarlo, pero solo si TODA la cadena es un número: un código
     de lote como «PIT261005-093» tiene que seguir siendo texto, y un
     porcentaje o un importe con símbolo también —ahí el texto es el dato. */
  function comoNumero(v) {
    if (typeof v === "number") return isFinite(v) ? v : null;
    const s = String(v === null || v === undefined ? "" : v).trim();
    if (!s) return null;
    /* El orden importa. «1.234» encaja en los dos patrones, y en es-EC es
       mil doscientos treinta y cuatro, no uno coma doscientos treinta y
       cuatro: todo lo que llega aquí salió de UI.nf(), donde el punto separa
       los miles siempre. Probar primero el patrón local evita exportar una
       cifra mil veces más pequeña, que en una tabla de kilos pasa
       desapercibida justo hasta que alguien la suma. */
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
      const n = Number(s.replace(/\./g, "").replace(",", "."));
      return isFinite(n) ? n : null;
    }
    if (/^-?\d+,\d+$/.test(s)) {
      const n = Number(s.replace(",", "."));
      return isFinite(n) ? n : null;
    }
    if (/^-?\d+(\.\d+)?$/.test(s)) {
      const n = Number(s);
      return isFinite(n) ? n : null;
    }
    return null;
  }

  function celda(ref, valor, estilo) {
    const n = comoNumero(valor);
    const s = estilo ? ' s="' + estilo + '"' : "";
    if (n !== null) {
      return '<c r="' + ref + '"' + s + '><v>' + n + "</v></c>";
    }
    const texto = String(valor === null || valor === undefined ? "" : valor);
    if (!texto) return '<c r="' + ref + '"' + s + "/>";
    return '<c r="' + ref + '" t="inlineStr"' + s + "><is><t xml:space=\"preserve\">" +
      esc(texto) + "</t></is></c>";
  }

  function hojaXML(hoja) {
    const cols = hoja.columnas;
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      /* Anchos a ojo según el título: sin esto todo sale en columnas de 8
         caracteres y hay que ensanchar a mano antes de poder leer nada. */
      "<cols>" + cols.map(function (c, i) {
        const ancho = Math.min(42, Math.max(10, String(c.titulo || "").length + 4));
        return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + ancho +
          '" customWidth="1"/>';
      }).join("") + "</cols>" +
      /* La cabecera queda congelada: una tabla de doscientas filas sin esto
         obliga a subir cada vez para recordar qué columna es cuál. */
      '<sheetViews><sheetView workbookViewId="0">' +
      '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
      "</sheetView></sheetViews><sheetData>";

    xml += '<row r="1">' + cols.map(function (c, i) {
      return celda(columna(i + 1) + "1", c.titulo, "1");
    }).join("") + "</row>";

    hoja.filas.forEach(function (f, j) {
      const r = j + 2;
      xml += '<row r="' + r + '">' + cols.map(function (c, i) {
        const v = c.excel ? c.excel(f) : (c.csv ? c.csv(f) : "");
        return celda(columna(i + 1) + r, v);
      }).join("") + "</row>";
    });

    return xml + "</sheetData></worksheet>";
  }

  /* Excel admite 31 caracteres por nombre de hoja y prohíbe : \ / ? * [ ]. */
  function nombreHoja(s, i) {
    const limpio = String(s || ("Hoja " + (i + 1))).replace(/[:\\\/?*\[\]]/g, " ").slice(0, 31);
    return limpio.trim() || ("Hoja " + (i + 1));
  }

  function libro(hojas) {
    const nombres = [];
    hojas.forEach(function (h, i) {
      let n = nombreHoja(h.nombre, i);
      /* Dos hojas con el mismo nombre hacen que Excel declare el libro
         dañado y no abra nada. */
      let k = 2;
      while (nombres.indexOf(n) !== -1) { n = nombreHoja(h.nombre, i).slice(0, 28) + " " + (k++); }
      nombres.push(n);
    });

    const archivos = [
      { nombre: "[Content_Types].xml",
        contenido: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
          hojas.map(function (h, i) {
            return '<Override PartName="/xl/worksheets/sheet' + (i + 1) +
              '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
          }).join("") + "</Types>" },

      { nombre: "_rels/.rels",
        contenido: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
          "</Relationships>" },

      { nombre: "xl/workbook.xml",
        contenido: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
          'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
          nombres.map(function (n, i) {
            return '<sheet name="' + esc(n) + '" sheetId="' + (i + 1) +
              '" r:id="rId' + (i + 1) + '"/>';
          }).join("") + "</sheets></workbook>" },

      { nombre: "xl/_rels/workbook.xml.rels",
        contenido: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          hojas.map(function (h, i) {
            return '<Relationship Id="rId' + (i + 1) +
              '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"' +
              ' Target="worksheets/sheet' + (i + 1) + '.xml"/>';
          }).join("") +
          '<Relationship Id="rId' + (hojas.length + 1) +
          '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
          "</Relationships>" },

      /* Dos estilos: el normal y el de la cabecera, en negrita y con fondo.
         El índice 1 es el que piden las celdas de la primera fila. */
      { nombre: "xl/styles.xml",
        contenido: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
          '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
          '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>' +
          '<fills count="3"><fill><patternFill patternType="none"/></fill>' +
          '<fill><patternFill patternType="gray125"/></fill>' +
          '<fill><patternFill patternType="solid"><fgColor rgb="FF14313F"/>' +
          '<bgColor indexed="64"/></patternFill></fill></fills>' +
          '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
          '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
          '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
          '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
          "</cellXfs></styleSheet>" }
    ];

    hojas.forEach(function (h, i) {
      archivos.push({ nombre: "xl/worksheets/sheet" + (i + 1) + ".xml", contenido: hojaXML(h) });
    });

    return zip(archivos);
  }

  return { libro: libro, comoNumero: comoNumero, columna: columna };
})();

if (typeof module !== "undefined" && module.exports) { module.exports = Excel; }
