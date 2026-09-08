# AgroRegistro — Sistema de registro y control de producción frutícola

Aplicación web que centraliza en **un solo repositorio de información** los datos que
hoy la empresa maneja dispersos: lo que cada **proveedor** anuncia, lo que **recepción**
pesa en la báscula, lo que el **salón de producción** procesa, y los **indicadores** y
**reportes** que **supervisión** usa para cerrar cada lote.

Prototipo desarrollado como parte del proyecto de tesis.

---

## 1. Problema que resuelve

| Situación actual | Con la aplicación |
|---|---|
| El proveedor avisa por teléfono o WhatsApp | Anuncia el envío en el sistema y queda con folio, lote y fecha |
| Nadie contrasta lo declarado con lo que llega | Recepción pesa en báscula y el sistema calcula la **diferencia de peso** |
| Producción anota en cuadernos o Excel suelto | Cada lote procesado se registra contra la recepción que lo originó |
| La merma es un número suelto | Se reparte **por causa**, y cada causa dice si el problema es del campo, del transporte o de la planta |
| No se sabe el rendimiento real por fruta ni proveedor | La tasa de exportable se calcula sola y se compara contra la meta técnica |
| Los reportes se arman a mano cada mes | Se generan al instante, con filtros, y se exportan a Excel o PDF |
| No hay trazabilidad de quién registró qué | Ficha de lote con línea de tiempo + bitácora con usuario, acción y hora |

## 2. Los cuatro roles

| Rol | Qué hace |
|---|---|
| 🚜 **Proveedor** | Anuncia los envíos de fruta y recibe el reporte de cada lote |
| ⚖️ **Recepción** | Confirma y pesa la fruta que llega a planta |
| 🏭 **Producción** | Registra lo procesado, lo exportable y las mermas con su causa |
| 📋 **Supervisión** | Cierra lotes, envía reportes y ve los indicadores |

Supervisión es el único rol transversal: además de cerrar el ciclo, administra el padrón
de proveedores, los usuarios, la bitácora y los respaldos.

El aislamiento del proveedor se aplica en la **capa de datos** (`filtrosEfectivos()` en
`app.js`), no en la interfaz: aunque manipule el formulario de filtros, un usuario con rol
Proveedor no obtiene lotes de otro proveedor.

## 3. Ciclo de vida del lote

Cada estado lo abre un rol distinto, de modo que el sistema refleja el recorrido físico de
la fruta por la planta en lugar de dejar todos los campos abiertos siempre.

```
   PROVEEDOR          RECEPCIÓN          PRODUCCIÓN         SUPERVISIÓN
       │                  │                   │                   │
   ┌───▼────┐        ┌────▼─────┐       ┌─────▼─────┐       ┌─────▼─────┐
   │Anunciado│──────▶│ Recibido │──────▶│ Procesado │──────▶│  Cerrado  │
   └────────┘        └────┬─────┘       └───────────┘       └───────────┘
   folio, lote,           │             kg procesados,      ya no admite
   kg anunciados,         │             kg exportables,     cambios; se
   calidad declarada,     │             mermas por causa    envía el reporte
   precio acordado        │                                 al proveedor
                     ┌────▼──────┐
                     │ Rechazado │  la fruta no cumplió los mínimos
                     └───────────┘
```

**Reglas de negocio que el sistema hace cumplir:**

- Solo se puede pesar un lote que esté *Anunciado*.
- La fecha de llegada no puede ser anterior a la del envío ni futura.
- Solo se puede procesar un lote *Recibido*; los kg procesados nunca superan los pesados.
- Lo exportable nunca supera lo procesado.
- **Balance de materia:** la suma de las mermas por causa debe cuadrar con
  `procesado − exportable` (tolerancia de 0,5 % o 1 kg). No se puede guardar sin cuadrar.
- No se admiten dos filas con la misma causa de merma.
- Un lote *Cerrado* no admite cambios de ningún rol. Supervisión puede reabrirlo, y la
  reapertura queda registrada en la bitácora.

## 4. Parámetros que registra el sistema

