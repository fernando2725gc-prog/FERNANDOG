/* =========================================================================
   excel.js — Que los libros se abran de verdad

   Un .xlsx mal escrito no se nota hasta que alguien intenta abrirlo, y para
   entonces ya está en un correo camino del tribunal. Así que no basta con
   comprobar que el botón descarga algo: hay que abrir el archivo como lo
   abrirá Excel —un ZIP con su XML dentro— y mirar si cuadra.

   Dos cosas hacen que Excel declare un libro dañado y no abra NADA: dos
   hojas con el mismo nombre, y un carácter prohibido en el nombre de una
   hoja. Las dos se comprueban.
   ========================================================================= */
const E = require("./entorno.js");
const falsoDB = require("./falsodb.js");
const fs = require("fs");
const { execFileSync } = require("child_process");
const TMP = "/var/tmp/xlsx-prueba";

/* Se abre con zipfile de Python y no con `unzip`, que trata los corchetes
   de «[Content_Types].xml» como comodín y no encuentra justo el archivo sin
   el cual Excel no abre nada. */
function py(ruta, codigo, extra) {
  return execFileSync("python3", ["-I", "-c",
    "import sys,zipfile,xml.etree.ElementTree as ET\n" +
    "z=zipfile.ZipFile(sys.argv[1])\n" + codigo,
    ruta].concat(extra || []), { encoding: "utf8" });
}

const revisar = (ruta) => JSON.parse(py(ruta,
  "assert z.testzip() is None, 'ZIP corrupto'\n" +
  "for n in z.namelist(): ET.fromstring(z.read(n))\n" +
  "import json; print(json.dumps(z.namelist()))"));

const texto = (ruta, interno) => py(ruta,
  "sys.stdout.write(z.read(sys.argv[2]).decode('utf-8'))", [interno]);

const hojasDe = (ruta) =>
  [...texto(ruta, "xl/workbook.xml").matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]);

(async () => {
  const s = E.suite("excel");
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });

  const b = await E.navegador();
  const ctx = await b.newContext(Object.assign({ acceptDownloads: true }, E.ESCRITORIO));
  await ctx.addInitScript(falsoDB);
  const p = s.vigilar(await ctx.newPage(), "planta");
  await p.goto(E.BASE + "/interno/", { waitUntil: "networkidle" });
  await E.entrar(p, "aquiroz", "supervision2026", ".lateral");

  const bajar = async (vista, selector) => {
    await p.click('.nav-item[data-ir="' + vista + '"]');
    await p.waitForTimeout(700);
    const [d] = await Promise.all([
      p.waitForEvent("download", { timeout: 20000 }),
      p.click(selector)
    ]);
    const ruta = TMP + "/" + d.suggestedFilename();
    await d.saveAs(ruta);
    return ruta;
  };

  s.bloque("[1] Cada vista exporta un libro que Excel puede abrir");

  const casos = [
    ["lotes", "#btnCsvLotes", "Lotes"],
    ["produccion", "#btnCsvProduccion", "Produccion"],
    ["reportes", "#btnCsvReporte", null],
    ["proveedores", "#btnCsvProveedores", "Proveedores"],
    ["liquidacion", "#btnCsvLiquidacion", "Liquidaciones"],
    ["costeo", "#btnCsvCosteo", "Costeo por causa"],
    ["tiempos", "#btnCsvTiempos", null]
  ];

  for (const [vista, sel, hoja] of casos) {
    await s.paso(vista, async () => {
      const ruta = await bajar(vista, sel);
      if (!/\.xlsx$/.test(ruta)) throw new Error("no es .xlsx: " + ruta);
      const dentro = revisar(ruta);
      for (const obligado of ["[Content_Types].xml", "xl/workbook.xml", "xl/styles.xml"]) {
        if (!dentro.includes(obligado)) throw new Error("falta " + obligado);
      }
      if (hoja && !hojasDe(ruta).includes(hoja)) {
        throw new Error("hojas: " + hojasDe(ruta).join(", "));
      }
      const filas = (texto(ruta, "xl/worksheets/sheet1.xml").match(/<row /g) || []).length;
      if (filas < 2) throw new Error("el libro no trae ni una fila de datos");
    });
  }

  s.bloque("[2] El libro completo junta todas las tablas");

  let LIBRO = null;
  await s.paso("una hoja por informe más una por línea de tiempos", async () => {
    LIBRO = await bajar("reportes", "#btnLibroCompleto");
    revisar(LIBRO);
    const hojas = hojasDe(LIBRO);
    if (hojas.length < 7) throw new Error("solo " + hojas.length + " hojas");
    for (const esperada of ["Detalle de lotes", "Detalle de producción", "Consolidado por proveedor"]) {
      if (!hojas.includes(esperada)) throw new Error("falta la hoja " + esperada);
    }
    if (!hojas.some((h) => /^Tiempos /.test(h))) throw new Error("faltan las hojas de tiempos");
  });

  await s.paso("sin hojas repetidas ni nombres que Excel rechace", async () => {
    const hojas = hojasDe(LIBRO);
    const repes = hojas.filter((h, i) => hojas.indexOf(h) !== i);
    if (repes.length) throw new Error("hojas repetidas: " + repes.join(", "));
    for (const h of hojas) {
      if (h.length > 31) throw new Error("nombre demasiado largo: " + h);
      if (/[:\\\/?*\[\]]/.test(h)) throw new Error("carácter prohibido: " + h);
    }
  });

  await s.paso("los números van como números, no como texto", async () => {
    const hoja = texto(LIBRO, "xl/worksheets/sheet5.xml");
    const numeros = (hoja.match(/<c [^>]*><v>/g) || []).length;
    if (numeros < 10) throw new Error("solo " + numeros + " celdas numéricas");
  });

  await s.paso("la cabecera queda congelada y con estilo", async () => {
    const hoja = texto(LIBRO, "xl/worksheets/sheet1.xml");
    if (!/state="frozen"/.test(hoja)) throw new Error("la cabecera no queda fija");
    if (!/<c r="A1"[^>]*s="1"/.test(hoja)) throw new Error("la cabecera no lleva estilo");
  });

  s.bloque("[3] Los números de es-EC se convierten bien");

  await s.paso("«1.234» son mil doscientos treinta y cuatro, no uno coma dos", async () => {
    /* Confundirlo exporta una cifra mil veces más pequeña, y en una columna
       de kilos eso pasa desapercibido justo hasta que alguien la suma. */
    const malos = await p.evaluate(() => {
      const casos = [["1.234", 1234], ["11.507,5", 11507.5], ["1234", 1234], ["0,5", 0.5],
        ["0.5", 0.5], ["-3,25", -3.25], ["1.234.567", 1234567], ["20", 20], ["0", 0],
        ["96,5%", null], ["$1.200,00", null], ["PIT261005-093", null], ["", null],
        ["12-34", null], ["1.23", 1.23]];
      return casos.filter(([e, x]) => Excel.comoNumero(e) !== x)
        .map(([e, x]) => JSON.stringify(e) + " → " + Excel.comoNumero(e) + ", se esperaba " + x);
    });
    if (malos.length) throw new Error(malos.join(" · "));
  });

  await b.close();
  s.fin();
})();
