/* =========================================================================
   db.js — Capa de datos del Sistema FLP
   Repositorio único de información para el control de pérdidas y la
   economía circular en las tres líneas de producto.

   Unidad de flujo estándar: caja de 11 kg (definida en el alcance del TIC).

   Cada parámetro numérico de catálogo lleva su ORIGEN declarado, según el
   estándar de rigor del proyecto:
     M = medido en planta   E = estimado   S = fuente secundaria
   ========================================================================= */

const DB = (function () {
  "use strict";

  const KEY = "flp.db.v6";
  const ESQUEMA = 6;

  /* ---------------------------------------------------------------- utils */

  function uid(prefix) {
    return prefix + "_" + Math.random().toString(36).slice(2, 10);
  }

  function hoy() { return new Date().toISOString().slice(0, 10); }

  function diasAtras(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  /* El almacén entrega los documentos congelados y compartidos entre
     entregas. Todo lo que entra al cache se copia: si no, cualquier
     escritura posterior fallaría por intentar mutar algo inmutable. */
  function copiar(x) {
    return x === null || x === undefined ? x : JSON.parse(JSON.stringify(x));
  }

  function sumarDias(fecha, n) {
    const d = new Date(fecha + "T12:00:00");
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  /* Semilla fija: la demo trae siempre los mismos números, para que las
     capturas del documento de tesis sean reproducibles. */
  function rng(seed) {
    let s = seed;
    return function () {
      s = (s * 1103515245 + 12345) % 2147483648;
      return s / 2147483648;
    };
  }

  /* ------------------------------------------------------------ constantes */

  const EMPRESA = {
    nombre: "FLP Ecuador",
    razonSocial: "F.L.P. Latinoamerican Perishables del Ecuador S.A.",
    sistema: "Sistema FLP",
    descripcion: "Trazabilidad, pérdidas y economía circular",
    confidencial: true
  };

  /* La unidad que llega del campo es la GAVETA; la que sale a exportación
     es la CAJA, y pesan cosas muy distintas. Confundirlas era el error de
     fondo de la versión anterior: daba por hecho que una caja pesaba 11 kg,
     que es lo que pesa una gaveta de pitahaya. */
  const PESO_GAVETA_KG = 11;

  /* Origen del dato — el estándar de rigor exige declararlo en todo número
     que no venga de un registro del propio sistema. */
  const ORIGENES = [
    { id: "M", nombre: "Medido", ayuda: "Tomado en planta durante el estudio de campo." },
    { id: "E", nombre: "Estimado", ayuda: "Valor de trabajo; debe confirmarse con la empresa." },
    { id: "S", nombre: "Fuente secundaria", ayuda: "Tomado de literatura o de un referente del sector." }
  ];

  const ESTADOS = [
    { id: "Anunciado", nombre: "Anunciado", rol: "proveedor", orden: 1,
      ayuda: "El proveedor avisó que envía la fruta. Falta que llegue a planta." },
    { id: "Recibido", nombre: "Recibido", rol: "recepcion", orden: 2,
      ayuda: "Recepción contó las cajas y pesó el lote. Listo para procesar." },
    { id: "Procesado", nombre: "Procesado", rol: "produccion", orden: 3,
      ayuda: "Producción registró lo exportable y las mermas con su causa raíz." },
    { id: "Cerrado", nombre: "Cerrado", rol: "supervisor", orden: 4,
      ayuda: "Supervisión cerró el lote. Ya no admite cambios." },
    { id: "Rechazado", nombre: "Rechazado", rol: "recepcion", orden: 0,
      ayuda: "La fruta no cumplió los mínimos y no ingresó a planta." }
  ];

  const CALIDADES = [
    { id: "A", nombre: "Exportación (A)", factor: 1.0 },
    { id: "B", nombre: "Segunda (B)", factor: 0.88 },
    { id: "C", nombre: "Nacional (C)", factor: 0.74 }
  ];

  const ROLES = [
    { id: "proveedor", nombre: "Proveedor", icono: "🚜",
      lema: "Anuncias los envíos de fruta y recibes el reporte de cada lote." },
    { id: "recepcion", nombre: "Recepción", icono: "⚖️",
      lema: "Cuentas las cajas y pesas la fruta que llega a planta." },
    { id: "produccion", nombre: "Producción", icono: "🏭",
      lema: "Registras lo procesado, lo exportable y las mermas con su causa." },
    { id: "supervisor", nombre: "Supervisor", icono: "📋",
      lema: "Planificas el día, cierras lotes, envías reportes y ves los indicadores." }
  ];

  const TURNOS = ["Matutino", "Vespertino", "Nocturno"];

  /* ------------------------------------------------------------ catálogos */

  /* Los catálogos son EDITABLES desde la app: los valores marcados con
     origen "E" son de trabajo y deben confirmarse con la empresa antes de
     usarlos en el documento. */

  function lineasBase() {
    return [
      { id: "ln_pitahaya", codigo: "PIT", nombre: "Pitahaya roja",
        pesoGavetaKg: 11, origenPesoGaveta: "M",
        pesoCajaKg: 3, origenPesoCaja: "M",
        /* Rendimiento exportable sobre lo que entra a proceso, del balance
           de masa de la base maestra. Sustituye a la «meta» inventada. */
        rendimientoExportable: 0.965, origenRendimiento: "M",
        metaRendimiento: 0.98, origenMeta: "E",
        valorKgProductor: 1.50, origenValorKg: "S",
        valorKgLocal: 0.60, origenValorLocal: "S",
        ingresoDiarioKg: 2000, origenIngreso: "E",
        color: "#c0246b", activa: true },
      { id: "ln_tomate", codigo: "TOM", nombre: "Tomate de árbol",
        pesoGavetaKg: 20, origenPesoGaveta: "M",
        pesoCajaKg: 2.5, origenPesoCaja: "M",
        rendimientoExportable: 0.960, origenRendimiento: "M",
        metaRendimiento: 0.98, origenMeta: "E",
        valorKgProductor: 1.54, origenValorKg: "S",
        valorKgLocal: 0.90, origenValorLocal: "E",
        ingresoDiarioKg: 1000, origenIngreso: "E",
        color: "#c85a1e", activa: true },
      { id: "ln_granadilla", codigo: "GRA", nombre: "Granadilla",
        pesoGavetaKg: 12, origenPesoGaveta: "M",
        pesoCajaKg: 2, origenPesoCaja: "M",
        rendimientoExportable: 0.975, origenRendimiento: "M",
        metaRendimiento: 0.98, origenMeta: "E",
        valorKgProductor: 1.40, origenValorKg: "E",
        valorKgLocal: 0.70, origenValorLocal: "E",
        ingresoDiarioKg: 860, origenIngreso: "E",
        color: "#b8860b", activa: true }
    ];
  }

  /* Estudio de tiempos, actividad por actividad, tal como está en la base
     maestra del TIC. Aquí NO se guarda el tiempo estándar: se guarda la
     lectura (TO), la valoración Westinghouse (v) y el suplemento OIT, y el
     estándar se calcula. Así, cuando se cronometren ciclos nuevos, basta
     cambiar el TO y se recalculan takt, operarios, costo y pérdidas.

     `personas` es la clave de la asignación: una actividad con 2 personas
     tarda lo mismo pero consume el doble de mano de obra. De ahí salen dos
     relojes distintos —el ciclo y el contenido de trabajo— que la versión
     anterior confundía en un solo número. */
  function actividadesBase() {
    return [
      /* ---- pitahaya ---- */
      { id: "P-REC", lineaId: "ln_pitahaya", orden: 1, codigo: "P-REC",
        nombre: "Recepción y pesaje de gaveta",
        simbolo: "O", estacion: "Recepción", unidad: "gaveta",
        to: 0.5, v: 1, suplemento: 0.19, personas: 1,
        origen: "E", base: "Pesaje y registro manual por gaveta; del orden de pesar una caja (0,25) más el registro.", activa: true },
      { id: "P-INR", lineaId: "ln_pitahaya", orden: 2, codigo: "P-INR",
        nombre: "Inspección de calidad en recepción",
        simbolo: "I", estacion: "Recepción", unidad: "gaveta",
        to: 0.4, v: 1, suplemento: 0.17, personas: 1,
        origen: "E", base: "Muestreo visual ≈ 1/3 de la verificación completa medida en empaque (P-VER).", activa: true },
      { id: "P-TR1", lineaId: "ln_pitahaya", orden: 3, codigo: "P-TR1",
        nombre: "Transporte a almacenaje / categorización",
        simbolo: "T", estacion: "Transporte", unidad: "gaveta",
        to: 1, v: 1, suplemento: 0.19, personas: 1,
        origen: "E", base: "~25 m (análogo a 35 pasos medidos en tomate), ida y vuelta + 10 s de carga.", activa: true },
      { id: "P-TR2", lineaId: "ln_pitahaya", orden: 4, codigo: "P-TR2",
        nombre: "Transporte a sopleteado",
        simbolo: "T", estacion: "Transporte", unidad: "gaveta",
        to: 0.6667, v: 1, suplemento: 0.19, personas: 1,
        origen: "E", base: "~15 m estimados; medir.", activa: true },
      { id: "P-SOP", lineaId: "ln_pitahaya", orden: 5, codigo: "P-SOP",
        nombre: "Sopleteado: retiro de espinas/brácteas y corte de pedúnculo (mesa de 2 personas)",
        simbolo: "O", estacion: "Sopleteado", unidad: "gaveta",
        to: 2.675, v: 1, suplemento: 0.19, personas: 2,
        origen: "M", base: "Promedio de mesas 2 y 3 (200 y 121 s por gaveta), pendiente confirmar alcance.", activa: true },
      { id: "P-TR3", lineaId: "ln_pitahaya", orden: 6, codigo: "P-TR3",
        nombre: "Transporte a empaque",
        simbolo: "T", estacion: "Transporte", unidad: "gaveta",
        to: 0.5, v: 1, suplemento: 0.19, personas: 1,
        origen: "E", base: "~10 m estimados. La mesa 1 ya evita este traslado.", activa: true },
      { id: "P-VER", lineaId: "ln_pitahaya", orden: 7, codigo: "P-VER",
        nombre: "Verificar calidad y colocar mallón",
        simbolo: "I", estacion: "Empaque", unidad: "gaveta",
        to: 1.1833, v: 1, suplemento: 0.17, personas: 1,
        origen: "M", base: "3 lecturas (Registro_Campo n° 5-7).", activa: true },
      { id: "P-EMP", lineaId: "ln_pitahaya", orden: 8, codigo: "P-EMP",
        nombre: "Empacar en caja de 3 kg",
        simbolo: "O", estacion: "Empaque", unidad: "caja",
        to: 1.3, v: 1, suplemento: 0.16, personas: 1,
        origen: "M", base: "1 lectura (Registro_Campo n° 8). Tomar 5 ciclos.", activa: true },
      { id: "P-PES", lineaId: "ln_pitahaya", orden: 9, codigo: "P-PES",
        nombre: "Calibrar y pesar la caja",
        simbolo: "I", estacion: "Empaque", unidad: "caja",
        to: 0.25, v: 1, suplemento: 0.17, personas: 1,
        origen: "E", base: "~15 s de pesaje y ajuste de una fruta.", activa: true },
      { id: "P-FLE", lineaId: "ln_pitahaya", orden: 10, codigo: "P-FLE",
        nombre: "Colocar fleje / etiqueta",
        simbolo: "O", estacion: "Empaque", unidad: "caja",
        to: 0.3, v: 1, suplemento: 0.16, personas: 1,
        origen: "M", base: "1 lectura (Registro_Campo n° 9).", activa: true },
      { id: "P-PAL", lineaId: "ln_pitahaya", orden: 11, codigo: "P-PAL",
        nombre: "Colocar caja en pallet por calibre",
        simbolo: "T", estacion: "Empaque", unidad: "caja",
        to: 0.1, v: 1, suplemento: 0.16, personas: 1,
        origen: "M", base: "1 lectura (Registro_Campo n° 10).", activa: true },
      { id: "P-ETQ", lineaId: "ln_pitahaya", orden: 12, codigo: "P-ETQ",
        nombre: "Etiquetado final del cliente",
        simbolo: "O", estacion: "Empaque", unidad: "caja",
        to: 0.15, v: 1, suplemento: 0.16, personas: 1,
        origen: "E", base: "~9 s por caja. Confirmar si se pone sticker por fruta (en maracuyá: 0,52 min/caja).", activa: true },
      /* ---- tomate ---- */
      { id: "T-REC", lineaId: "ln_tomate", orden: 1, codigo: "T-REC",
        nombre: "Recepción y pesaje de gaveta",
        simbolo: "O", estacion: "Recepción", unidad: "gaveta",
        to: 0.6, v: 1, suplemento: 0.24, personas: 1,
        origen: "E", base: "Análogo a pitahaya (0,50) ajustado por gaveta de 20 kg.", activa: true },
      { id: "T-INR", lineaId: "ln_tomate", orden: 2, codigo: "T-INR",
        nombre: "Inspección de calidad en recepción",
        simbolo: "I", estacion: "Recepción", unidad: "gaveta",
        to: 0.4, v: 1, suplemento: 0.17, personas: 1,
        origen: "E", base: "Igual a pitahaya; el DAP registra esta inspección sin tiempo.", activa: true },
      { id: "T-TR1", lineaId: "ln_tomate", orden: 3, codigo: "T-TR1",
        nombre: "Transporte de almacenamiento a empaque",
        simbolo: "T", estacion: "Transporte", unidad: "gaveta",
        to: 0.9833, v: 1, suplemento: 0.24, personas: 1,
        origen: "E", base: "Distancia M (35 pasos × 0,7 m); tiempo estimado a 1 m/s.", activa: true },
      { id: "T-CLL", lineaId: "ln_tomate", orden: 4, codigo: "T-CLL",
        nombre: "Inspección, clasificación y limpieza (lavado con agente sin ficha técnica)",
        simbolo: "O", estacion: "Clasificación y limpieza", unidad: "gaveta",
        to: 12.09, v: 1, suplemento: 0.17, personas: 2,
        origen: "M", base: "1 lectura con 2 personas (Registro_Campo n° 14). Separar limpieza y clasificación en la próxima visita.", activa: true },
      { id: "T-SEC", lineaId: "ln_tomate", orden: 5, codigo: "T-SEC",
        nombre: "Secado",
        simbolo: "O", estacion: "Clasificación y limpieza", unidad: "gaveta",
        to: 7.29, v: 1, suplemento: 0.17, personas: 1,
        origen: "M", base: "1 lectura (Registro_Campo n° 15). Personas: 1 (supuesto).", activa: true },
      { id: "T-EMP", lineaId: "ln_tomate", orden: 6, codigo: "T-EMP",
        nombre: "Empacar en caja de 2,5 kg",
        simbolo: "O", estacion: "Empaque", unidad: "caja",
        to: 1.29, v: 1, suplemento: 0.16, personas: 1,
        origen: "M", base: "1 lectura (Registro_Campo n° 16). En maracuyá, con la misma caja: 1,00 min (5 ciclos).", activa: true },
      { id: "T-PES", lineaId: "ln_tomate", orden: 7, codigo: "T-PES",
        nombre: "Calibrar y pesar la caja",
        simbolo: "I", estacion: "Empaque", unidad: "caja",
        to: 0.25, v: 1, suplemento: 0.17, personas: 1,
        origen: "E", base: "Análogo a pitahaya.", activa: true },
      { id: "T-FLE", lineaId: "ln_tomate", orden: 8, codigo: "T-FLE",
        nombre: "Colocar fleje / etiqueta",
        simbolo: "O", estacion: "Empaque", unidad: "caja",
        to: 0.3, v: 1, suplemento: 0.16, personas: 1,
        origen: "E", base: "Análogo al tiempo medido en pitahaya (0,30).", activa: true },
      { id: "T-PAL", lineaId: "ln_tomate", orden: 9, codigo: "T-PAL",
        nombre: "Transporte de caja al pallet",
        simbolo: "T", estacion: "Empaque", unidad: "caja",
        to: 0.2, v: 1, suplemento: 0.16, personas: 1,
        origen: "M", base: "Distancia M (2 m); tiempo solo en versión FLP2 (verificar).", activa: true },
      /* ---- granadilla ---- */
      { id: "G-REC", lineaId: "ln_granadilla", orden: 1, codigo: "G-REC",
        nombre: "Recepción y pesaje de gaveta",
        simbolo: "O", estacion: "Recepción", unidad: "gaveta",
        to: 0.5, v: 1, suplemento: 0.19, personas: 1,
        origen: "E", base: "Análogo a pitahaya (gaveta de 12 kg).", activa: true },
      { id: "G-INR", lineaId: "ln_granadilla", orden: 2, codigo: "G-INR",
        nombre: "Inspección de calidad en recepción",
        simbolo: "I", estacion: "Recepción", unidad: "gaveta",
        to: 0.4, v: 1, suplemento: 0.17, personas: 1,
        origen: "E", base: "Análogo a pitahaya.", activa: true },
      { id: "G-TR1", lineaId: "ln_granadilla", orden: 3, codigo: "G-TR1",
        nombre: "Traslado de almacenamiento a empaque",
        simbolo: "T", estacion: "Transporte", unidad: "gaveta",
        to: 0.7667, v: 1, suplemento: 0.19, personas: 1,
        origen: "E", base: "Distancia de 18 m (FLP2); tiempo estimado a 1 m/s.", activa: true },
      { id: "G-CLA", lineaId: "ln_granadilla", orden: 4, codigo: "G-CLA",
        nombre: "Colocar en gaveta, verificar peso ≥ 70 g y poner mallón nuevo",
        simbolo: "O", estacion: "Clasificación", unidad: "gaveta",
        to: 7.86, v: 1, suplemento: 0.17, personas: 1.5,
        origen: "M", base: "Dos métodos (Registro_Campo n° 21-22): 9,43 min (1 persona) y 6,29 min (2 personas). Actual = promedio.", activa: true },
      { id: "G-EMP", lineaId: "ln_granadilla", orden: 5, codigo: "G-EMP",
        nombre: "Empacar según calibre en caja de 2 kg",
        simbolo: "O", estacion: "Empaque", unidad: "caja",
        to: 0.885, v: 1, suplemento: 0.16, personas: 1,
        origen: "M", base: "Dos métodos (Registro_Campo n° 23-24): 0,40 y 1,37 min. Actual = promedio.", activa: true },
      { id: "G-PES", lineaId: "ln_granadilla", orden: 6, codigo: "G-PES",
        nombre: "Verificar peso de la caja",
        simbolo: "I", estacion: "Empaque", unidad: "caja",
        to: 0.2, v: 1, suplemento: 0.17, personas: 1,
        origen: "E", base: "Menor que en pitahaya: el empaque ya se hace por calibre.", activa: true },
      { id: "G-PAL", lineaId: "ln_granadilla", orden: 7, codigo: "G-PAL",
        nombre: "Traslado al pallet de exportación con etiquetado",
        simbolo: "T", estacion: "Empaque", unidad: "caja",
        to: 0.25, v: 1, suplemento: 0.16, personas: 1,
        origen: "E", base: "Pallet 0,10 (medido en pitahaya) + etiqueta 0,15. El 6,29 anotado se descarta por ser copia (Registro_Campo n°", activa: true }
    ];
  }

  function causasBase() {
    return [
      { id: "CR1", codigo: "CR1", nombre: "Por definir", origen: "Por clasificar",
        definida: false, principal: false, descripcion: "" },
      { id: "CR2", codigo: "CR2", nombre: "Por definir", origen: "Por clasificar",
        definida: false, principal: false, descripcion: "" },
      { id: "CR3", codigo: "CR3", nombre: "Por definir", origen: "Por clasificar",
        definida: false, principal: false, descripcion: "" },
      { id: "CR4", codigo: "CR4", nombre: "Por definir", origen: "Por clasificar",
        definida: false, principal: false,
        descripcion: "El documento registra que su cronometraje fue corregido." },
      { id: "CR5", codigo: "CR5", nombre: "Mermas sin segregar", origen: "Proceso",
        definida: true, principal: true,
        descripcion: "El descarte sale mezclado, así que no puede valorizarse." },
      { id: "CR6", codigo: "CR6", nombre: "Variabilidad de proveedor", origen: "Campo",
        definida: true, principal: true,
        descripcion: "Calidad y peso de entrega dispares entre proveedores y entre envíos." },
      { id: "CR7", codigo: "CR7", nombre: "Layout de planta", origen: "Proceso",
        definida: true, principal: true,
        descripcion: "Recorridos y transportes innecesarios entre estaciones." },
      { id: "CR8", codigo: "CR8", nombre: "Subutilización del área de sopleteado",
        origen: "Proceso", definida: true, principal: true,
        descripcion: "La estación de sopleteado opera por debajo de su capacidad." }
    ];
  }

  /* Destinos del descarte, en orden de valor recuperado. Es la jerarquía que
     sostiene el indicador de valorización: todo lo que no termina en relleno
     sanitario se considera aprovechado. */
  function destinosBase() {
    return [
      { id: "ds_segunda", nombre: "Segunda calidad — mercado nacional", nivel: 1,
        valoriza: true, valorKg: 0.45, origenValor: "E" },
      { id: "ds_subproducto", nombre: "Subproducto (pulpa, deshidratado, harina)", nivel: 2,
        valoriza: true, valorKg: 0.30, origenValor: "E" },
      { id: "ds_animal", nombre: "Alimentación animal", nivel: 3,
        valoriza: true, valorKg: 0.08, origenValor: "E" },
      { id: "ds_compost", nombre: "Compostaje", nivel: 4,
        valoriza: true, valorKg: 0.03, origenValor: "E" },
      { id: "ds_relleno", nombre: "Relleno sanitario", nivel: 5,
        valoriza: false, valorKg: -0.02, origenValor: "E" }
    ];
  }

  function proveedoresBase() {
    return [
      { id: "pv_01", codigo: "PRV-001", nombre: "Finca La Esperanza", documento: "0991234567001", contacto: "Marta Cedeño", telefono: "0985551201", email: "laesperanza@correo.com", zona: "Pichincha", activo: true, fechaAlta: diasAtras(400) },
      { id: "pv_02", codigo: "PRV-002", nombre: "Agrícola El Progreso", documento: "0992345678001", contacto: "Luis Vera", telefono: "0985551202", email: "elprogreso@correo.com", zona: "Tungurahua", activo: true, fechaAlta: diasAtras(370) },
      { id: "pv_03", codigo: "PRV-003", nombre: "Hacienda San Miguel", documento: "0993456789001", contacto: "Ana Rueda", telefono: "0985551203", email: "sanmiguel@correo.com", zona: "Santo Domingo", activo: true, fechaAlta: diasAtras(310) },
      { id: "pv_04", codigo: "PRV-004", nombre: "Cooperativa Frutos del Sur", documento: "0994567890001", contacto: "Jorge Loor", telefono: "0985551204", email: "frutosdelsur@correo.com", zona: "Imbabura", activo: true, fechaAlta: diasAtras(240) },
      { id: "pv_05", codigo: "PRV-005", nombre: "Predio Santa Rosa", documento: "0995678901001", contacto: "Elena Bravo", telefono: "0985551205", email: "santarosa@correo.com", zona: "Cotopaxi", activo: true, fechaAlta: diasAtras(180) },
      { id: "pv_06", codigo: "PRV-006", nombre: "Agroexport Valle Verde", documento: "0996789012001", contacto: "Pedro Zambrano", telefono: "0985551206", email: "valleverde@correo.com", zona: "Pichincha", activo: false, fechaAlta: diasAtras(520) }
    ];
  }

  /* Cuentas de la demostración. La credencial se calcula al sembrar, no se
     guarda escrita: ver sembrarCredenciales(). */
  const CLAVES_DEMO = {
    us_01: "pitahaya2026", us_02: "granadilla2026",
    us_03: "4521", us_04: "7734", us_05: "8890",
    us_06: "supervision2026"
  };

  function usuariosBase() {
    return [
      { id: "us_01", nombre: "Marta Cedeño", usuario: "PRV-001", rol: "proveedor", proveedorId: "pv_01", activo: true, debeCambiar: false },
      { id: "us_02", nombre: "Luis Vera", usuario: "PRV-002", rol: "proveedor", proveedorId: "pv_02", activo: true, debeCambiar: false },
      { id: "us_03", nombre: "Diego Andrade", usuario: "dandrade", rol: "recepcion", proveedorId: null, activo: true, debeCambiar: false },
      { id: "us_04", nombre: "Carlos Mendoza", usuario: "cmendoza", rol: "produccion", proveedorId: null, activo: true, debeCambiar: false },
      { id: "us_05", nombre: "Sofía Palma", usuario: "spalma", rol: "produccion", proveedorId: null, activo: true, debeCambiar: false },
      { id: "us_06", nombre: "Ing. Andrea Quiroz", usuario: "aquiroz", rol: "supervisor", proveedorId: null, activo: true, debeCambiar: false }
    ];
  }

  /* Deriva las credenciales de la demostración al arrancar. Es asíncrono, así
     que hasta que termina esos usuarios no pueden entrar: la interfaz lo
     refleja con el estado de conexión. */
  async function sembrarCredenciales() {
    const db = load();
    const pendientes = db.usuarios.filter(function (u) {
      return CLAVES_DEMO[u.id] && !u.credencial;
    });
    if (!pendientes.length) return;
    const credenciales = await Promise.all(pendientes.map(function (u) {
      return Auth.crearCredencial(CLAVES_DEMO[u.id]);
    }));
    /* update() reemplaza el registro por una copia nueva, así que funciona
       igual venga el original del almacén o de la semilla local. */
    pendientes.forEach(function (u, i) {
      update("usuarios", u.id, { credencial: credenciales[i] });
    });
  }

  /* Cuentas de la demostración que TODAVÍA tienen su clave original. Se
     comprueba de verdad contra la credencial guardada: si alguien la cambió,
     esa cuenta deja de aparecer en vez de mostrar una clave que ya no sirve.
     En un despliegue con usuarios reales la lista sale vacía sola. */
  async function cuentasDemo(rolesPermitidos) {
    const candidatos = all("usuarios").filter(function (u) {
      return CLAVES_DEMO[u.id] && u.credencial && u.activo &&
        (!rolesPermitidos || rolesPermitidos.indexOf(u.rol) !== -1);
    });
    const validas = await Promise.all(candidatos.map(async function (u) {
      const sirve = await Auth.verificar(CLAVES_DEMO[u.id], u.credencial);
      return sirve ? {
        nombre: u.nombre, usuario: u.usuario, clave: CLAVES_DEMO[u.id], rol: u.rol,
        detalle: u.proveedorId ? (get("proveedores", u.proveedorId) || {}).nombre : null
      } : null;
    }));
    return validas.filter(Boolean);
  }

  /* Busca por nombre de acceso o por código de proveedor, sin distinguir
     mayúsculas: en el campo se escribe como venga. */
  function buscarPorAcceso(texto) {
    const t = String(texto || "").trim().toLowerCase();
    if (!t) return null;
    return all("usuarios").find(function (u) {
      return String(u.usuario || "").toLowerCase() === t;
    }) || null;
  }

  /* Activación por el propio proveedor: se identifica con su código y su
     documento, que es lo que la planta registró y él conoce de memoria.
     Devuelve el usuario si todo cuadra, o el motivo por el que no. */
  function comprobarActivacion(codigo, documento) {
    const u = buscarPorAcceso(codigo);
    if (!u || u.rol !== "proveedor") return { error: "no-coincide" };
    if (u.credencial) return { error: "ya-activa" };

    const prov = get("proveedores", u.proveedorId);
    if (!prov) return { error: "no-coincide" };
    if (!prov.activo) return { error: "inactivo" };

    /* Se comparan solo los dígitos: da igual si escribe guiones o espacios. */
    const limpia = function (x) { return String(x || "").replace(/\D/g, ""); };
    if (!limpia(documento) || limpia(documento) !== limpia(prov.documento)) {
      return { error: "no-coincide" };
    }
    return { usuario: u, proveedor: prov };
  }

  function accesoLibre(usuario, exceptoId) {
    const t = String(usuario || "").trim().toLowerCase();
    return !all("usuarios").some(function (u) {
      return u.id !== exceptoId && String(u.usuario || "").toLowerCase() === t;
    });
  }

  /* Parámetros de planta que alimentan el planificador diario. */
  function parametrosBase() {
    return {
      /* Todos de la hoja LEEME_Parametros de la base maestra. */
      diasOperativos: 240, origenDias: "E",
      jornadaMin: 480, origenJornada: "E",
      pausasMin: 60, origenPausas: "M",
      /* Jornada menos pausas: es el tiempo con el que se calcula el takt. */
      disponibleMin: 420, origenDisponible: "E",
      operariosDisponibles: 12, origenOperarios: "E",
      eficienciaPlanta: 0.85, origenEficiencia: "E",
      salarioBasico: 482, origenSalario: "S",
      /* SBU + décimos + fondos de reserva + aporte patronal, sobre 1920 h. */
      costoHoraHombre: 4.132, origenCostoHora: "E",
      deshidratacion: 0.005, origenDeshidratacion: "E"
    };
  }

  /* ------------------------------------------------- tiempos derivados */

  /* El tiempo estándar NO se guarda: se calcula desde la lectura.
         TN = TO × valoración Westinghouse
         TE = TN × (1 + suplemento OIT)
     Es la cadena del estudio de tiempos, y dejarla a la vista es lo que
     permite que una medición nueva se propague sola a todo lo demás. */
  function tiempoEstandarAct(a) {
    return (Number(a.to) || 0) * (Number(a.v) || 1) * (1 + (Number(a.suplemento) || 0));
  }

  /* Cuántas cajas de exportación salen de una gaveta: es el puente entre
     la unidad que entra del campo y la que sale al contenedor. */
  function cajasPorGaveta(linea) {
    if (!linea || !linea.pesoCajaKg) return 0;
    return (linea.pesoGavetaKg * linea.rendimientoExportable) / linea.pesoCajaKg;
  }

  function actividadesDe(lineaId, lista) {
    return (lista || actividadesBase()).filter(function (a) {
      return a.lineaId === lineaId && a.activa !== false;
    });
  }

  /* Minutos de RELOJ que tarda una gaveta en recorrer la línea. */
  function cicloGavetaMin(linea, lista) {
    const porGaveta = cajasPorGaveta(linea);
    return actividadesDe(linea.id, lista).reduce(function (a, act) {
      return a + tiempoEstandarAct(act) * (act.unidad === "caja" ? porGaveta : 1);
    }, 0);
  }

  /* Minutos-PERSONA que consume esa misma gaveta. Difiere del ciclo en las
     actividades que ocupan a más de una persona a la vez. */
  function contenidoGavetaMin(linea, lista) {
    const porGaveta = cajasPorGaveta(linea);
    return actividadesDe(linea.id, lista).reduce(function (a, act) {
      return a + tiempoEstandarAct(act) * (act.unidad === "caja" ? porGaveta : 1) *
        (Number(act.personas) || 1);
    }, 0);
  }

  /* ---------------------------------------------------------------- semilla */

  function semilla(dias) {
    const r = rng(20260922);
    const historial = dias || 70;

    const lineas = lineasBase();
    const actividades = actividadesBase();
    const causas = causasBase();
    const destinos = destinosBase();
    const proveedores = proveedoresBase();
    const usuarios = usuariosBase();

    /* Cada proveedor declara con su propio sesgo: es lo que hace visible la
       CR6 (variabilidad de proveedor) en los indicadores. */
    const sesgo = { pv_01: 0.995, pv_02: 0.972, pv_03: 0.999, pv_04: 0.962, pv_05: 0.988 };

    const lotes = [];
    let folio = 0;

    for (let d = historial; d >= 0; d -= 1) {
      const fecha = diasAtras(d);
      if (new Date(fecha + "T12:00:00").getDay() === 0) continue;

      const envios = 1 + Math.floor(r() * 3);
      for (let i = 0; i < envios; i += 1) {
        const pv = proveedores[Math.floor(r() * 5)];
        const linea = lineas[Math.floor(r() * lineas.length)];
        const calidad = r() < 0.66 ? "A" : r() < 0.87 ? "B" : "C";
        /* Gavetas por envío, dimensionadas sobre el ingreso diario real de
           cada línea (2000 / 1000 / 860 kg al día). */
        const gavetasDia = linea.ingresoDiarioKg / linea.pesoGavetaKg;
        const gavetas = Math.max(8, Math.round(gavetasDia * (0.25 + r() * 0.55)));
        folio += 1;

        const lote = {
          id: uid("lt"),
          folio: "LOT-" + String(folio).padStart(4, "0"),
          codigoLote: linea.codigo + fecha.replace(/-/g, "").slice(2) + "-" + String(folio).padStart(3, "0"),
          fecha: fecha,
          proveedorId: pv.id,
          lineaId: linea.id,
          gavetasAnunciadas: gavetas,
          /* El proveedor declara cuánto pesa su gaveta: no todas vienen al
             peso nominal, y esa diferencia es parte de la CR6. */
          pesoGavetaDeclarado: Number((linea.pesoGavetaKg * (0.97 + r() * 0.06)).toFixed(2)),
          kgAnunciados: 0,
          calidadDeclarada: calidad,
          /* Se liquida por kilo recibido, no por bulto. */
          precioKg: Number((linea.valorKgProductor * (0.94 + r() * 0.12)).toFixed(3)),
          transporte: r() < 0.5 ? "Propio" : "Contratado",
          observacionesProveedor: "",
          anunciadoPor: "us_01",
          creadoEn: fecha + "T07:30:00",

          fechaRecepcion: null,
          gavetasRecibidas: null,
          kgRecibidos: null,
          calidadVerificada: null,
          observacionesRecepcion: "",
          recibidoPor: null,

          estado: "Anunciado",
          fechaCierre: null,
          cerradoPor: null,
          reporteEnviado: false,
          fechaReporte: null
        };

        lote.kgAnunciados = Math.round(gavetas * lote.pesoGavetaDeclarado);

        if (d > 1) {
          if (r() < 0.03) {
            lote.estado = "Rechazado";
            lote.fechaRecepcion = fecha;
            lote.recibidoPor = "us_03";
            lote.gavetasRecibidas = 0;
            lote.kgRecibidos = 0;
            lote.calidadVerificada = "C";
            lote.observacionesRecepcion = "Lote rechazado: fruta fuera de los mínimos de exportación.";
          } else {
            const s = sesgo[pv.id] || 0.99;
            lote.fechaRecepcion = r() < 0.85 ? fecha : sumarDias(fecha, 1);
            lote.recibidoPor = "us_03";
            lote.gavetasRecibidas = Math.max(1, Math.round(gavetas * (s + (r() - 0.5) * 0.02)));
            /* El peso por gaveta también varía: no todas vienen completas. */
            lote.kgRecibidos = Math.round(lote.gavetasRecibidas * linea.pesoGavetaKg * (0.97 + r() * 0.05));
            lote.calidadVerificada = r() < 0.18
              ? (calidad === "A" ? "B" : "C") : calidad;
            lote.estado = "Recibido";
          }
        }

        lotes.push(lote);
      }
    }

    /* ---------------------- producción ---------------------- */

    const producciones = [];
    let folioP = 0;

    lotes.forEach(function (lote) {
      if (lote.estado !== "Recibido") return;
      if (r() < 0.14) return;

      const linea = lineas.find(function (l) { return l.id === lote.lineaId; });
      const cal = CALIDADES.find(function (c) { return c.id === lote.calidadVerificada; });

      const gavetasProcesadas = lote.gavetasRecibidas;
      const kgProcesados = lote.kgRecibidos;
      /* Rendimiento en KILOS, que es como lo mide el balance de masa: de lo
         que entra a proceso, qué fracción sale empacada para exportación.
         Antes se contaba en «cajas sobre cajas», que con bultos de distinto
         peso a la entrada y a la salida no significa nada. */
      const rend = Math.min(0.995, linea.rendimientoExportable * cal.factor * (0.985 + r() * 0.03));
      const kgExportable = Math.round(kgProcesados * rend);
      const cajasExportables = Math.round(kgExportable / linea.pesoCajaKg);
      const kgMerma = kgProcesados - kgExportable;

      /* Reparto entre causas raíz. CR5-CR8 concentran la mayor parte, como
         indica el diagnóstico; las causas aún sin definir reciben poco. */
      const pesos = {
        CR5: 0.24,
        CR6: lote.calidadVerificada === "A" ? 0.14 : 0.28,
        CR7: 0.16,
        CR8: 0.20,
        CR1: 0.05, CR2: 0.04, CR3: 0.04, CR4: 0.03
      };
      const suma = Object.keys(pesos).reduce(function (a, k) { return a + pesos[k]; }, 0);

      /* Antes de segregar (CR5), casi todo el descarte va a relleno. En los
         lotes recientes ya se aplica la segregación propuesta. */
      const segrega = d3Reciente(lote.fechaRecepcion);
      const mermas = [];
      let repartido = 0;
      const claves = Object.keys(pesos);

      claves.forEach(function (k, idx) {
        let kg;
        if (idx === claves.length - 1) kg = kgMerma - repartido;
        else { kg = Math.round((kgMerma * pesos[k]) / suma); repartido += kg; }
        if (kg <= 0) return;

        let destinoId;
        if (!segrega) {
          destinoId = r() < 0.82 ? "ds_relleno" : "ds_animal";
        } else if (k === "CR6" || k === "CR5") {
          destinoId = r() < 0.5 ? "ds_segunda" : "ds_subproducto";
        } else {
          const opciones = ["ds_subproducto", "ds_animal", "ds_compost", "ds_relleno"];
          destinoId = opciones[Math.floor(r() * (r() < 0.75 ? 3 : 4))];
        }
        mermas.push({ causaId: k, kg: kg, destinoId: destinoId });
      });

      folioP += 1;
      const fechaProc = r() < 0.72 ? lote.fechaRecepcion : sumarDias(lote.fechaRecepcion, 1);

      /* Tiempo real contra el estándar: la brecha alimenta el indicador de
         eficiencia y el análisis de balanceo de línea. */
      const operarios = 3 + Math.floor(r() * 4);
      /* El estándar del lote es el contenido de trabajo —minutos-persona—
         porque es contra eso que se compara el tiempo que de verdad
         consumió la gente. El cálculo vive en indicadores.js. */
      const tiempoEstandar = gavetasProcesadas * contenidoGavetaMin(linea, actividades);
      const tiempoReal = Math.round((tiempoEstandar / operarios) * (0.95 + r() * 0.28));

      producciones.push({
        id: uid("pr"),
        folio: "PRD-" + String(folioP).padStart(4, "0"),
        fecha: fechaProc,
        loteId: lote.id,
        codigoLote: lote.codigoLote,
        lineaId: lote.lineaId,
        turno: r() < 0.55 ? "Matutino" : "Vespertino",
        gavetasProcesadas: gavetasProcesadas,
        kgProcesados: kgProcesados,
        cajasExportables: cajasExportables,
        kgExportable: kgExportable,
        mermas: mermas,
        operarios: operarios,
        tiempoRealMin: tiempoReal,
        operador: r() < 0.5 ? "Carlos Mendoza" : "Sofía Palma",
        observaciones: "",
        registradoPor: "us_04",
        creadoEn: fechaProc + "T14:00:00"
      });

      lote.estado = "Procesado";

      const diasDesde = Math.round((new Date(hoy()) - new Date(fechaProc)) / 86400000);
      if (diasDesde > 7) {
        lote.estado = "Cerrado";
        lote.fechaCierre = sumarDias(fechaProc, 2);
        lote.cerradoPor = "us_06";
        lote.reporteEnviado = true;
        lote.fechaReporte = lote.fechaCierre;
      }
    });

    return {
      esquema: ESQUEMA,
      creadoEn: new Date().toISOString(),
      lineas: lineas,
      actividades: actividadesBase(),
      causas: causas,
      destinos: destinos,
      proveedores: proveedores,
      usuarios: usuarios,
      lotes: lotes,
      producciones: producciones,
      planes: [],
      parametros: parametrosBase(),
      bitacora: []
    };
  }

  /* Los lotes de las últimas tres semanas ya aplican la segregación. */
  function d3Reciente(fecha) {
    if (!fecha) return false;
    return Math.round((new Date(hoy()) - new Date(fecha)) / 86400000) <= 21;
  }

  /* ------------------------------------------------- almacén compartido */

  const COLECCIONES = ["proveedores", "usuarios", "lotes", "producciones", "planes"];
  /* Catálogos y parámetros: pocos y pequeños, viajan en un solo documento. */
  const CONFIG = ["lineas", "actividades", "causas", "destinos", "parametros"];

  let remoto = null;
  let modo = "local";
  const suscripciones = [];

  /* ------------------------------------------------------ cola sin señal */

  /* Lo que no se pudo enviar queda aquí, en el propio dispositivo, hasta que
     vuelva la cobertura. Se guarda la REFERENCIA (colección + id), no una
     copia: así varias ediciones del mismo registro se envían una sola vez,
     con su último estado, y nunca se manda algo viejo. */
  const KEY_COLA = "flp.cola.v1";
  let cola = [];
  let alCambiarCola = null;

  function cargarCola() {
    try { cola = JSON.parse(localStorage.getItem(KEY_COLA) || "[]"); }
    catch (e) { cola = []; }
  }

  function guardarCola() {
    try { localStorage.setItem(KEY_COLA, JSON.stringify(cola)); } catch (e) { /* noop */ }
    if (alCambiarCola) alCambiarCola(cola.length);
  }

  function encolar(tipo, coleccion, id) {
    cola = cola.filter(function (x) {
      return !(x.coleccion === coleccion && x.id === id);
    });
    cola.push({ tipo: tipo, coleccion: coleccion, id: id, desde: new Date().toISOString() });
    guardarCola();
  }

  function pendientes() { return cola.length; }

  function estaPendiente(coleccion, id) {
    return cola.some(function (x) { return x.coleccion === coleccion && x.id === id; });
  }

  function registrosPendientes() {
    return cola.map(function (x) {
      if (x.tipo === "delete" || x.tipo === "sistema") return null;
      return { coleccion: x.coleccion, registro: get(x.coleccion, x.id) };
    }).filter(function (x) { return x && x.registro; });
  }

  /* El catálogo y la bitácora no viven en una colección sino en un documento
     único, así que no salen en registrosPendientes(). Se apartan aparte: si
     hay un cambio sin enviar, ese es el bueno y lo remoto no debe pisarlo. */
  function configPendiente() {
    return estaPendiente("sistema", "config") ? configActual() : null;
  }

  function bitacoraPendiente() {
    return estaPendiente("sistema", "bitacora") ? copiar(load().bitacora) : null;
  }

  /* Envía lo acumulado. Si vuelve a fallar, lo deja en la cola y se
     reintentará: nada se descarta por no haber podido salir. */
  async function vaciarCola() {
    if (!remoto || !cola.length) return;
    const lote = cola.slice();

    for (let i = 0; i < lote.length; i += 1) {
      const it = lote[i];
      try {
        if (it.tipo === "sistema") {
          await remoto.doc("sistema/" + it.id).set(it.id === "config"
            ? configActual() : { entradas: load().bitacora });
        } else if (it.tipo === "delete") {
          await remoto.collection(it.coleccion).doc(it.id).delete();
        } else {
          const reg = get(it.coleccion, it.id);
          /* Si el registro ya no existe localmente no hay nada que enviar:
             se saca de la cola en vez de reintentarlo para siempre. */
          if (reg) await remoto.collection(it.coleccion).doc(it.id).set(reg);
        }
        cola = cola.filter(function (x) {
          return !(x.coleccion === it.coleccion && x.id === it.id);
        });
        guardarCola();
      } catch (e) {
        break;                         // sigue sin señal: se reintenta luego
      }
    }
  }

  /* Reintentos: cuando el sistema avisa de que volvió la red, y cada tanto
     por si el aviso no llega (pasa en móviles). */
  function vigilarRed() {
    if (typeof window === "undefined") return;
    window.addEventListener("online", function () { vaciarCola(); });
    setInterval(function () { if (cola.length) vaciarCola(); }, 20000);
  }

  function esCompartido() { return modo === "compartido"; }
  function modoActual() { return modo; }

  async function conectar(alCambiar) {
    if (typeof window === "undefined" || !window.claude ||
        typeof window.claude.use !== "function") return modo;

    let almacen;
    try { almacen = await window.claude.use("db"); }
    catch (e) { return modo; }
    if (!almacen) return modo;

    remoto = almacen;

    try {
      const meta = await remoto.doc("sistema/meta").get();
      const esquemaRemoto = meta.exists ? (meta.data().esquema || 0) : 0;

      if (esquemaRemoto !== ESQUEMA) {
        /* El modelo cambió o el almacén está vacío: se vuelve a sembrar.
           Pero lo que la persona registró sin señal NO es descartable, así
           que se aparta y se vuelve a aplicar sobre la semilla nueva. */
        const sinEnviar = registrosPendientes();
        const cfgSinEnviar = configPendiente();
        const bitSinEnviar = bitacoraPendiente();
        await limpiarRemoto();
        await sembrarRemoto();

        const db = load();
        if (cfgSinEnviar) {
          CONFIG.forEach(function (k) {
            if (cfgSinEnviar[k]) db[k] = cfgSinEnviar[k];
          });
        }
        if (bitSinEnviar) db.bitacora = bitSinEnviar;
        sinEnviar.forEach(function (x) {
          const lista = db[x.coleccion];
          if (!lista) return;
          const i = lista.findIndex(function (r) { return r.id === x.registro.id; });
          if (i === -1) lista.push(x.registro);
          else lista[i] = x.registro;
        });
        save();
      } else {
        const paginas = await Promise.all(
          COLECCIONES.map(function (c) { return remoto.collection(c).get(); })
        );
        const cfg = await remoto.doc("sistema/config").get();
        const bit = await remoto.doc("sistema/bitacora").get();

        /* Lo que se registró sin señal todavía no está en el almacén: se
           aparta ANTES de traer lo remoto, para volver a ponerlo después.
           Sin esto, conectarse borraría el trabajo hecho sin cobertura. */
        const sinEnviar = registrosPendientes();
        const cfgSinEnviar = configPendiente();
        const bitSinEnviar = bitacoraPendiente();

        const db = load();
        COLECCIONES.forEach(function (c, i) {
          db[c] = paginas[i].docs.map(function (d) { return copiar(d.data()); });
        });

        sinEnviar.forEach(function (x) {
          const lista = db[x.coleccion];
          const i = lista.findIndex(function (r) { return r.id === x.registro.id; });
          if (i === -1) lista.push(x.registro);
          else lista[i] = x.registro;
        });
        if (cfg.exists) {
          const datos = copiar(cfg.data());
          CONFIG.forEach(function (k) { if (datos[k]) db[k] = datos[k]; });
        }
        db.bitacora = bit.exists ? copiar(bit.data().entradas || []) : [];
        /* Lo editado sin señal se vuelve a poner encima de lo remoto y se
           guarda, porque vaciarCola() lee de aquí para enviarlo. */
        if (cfgSinEnviar) {
          CONFIG.forEach(function (k) {
            if (cfgSinEnviar[k]) db[k] = cfgSinEnviar[k];
          });
        }
        if (bitSinEnviar) db.bitacora = bitSinEnviar;
        save();
      }

      modo = "compartido";

      /* Primero se envía lo pendiente y DESPUÉS se escucha. Al revés, el
         primer snapshot llega con lo que hay en el almacén —sin lo que se
         registró sin señal— y lo borraría del cache justo antes de poder
         enviarlo. */
      await vaciarCola();
      escuchar(alCambiar);
    } catch (e) {
      remoto = null;
      console.warn("No se pudo conectar el almacén compartido:", e);
    }
    return modo;
  }

  async function limpiarRemoto() {
    const paginas = await Promise.all(
      COLECCIONES.map(function (c) { return remoto.collection(c).get(); })
    );
    await Promise.all(paginas.reduce(function (acc, pagina, i) {
      pagina.docs.forEach(function (d) {
        acc.push(remoto.collection(COLECCIONES[i]).doc(d.id).delete());
      });
      return acc;
    }, []));
  }

  async function sembrarRemoto() {
    const datos = semilla(16);
    cache = datos;

    const escrituras = [];
    COLECCIONES.forEach(function (c) {
      (datos[c] || []).forEach(function (reg) {
        escrituras.push(remoto.collection(c).doc(reg.id).set(reg));
      });
    });
    escrituras.push(remoto.doc("sistema/config").set(configActual()));
    escrituras.push(remoto.doc("sistema/bitacora").set({ entradas: [] }));
    escrituras.push(remoto.doc("sistema/meta").set({ esquema: ESQUEMA, sembradoEn: new Date().toISOString() }));
    await Promise.all(escrituras);
  }

  function configActual() {
    const db = load();
    const out = {};
    CONFIG.forEach(function (k) { out[k] = db[k]; });
    return out;
  }

  function escuchar(alCambiar) {
    COLECCIONES.forEach(function (c) {
      suscripciones.push(remoto.collection(c).onSnapshot(function (snap) {
        load()[c] = snap.docs.map(function (d) { return copiar(d.data()); });
        if (alCambiar) alCambiar(c);
      }, function (err) { console.warn("Suscripción interrumpida en " + c + ":", err.code); }));
    });

    suscripciones.push(remoto.doc("sistema/config").onSnapshot(function (snap) {
      if (!snap.exists) return;
      /* Si aún hay un cambio local sin enviar, lo remoto está atrasado. */
      if (estaPendiente("sistema", "config")) return;
      const datos = copiar(snap.data());
      const db = load();
      CONFIG.forEach(function (k) { if (datos[k]) db[k] = datos[k]; });
      if (alCambiar) alCambiar("config");
    }, function (err) { console.warn("Suscripción interrumpida en config:", err.code); }));

    suscripciones.push(remoto.doc("sistema/bitacora").onSnapshot(function (snap) {
      if (estaPendiente("sistema", "bitacora")) return;
      load().bitacora = snap.exists ? copiar(snap.data().entradas || []) : [];
      if (alCambiar) alCambiar("bitacora");
    }, function (err) { console.warn("Suscripción interrumpida en bitácora:", err.code); }));
  }

  function empujar(coleccion, registro) {
    if (CONFIG.indexOf(coleccion) !== -1) { empujarConfig(); return; }
    if (!remoto) { encolar("set", coleccion, registro.id); return; }
    remoto.collection(coleccion).doc(registro.id).set(registro).catch(function (e) {
      encolar("set", coleccion, registro.id);
      avisarFallo(e);
    });
  }

  function empujarBorrado(coleccion, id) {
    if (!remoto) { encolar("delete", coleccion, id); return; }
    remoto.collection(coleccion).doc(id).delete().catch(function (e) {
      encolar("delete", coleccion, id);
      avisarFallo(e);
    });
  }

  /* Los documentos de sistema se encolan igual que los registros: un cambio
     de catálogo hecho sin señal se perdía en silencio. */
  function empujarConfig() {
    if (!remoto) { encolar("sistema", "sistema", "config"); return; }
    remoto.doc("sistema/config").set(configActual()).catch(function (e) {
      encolar("sistema", "sistema", "config");
      avisarFallo(e);
    });
  }

  function empujarBitacora(entradas) {
    if (!remoto) { encolar("sistema", "sistema", "bitacora"); return; }
    remoto.doc("sistema/bitacora").set({ entradas: entradas }).catch(function (e) {
      encolar("sistema", "sistema", "bitacora");
      avisarFallo(e);
    });
  }

  let alFallar = null;
  function alFallarEscritura(fn) { alFallar = fn; }
  function avisarFallo(e) {
    const codigo = e && e.code ? e.code : "desconocido";
    console.warn("Escritura rechazada por el almacén:", codigo, e);
    if (alFallar) alFallar(codigo);
  }

  /* ------------------------------------------------------- persistencia */

  let cache = null;

  function load() {
    if (cache) return cache;
    cargarCola();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const datos = JSON.parse(raw);
        if (datos && datos.esquema === ESQUEMA) { cache = datos; return cache; }
      }
    } catch (e) {
      console.warn("No se pudo leer el almacenamiento local:", e);
    }
    cache = semilla();
    save();
    return cache;
  }

  function save() {
    if (esCompartido()) return;
    try { localStorage.setItem(KEY, JSON.stringify(cache)); }
    catch (e) { console.warn("No se pudo guardar en el almacenamiento local:", e); }
  }

  function reset() {
    cola = [];
    guardarCola();
    if (esCompartido()) {
      return limpiarRemoto().then(sembrarRemoto).then(function () { return cache; });
    }
    cache = semilla();
    save();
    return Promise.resolve(cache);
  }

  function importar(json) {
    const datos = typeof json === "string" ? JSON.parse(json) : json;
    if (!datos || !Array.isArray(datos.lotes)) {
      throw new Error("El archivo no tiene la estructura esperada.");
    }
    cache = datos;
    save();
    if (esCompartido()) { empujarConfig(); }
    return cache;
  }

  function exportar() { return JSON.stringify(load(), null, 2); }

  /* --------------------------------------------------------------- CRUD */

  function all(coleccion) { return load()[coleccion] || []; }

  function get(coleccion, id) {
    return all(coleccion).find(function (x) { return x.id === id; }) || null;
  }

  function insert(coleccion, registro) {
    const db = load();
    if (!registro.id) registro.id = uid(coleccion.slice(0, 2));
    registro = copiar(registro);
    db[coleccion].push(registro);
    save();
    empujar(coleccion, registro);
    return registro;
  }

  function update(coleccion, id, cambios) {
    const db = load();
    const i = db[coleccion].findIndex(function (x) { return x.id === id; });
    if (i === -1) return null;
    db[coleccion][i] = Object.assign({}, db[coleccion][i], cambios);
    save();
    empujar(coleccion, db[coleccion][i]);
    return db[coleccion][i];
  }

  function remove(coleccion, id) {
    const db = load();
    const i = db[coleccion].findIndex(function (x) { return x.id === id; });
    if (i === -1) return false;
    db[coleccion].splice(i, 1);
    save();
    empujarBorrado(coleccion, id);
    return true;
  }

  function parametros() { return load().parametros; }

  function guardarParametros(cambios) {
    const db = load();
    db.parametros = Object.assign({}, copiar(db.parametros), cambios);
    save();
    empujarConfig();
    return db.parametros;
  }

  function siguienteFolio(coleccion, prefijo) {
    const nums = all(coleccion)
      .map(function (x) { return parseInt(String(x.folio || "").split("-")[1], 10); })
      .filter(function (n) { return !isNaN(n); });
    const max = nums.length ? Math.max.apply(null, nums) : 0;
    return prefijo + "-" + String(max + 1).padStart(4, "0");
  }

  function causa(id) { return get("causas", id); }
  function destino(id) { return get("destinos", id); }
  function linea(id) { return get("lineas", id); }

  function registrarBitacora(usuarioId, accion, detalle) {
    const db = load();
    db.bitacora = [{
      id: uid("bt"),
      fecha: new Date().toISOString(),
      usuarioId: usuarioId,
      accion: accion,
      detalle: detalle
    }].concat(db.bitacora).slice(0, 200);
    save();
    empujarBitacora(db.bitacora);
  }

  return {
    EMPRESA: EMPRESA,
    PESO_GAVETA_KG: PESO_GAVETA_KG,
    tiempoEstandarAct: tiempoEstandarAct,
    cajasPorGaveta: cajasPorGaveta,
    actividadesDe: actividadesDe,
    cicloGavetaMin: cicloGavetaMin,
    contenidoGavetaMin: contenidoGavetaMin,
    ORIGENES: ORIGENES,
    ESTADOS: ESTADOS,
    CALIDADES: CALIDADES,
    ROLES: ROLES,
    TURNOS: TURNOS,
    ESQUEMA: ESQUEMA,
    hoy: hoy,
    diasAtras: diasAtras,
    sumarDias: sumarDias,
    uid: uid,
    load: load,
    save: save,
    reset: reset,
    importar: importar,
    exportar: exportar,
    all: all,
    get: get,
    insert: insert,
    update: update,
    remove: remove,
    parametros: parametros,
    guardarParametros: guardarParametros,
    siguienteFolio: siguienteFolio,
    causa: causa,
    destino: destino,
    linea: linea,
    sembrarCredenciales: sembrarCredenciales,
    cuentasDemo: cuentasDemo,
    buscarPorAcceso: buscarPorAcceso,
    comprobarActivacion: comprobarActivacion,
    accesoLibre: accesoLibre,
    registrarBitacora: registrarBitacora,
    conectar: conectar,
    pendientes: pendientes,
    estaPendiente: estaPendiente,
    vaciarCola: vaciarCola,
    vigilarRed: vigilarRed,
    alCambiarCola: function (fn) { alCambiarCola = fn; },
    esCompartido: esCompartido,
    modoActual: modoActual,
    alFallarEscritura: alFallarEscritura
  };
})();