### Proveedor
`código` · `razón social` · `RUC/documento` · `contacto` · `teléfono` · `correo` ·
`zona/provincia` · `activo` · `fecha de alta`

### Lote — anuncio (lo llena el proveedor)
`folio` · `código de lote` · `fecha de envío` · `proveedor` · `fruta` ·
`kg anunciados` · `calidad declarada` · `precio acordado por kg` · `transporte` ·
`observaciones` · `usuario que anunció`

### Lote — recepción (lo llena recepción)
`fecha de llegada` · **`kg pesados en báscula`** · `calidad verificada en planta` ·
`observaciones de recepción` · `usuario que pesó`

> La calidad verificada puede ser peor que la declarada; la tabla lo marca con `↓`.

### Producción (lo llena el salón)
`folio` · `fecha` · `lote de origen` · `producto obtenido` · `turno` ·
`kg ingresados a proceso` · **`kg exportables`** · **`mermas: [{causa, kg}]`** ·
`horas-hombre` · `responsable de línea` · `observaciones` · `usuario que registró`

### Cierre (lo hace supervisión)
`fecha de cierre` · `usuario que cerró` · `reporte enviado` · `fecha del reporte`

### Catálogos
- **Frutas**: nombre, unidad, `meta de exportable` (parámetro técnico contra el que se mide
  el desempeño real), precio de referencia.
- **Productos**: empaque en fresco, pulpa congelada, trozo IQF, fruta deshidratada.
- **Calidades**: A (factor 1,00), B (0,88), C (0,74) — el factor ajusta el exportable
  esperado según la calidad de la materia prima.
- **Causas de merma**, clasificadas por origen:

  | Origen | Causas |
  |---|---|
  | **Campo** | Maduración excesiva · Plaga o enfermedad · Calibre fuera de norma |
  | **Transporte** | Daño mecánico / golpes · Deterioro en transporte |
  | **Proceso** | Pérdida de pelado y corte · Deshidratación · Pérdida por paro de línea · Otras |

  Clasificarlas así permite responder la pregunta que importa: **¿de quién es el problema?**

## 5. Indicadores y sus fórmulas

Implementados en `assets/js/indicadores.js`.

| Indicador | Fórmula | Para qué sirve |
|---|---|---|
| Fruta recibida | `Σ kg pesados` | Volumen real de abastecimiento |
| **Diferencia de peso** | `(Σ pesado − Σ anunciado) ÷ Σ anunciado` | Fiabilidad de lo que declara el proveedor |
| Exactitud de peso | `1 − \|diferencia\| ÷ anunciado` | Ranking de proveedores por exactitud |
| Fruta procesada | `Σ kg procesados` | Carga real de la planta |
| Producto exportable | `Σ kg exportables` | Salida vendible |
| **Tasa de exportable** | `kg exportables ÷ kg procesados` | Eficiencia de transformación (el KPI comercial) |
| **Meta ponderada** | `Σ (meta_fruta × kg procesados) ÷ Σ kg procesados` | Meta ajustada a la mezcla realmente procesada |
| Cumplimiento de meta | `tasa exportable ÷ meta ponderada` | Semáforo de desempeño |
| **Merma** | `Σ mermas ÷ kg procesados` | Pérdida en proceso |
| Merma por causa | `Σ kg de cada causa`, ordenado + % acumulado | Pareto: qué atacar primero |
| Tasa de rechazo | `lotes rechazados ÷ lotes` | Calidad del abastecimiento |
| Tasa de procesamiento | `kg procesados ÷ kg recibidos` | Cuánto de lo recibido ya se procesó |
| Valor de compra | `Σ (kg pesados × precio)` | Desembolso a proveedores — se liquida sobre el peso **real** |
| Costo por kg exportable | `valor compra ÷ kg exportables` | Costo unitario de lo que sí se vende |
| Productividad | `kg procesados ÷ horas-hombre` | Eficiencia de la mano de obra |
| **Ciclo del lote** | `promedio(fecha cierre − fecha anuncio)` | Cuánto tarda el proceso completo |
| Brecha por fruta | `tasa exportable − meta` | Dónde se pierde producto |

