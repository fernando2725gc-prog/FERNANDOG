# AgroRegistro — Sistema de registro y control de producción frutícola

Aplicación web que centraliza en **un solo repositorio de información** los datos que
hoy la empresa maneja dispersos: lo que cada **proveedor** envía, lo que el **salón de
producción** procesa, y los **indicadores** y **reportes** que se derivan de ambos.

Prototipo desarrollado como parte del proyecto de tesis.

---

## 1. Problema que resuelve

| Situación actual | Con la aplicación |
|---|---|
| Cada proveedor reporta por teléfono, WhatsApp o papel | El proveedor registra su envío en el sistema y queda con folio y fecha |
| Producción anota en cuadernos o en hojas de Excel sueltas | Cada lote procesado se registra contra la recepción que lo originó |
| No se sabe el rendimiento real por fruta ni por proveedor | El rendimiento se calcula solo, y se compara contra la meta técnica |
| Los reportes se arman a mano cada mes | Se generan al instante, con filtros, y se exportan a Excel o PDF |
| No hay trazabilidad de quién registró qué | Bitácora con usuario, acción, fecha y hora |

## 2. Roles y permisos

| Rol | Qué puede hacer |
|---|---|
| **Administrador** | Todo: proveedores, usuarios, recepciones, producción, reportes, bitácora y respaldos |
| **Proveedor** | Registrar sus envíos y ver **únicamente sus propios** datos, indicadores y reportes |
| **Salón de producción** | Confirmar la recepción física de los lotes y registrar la producción de cada uno |

El aislamiento del proveedor se aplica en la capa de datos (`filtrosEfectivos()` en
`app.js`), no en la interfaz: aunque manipule el formulario de filtros, un usuario con
rol Proveedor no obtiene registros de otro proveedor.

### Cuentas de demostración

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `admin123` | Administrador |
| `proveedor` | `prov123` | Proveedor (Finca La Esperanza) |
| `produccion` | `prod123` | Salón de producción |

## 3. Flujo del proceso

```
  PROVEEDOR              PRODUCCIÓN                SISTEMA
      │                       │                       │
      ├─ Registra envío ──────┼──────────────────────►│ Recepción "Pendiente"
      │  (fruta, kg, calidad, │                       │  folio REC-0001 + lote
      │   precio acordado)    │                       │
      │                       ├─ Confirma recepción ─►│ Recepción "Recibido"
      │                       │                       │
      │                       ├─ Registra producción ►│ Producción PRD-0001
      │                       │  (kg procesados,      │  rendimiento = final/procesado
      │                       │   kg terminados)      │
      │                       │                       │
      │◄──── Reporte de liquidación ──────────────────┤ Indicadores + reportes
```

Regla de negocio: **solo se puede registrar producción sobre una recepción confirmada
que no haya sido procesada antes**, y los kilogramos procesados nunca pueden superar
los recibidos. El sistema lo valida al guardar.

## 4. Parámetros que registra el sistema

### Proveedor
`código` · `razón social` · `RUC/documento` · `persona de contacto` · `teléfono` ·
`correo` · `zona/provincia` · `estado (activo/inactivo)` · `fecha de alta`

### Recepción de fruta (lo que envía el proveedor)
`folio` · `fecha` · `proveedor` · `fruta` · `lote` · `cantidad en kg` ·
`calidad (A/B/C)` · `precio acordado por kg` · `transporte` · `estado` ·
`observaciones` · `usuario que registró`

### Producción (lo que procesa el salón)
`folio` · `fecha` · `lote de origen` · `fruta` · `producto obtenido` · `turno` ·
`kg ingresados a proceso` · `kg de producto terminado` · `horas-hombre` ·
`responsable de línea` · `observaciones` · `usuario que registró`

### Catálogos
- **Frutas**: nombre, unidad, `rendimiento meta` (parámetro técnico contra el que se
  mide el desempeño real), precio de referencia.
- **Productos**: pulpa congelada, deshidratado, trozo IQF, empaque en fresco.
- **Calidades**: A (factor 1.00), B (0.85), C (0.70) — el factor ajusta el rendimiento
  esperado según la calidad de la materia prima.

## 5. Indicadores y sus fórmulas

Implementados en `assets/js/indicadores.js`.

| Indicador | Fórmula | Para qué sirve |
|---|---|---|
| Fruta recibida | `Σ cantidadKg` | Volumen de abastecimiento del período |
| Fruta procesada | `Σ kgProcesados` | Carga real de la planta |
| Producto terminado | `Σ kgProductoFinal` | Salida vendible |
| **Rendimiento** | `kgProductoFinal ÷ kgProcesados` | Eficiencia de transformación |
| **Meta ponderada** | `Σ (metaFruta × kgProcesados) ÷ Σ kgProcesados` | Meta ajustada a la mezcla realmente procesada |
| Cumplimiento de meta | `rendimiento ÷ meta ponderada` | Semáforo de desempeño |
| **Merma** | `(kgProcesados − kgProductoFinal) ÷ kgProcesados` | Pérdida en proceso |
| Tasa de procesamiento | `kgProcesados ÷ kgRecibidos` | Cuánto de lo recibido ya se procesó |
| Valor de compra | `Σ (cantidadKg × precioUnitario)` | Desembolso a proveedores |
| Costo por kg terminado | `valorCompra ÷ kgProductoFinal` | Costo unitario de materia prima |
| Productividad | `kgProcesados ÷ horasHombre` | Eficiencia de la mano de obra |
| % Calidad A por proveedor | `kgCalidadA ÷ kgRecibidos` | Calidad del abastecimiento |
| Brecha por fruta | `rendimiento real − meta` | Dónde se pierde producto |