Dos decisiones de cálculo que conviene poder defender:

- **La meta es ponderada, no un promedio simple.** Si en el período se procesó mucho
  maracuyá (meta 45 %) y poco aguacate (meta 72 %), la meta del período debe parecerse a la
  del maracuyá. Un promedio simple castigaría injustamente a la planta.
- **La diferencia de peso solo considera lotes efectivamente pesados.** Un lote aún en
  tránsito no tiene diferencia que medir, e incluirlo ensuciaría el indicador.

## 6. Reportes

Cinco reportes, todos con filtro por rango de fechas, proveedor, fruta, calidad y estado:

1. **Consolidado por proveedor** — lotes, kg anunciados vs. pesados, diferencia de peso,
   % calidad A, % rechazo, precio promedio, **valor a liquidar** y tasa de exportable
   obtenida. Es el documento que sustenta el pago.
2. **Rendimiento por fruta** — tasa real contra meta, con la brecha.
3. **Análisis de mermas (Pareto)** — kg y % por causa, con % acumulado y gráfico.
4. **Detalle de lotes** — trazabilidad línea por línea.
5. **Detalle de producción** — línea por línea del salón.

Además, cada lote tiene su **ficha de trazabilidad**: línea de tiempo con los cuatro hitos
(quién y cuándo), peso y calidad, resultado del proceso y desglose de la merma. Esa misma
ficha es lo que recibe el proveedor al cerrarse el lote, y se puede imprimir por separado.

Todo se **exporta a CSV** (separador `;` y BOM UTF-8, para que Excel en español lo abra
correctamente) o se **imprime a PDF** con la hoja de estilos de impresión.

## 7. Estructura del código

```
app/
├── index.html                  Contenedor; la interfaz se dibuja desde JS
├── README.md                   Este documento
└── assets/
    ├── css/app.css             Tema por tokens (claro/oscuro), responsive e impresión
    └── js/
        ├── db.js               Persistencia, CRUD, catálogos, bitácora y datos de demo
        ├── indicadores.js      Filtrado y cálculo de todos los indicadores
        ├── graficos.js         Gráficos SVG hechos a mano (líneas, barras, dona, Pareto)
        └── app.js              Sesión, permisos, ciclo del lote, formularios y reportes
```

Sin dependencias, sin build, sin conexión a internet: se abre y funciona.

## 8. Cómo ejecutarla

```bash
# Desde la raíz del repositorio
python3 -m http.server 8000
# Abrir http://localhost:8000/app/
```

También funciona abriendo `app/index.html` directamente en el navegador.

Para probar el flujo completo, entra sucesivamente como:
`Marta Cedeño` (proveedor) → `Diego Andrade` (recepción) → `Carlos Mendoza` (producción)
→ `Ing. Andrea Quiroz` (supervisión). La pantalla de acceso los ofrece con un clic.

## 9. Dónde se guardan los datos

Esta versión persiste todo en el **`localStorage` del navegador**, bajo la clave
`agroreg.db.v2`. Eso significa:

- Los datos sobreviven al cerrar el navegador, **en ese mismo equipo**.
- **No se comparten entre computadoras** — cada máquina tiene su propia copia.
- Desde *Datos del sistema* se puede **exportar todo a un archivo JSON** (útil como anexo
  de la tesis o como respaldo) y **restaurarlo** en otro equipo.

Es adecuado para la demostración y la defensa del trabajo. Para el uso real en la empresa
—con recepción, producción y supervisión trabajando a la vez— hace falta un backend.

## 10. Migrar a un backend real

Todo el acceso a datos pasa por `db.js`. La migración se concentra ahí:

```js
// Hoy — db.js
function load()  { return JSON.parse(localStorage.getItem(KEY)); }
function save()  { localStorage.setItem(KEY, JSON.stringify(cache)); }

// Con backend — mismas firmas, pero asíncronas
async function insert(coleccion, registro) {
  const res = await fetch(`/api/${coleccion}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify(registro)
  });
  return res.json();
}
```

Las vistas de `app.js` tendrían que pasar a `async/await` donde hoy llaman a `DB.*` de
forma síncrona.

Modelo relacional sugerido:

```sql
proveedores  (id, codigo, nombre, documento, contacto, telefono, email, zona,
              activo, fecha_alta)
usuarios     (id, nombre, clave_hash, rol, proveedor_id FK, activo, fecha_alta)
frutas       (id, nombre, unidad, meta_exportable, precio_ref)
productos    (id, nombre)
causas_merma (id, nombre, tipo)                      -- Campo | Transporte | Proceso

lotes        (id, folio, codigo_lote, fecha, proveedor_id FK, fruta_id FK,
              cantidad_anunciada_kg, calidad_declarada, precio_unitario, transporte,
              observaciones_proveedor, anunciado_por FK, creado_en,
              fecha_recepcion, cantidad_recibida_kg, calidad_verificada,
              observaciones_recepcion, recibido_por FK,
              estado, fecha_cierre, cerrado_por FK, reporte_enviado, fecha_reporte)

producciones (id, folio, fecha, lote_id FK, producto_id FK, turno,
              kg_procesados, kg_exportable, horas_hombre, operador,
              observaciones, registrado_por FK, creado_en)

merma_detalle(id, produccion_id FK, causa_id FK, kg)  -- 1:N con producciones
bitacora     (id, fecha, usuario_id FK, accion, detalle)
```

Nota: en el prototipo las mermas viven como arreglo dentro de `producciones`; en SQL
corresponden a la tabla `merma_detalle`. La restricción del balance de materia
(`Σ merma_detalle.kg = kg_procesados − kg_exportable`) debe replicarse en el servidor:
la validación del navegador no basta.

## 11. Limitaciones conocidas

Declararlas explícitamente es parte del trabajo académico:

1. **No hay autenticación.** Se entra eligiendo un rol y escribiendo un nombre, sin
   contraseña. Es cómodo para el uso en planta —donde la gente comparte terminales y
   escribir contraseñas con guantes es inviable— pero significa que **cualquiera puede
   declararse de cualquier rol**. Para un despliegue real hace falta autenticación en el
   servidor (usuario y contraseña con hash bcrypt/Argon2, o credencial corporativa) y que
   los permisos se verifiquen en el backend, no solo en el navegador.
2. **Los permisos por rol se aplican en el cliente.** Sirven para guiar el proceso, no para
   contener a un usuario malintencionado.
3. **Datos locales por equipo.** Ver sección 9. Hoy los cuatro roles no pueden trabajar
   simultáneamente desde máquinas distintas.
4. **Sin concurrencia ni bloqueo de registros.** Dos personas podrían pesar el mismo lote
   si compartieran datos.
5. **Los datos de demostración son simulados**, generados con un algoritmo de semilla fija
   para que las capturas del documento de tesis sean reproducibles. Incluyen sesgos de peso
   distintos por proveedor y repartos de merma coherentes con la calidad y el transporte,
   pero **deben reemplazarse por datos reales de la empresa** antes de sacar cualquier
   conclusión.

## 12. Accesibilidad

Enlace de salto al contenido, foco visible, `aria-live` en los avisos, `role="dialog"` con
cierre por `Escape` en los formularios, etiquetas asociadas a cada campo, errores anunciados
con `role="alert"`, selector de rol con radios ocultos a la vista pero accesibles por
teclado y lector de pantalla, menú móvil con `aria-expanded`, y respeto a
`prefers-reduced-motion` y al tema oscuro del sistema.

## 13. Pruebas

`app/` no tiene framework de pruebas, pero el flujo completo se validó en Chromium con
Playwright: 28 comprobaciones que cubren el acceso por rol, el aislamiento del proveedor,
el anuncio de un envío, el pesaje con cálculo de diferencia, el balance de materia de la
merma (incluidos los casos que deben fallar), el cierre del lote, la bitácora, los cinco
reportes, la exportación CSV, la persistencia tras recargar y el diseño móvil a 390 px.