La **meta ponderada** es deliberadamente ponderada y no un promedio simple: si en el
período se procesó mucho maracuyá (meta 45 %) y poco aguacate (meta 72 %), la meta del
período debe parecerse a la del maracuyá. Un promedio simple castigaría injustamente
a la planta.

## 6. Reportes

Cuatro reportes, todos con filtro por rango de fechas, proveedor, fruta y calidad:

1. **Consolidado por proveedor** — envíos, kg, % calidad A, precio promedio, valor a
   liquidar y rendimiento obtenido. Es el documento que se entrega al proveedor para
   el pago.
2. **Rendimiento por fruta** — real contra meta, con la brecha.
3. **Detalle de recepciones** — línea por línea.
4. **Detalle de producción** — línea por línea.

Cada uno se **exporta a CSV** (separador `;` y BOM UTF-8, para que Excel en español lo
abra correctamente) o se **imprime a PDF** con la hoja de estilos de impresión, que
oculta menú, filtros y botones.

## 7. Estructura del código

```
app/
├── index.html                  Contenedor; la interfaz se dibuja desde JS
├── README.md                   Este documento
└── assets/
    ├── css/app.css             Tema por tokens (claro/oscuro), responsive e impresión
    └── js/
        ├── db.js               Persistencia, CRUD, folios, bitácora y datos de demo
        ├── indicadores.js      Filtrado y cálculo de todos los indicadores
        ├── graficos.js         Gráficos SVG generados a mano (sin librerías)
        └── app.js              Sesión, permisos, navegación, formularios y reportes
```

Sin dependencias, sin build, sin conexión a internet: se abre y funciona.

## 8. Cómo ejecutarla

```bash
# Desde la raíz del repositorio
python3 -m http.server 8000
# Abrir http://localhost:8000/app/
```

También funciona abriendo `app/index.html` directamente en el navegador.

## 9. Dónde se guardan los datos

Esta versión persiste todo en el **`localStorage` del navegador**, bajo la clave
`agroreg.db.v1`. Eso significa:

- Los datos sobreviven al cerrar el navegador, **en ese mismo equipo**.
- **No se comparten entre computadoras** — cada máquina tiene su propia copia.
- Desde *Datos del sistema* se puede **exportar todo a un archivo JSON** (útil como
  anexo de la tesis o como respaldo) y **restaurarlo** en otro equipo.

Es adecuado para la demostración y la defensa del trabajo. Para el uso real en la
empresa hace falta un backend.

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

Las vistas de `app.js` tendrían que pasar a `async/await` en los puntos donde hoy
llaman a `DB.*` de forma síncrona.

Modelo relacional sugerido:

```sql
proveedores  (id, codigo, nombre, documento, contacto, telefono, email, zona, activo, fecha_alta)
usuarios     (id, nombre, usuario, clave_hash, rol, proveedor_id FK, activo)
frutas       (id, nombre, unidad, rendimiento_meta, precio_ref)
productos    (id, nombre)
recepciones  (id, folio, fecha, proveedor_id FK, fruta_id FK, lote, cantidad_kg,
              calidad, precio_unitario, transporte, estado, observaciones,
              registrado_por FK, creado_en)
producciones (id, folio, fecha, recepcion_id FK, fruta_id FK, producto_id FK, turno,
              kg_procesados, kg_producto_final, horas_hombre, operador,
              observaciones, registrado_por FK, creado_en)
bitacora     (id, fecha, usuario_id FK, accion, detalle)
```

## 11. Limitaciones conocidas

Declararlas explícitamente es parte del trabajo académico:

1. **Contraseñas sin cifrar.** Se guardan en texto plano en el navegador porque no hay
   servidor. En producción deben vivir en el backend con hash (bcrypt o Argon2). La
   propia aplicación muestra esta advertencia en la pantalla de Usuarios.
2. **Sin autenticación real.** No hay tokens ni sesiones de servidor; la sesión se
   guarda en `sessionStorage`. Los permisos por rol se aplican en el cliente, lo que
   basta para el prototipo pero no para un despliegue real.
3. **Datos locales por equipo.** Ver sección 9.
4. **Sin concurrencia.** Dos usuarios en máquinas distintas no ven los mismos datos.
5. **Los datos de demostración son simulados**, generados con un algoritmo de semilla
   fija para que las capturas del documento de tesis sean reproducibles. Deben
   reemplazarse por datos reales de la empresa antes de cualquier conclusión.

## 12. Accesibilidad

Enlace de salto al contenido, foco visible, `aria-live` en los avisos, `role="dialog"`
con cierre por `Escape` en los formularios, etiquetas asociadas a cada campo, errores
anunciados con `role="alert"`, y respeto a `prefers-reduced-motion` y al tema oscuro
del sistema.
