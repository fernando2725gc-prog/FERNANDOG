# Sistema FLP — dos aplicaciones conectadas

Sistema de trazabilidad, control de pérdidas y economía circular para
**F.L.P. Latinoamerican Perishables del Ecuador S.A.**, sobre las tres líneas del
alcance del TIC: **pitahaya roja, tomate de árbol y granadilla**.

Unidad de flujo estándar: **caja de 11 kg**.

---

## 1. Por qué son dos aplicaciones

El proveedor y la planta no son el mismo usuario ni tienen el mismo problema. Meterlos
en una sola aplicación obliga a esconder la mitad de la pantalla a cada uno.

| | Portal del Proveedor | Sistema de Planta |
|---|---|---|
| **Quién** | Fincas y cooperativas | Recepción, Producción, Supervisor |
| **Dónde** | Celular, en la finca | Escritorio y tablet, en planta |
| **Qué hace** | Anuncia envíos, sigue sus lotes | Pesa, procesa, planifica, cierra |
| **Qué ve** | **Solo sus propios lotes** | Todo |
| **Navegación** | Barra inferior, 3 secciones | Menú lateral, 11 secciones |

**Comparten un único repositorio de datos.** Lo que un proveedor anuncia aparece al
instante en la cola de recepción; lo que la planta registra vuelve al proveedor como
reporte de su lote. Un dato se captura una sola vez, por quien lo conoce de primera mano.

### Aislamiento entre proveedores

En el portal, **toda** lectura pasa por `misLotes()`, que filtra por el proveedor de la
sesión. No hay ninguna consulta sin ese filtro, así que un proveedor no puede ver lotes
de otro ni manipulando la interfaz.

Además, en la ficha de su lote el proveedor ve **solo las causas de merma de origen
«Campo»** — las que dependen de él. Las causas internas de planta (CR7 layout, CR8
sopleteado) no se le atribuyen ni se le muestran.

## 2. Estructura

```
app/
├── index.html              Portada: elige aplicación
├── core/                   Núcleo compartido por las dos apps
│   ├── db.js               Datos, catálogos, almacén compartido
│   ├── indicadores.js      Pérdidas, economía circular y proceso
│   ├── graficos.js         SVG a mano: líneas, barras, dona, Pareto, medidor
│   ├── ui.js               Formato, tablas, formularios, exportación
│   └── estilos.css         Sistema visual, claro/oscuro, impresión
├── proveedor/              Aplicación externa
│   ├── index.html
│   └── portal.js
└── interno/                Aplicación interna
    ├── index.html
    └── planta.js
```

Sin dependencias, sin build, sin conexión a internet.

## 3. El ciclo del lote

```
  PROVEEDOR          RECEPCIÓN         PRODUCCIÓN          SUPERVISOR
  (portal ext.)      (sistema interno) (sistema interno)   (sistema interno)
      │                    │                  │                   │
  Anunciado ──────▶   Recibido ───────▶  Procesado ──────▶    Cerrado
  cajas, línea,       cuenta cajas,      cajas exportables,  revisa y publica
  calidad             pesa en báscula,   mermas por causa    el reporte al
  declarada           verifica calidad   raíz + destino,     proveedor
                           │             tiempo real
                      Rechazado
```

**Reglas que el sistema hace cumplir:** la fecha de llegada no puede ser anterior al
envío; no se procesa más de lo recibido; lo exportable no supera lo procesado; el
**balance de masa** de las mermas debe cuadrar con `(procesado − exportable) × 11 kg`;
un lote cerrado no admite cambios.

## 4. Indicadores

Tres familias, en `core/indicadores.js`.

### Pérdidas
| Indicador | Fórmula |
|---|---|
| Diferencia al declarar | `(cajas pesadas − cajas anunciadas) ÷ anunciadas` |
| Tasa de exportable | `cajas exportables ÷ cajas procesadas` |
| Meta ponderada | `Σ (meta_línea × cajas procesadas) ÷ Σ cajas procesadas` |
| Merma | `Σ mermas ÷ kg procesados` |
| Pérdida económica | `cajas perdidas × precio promedio por caja` |
| Pareto por causa raíz | kg y valor por CR, con % acumulado |
| Índice de variabilidad | `\|dif. peso\| + tasa rechazo + brecha de rendimiento` — la **CR6** hecha número |

### Economía circular
| Indicador | Fórmula |
|---|---|
| Tasa de valorización | `kg con destino distinto de relleno ÷ kg merma` |
| Valor recuperado | `Σ (kg × valor del destino)` |
| A relleno sanitario | `kg merma − kg valorizado` |

### Proceso
| Indicador | Fórmula |
|---|---|
| Eficiencia de tiempo | `tiempo estándar ÷ tiempo real` |
| Minutos por caja | `minutos reales ÷ cajas procesadas` |
| Productividad | `cajas procesadas ÷ horas-hombre` |
| Ciclo del lote | `promedio(fecha cierre − fecha anuncio)` |

## 5. Planificación diaria

El módulo que se demuestra en la defensa. Entradas: fecha, horas de turno, operarios y
eficiencia; y las cajas comprometidas por línea.

```
minutos netos por operario = horas × 60 × (1 − suplementos OIT) × eficiencia
capacidad total            = minutos netos × operarios
tiempo requerido           = Σ (cajas × tiempo estándar de la línea)
carga                      = tiempo requerido ÷ capacidad total
takt time                  = minutos de turno ÷ cajas comprometidas
operarios necesarios       = tiempo requerido ÷ minutos netos por operario
```

Avisa si el plan no cabe en el turno, cuántos operarios faltan, y si falta materia prima
en cámara para alguna línea. El plan se guarda y se exporta a CSV.

## 6. Datos del TIC ya cargados

| Dato | Valor | Origen |
|---|---|---|
| Tiempo estándar pitahaya roja | 24,28 min/caja | **M** medido |
| Tiempo estándar tomate de árbol | 26,93 min/caja | **M** medido |
| Tiempo estándar granadilla | 29,76 min/caja | **M** medido |
| Peso de caja | 11 kg | **M** medido |
| Suplementos OIT | 13 % | **S** secundaria |
| CR5 | Mermas sin segregar | del diagnóstico |
| CR6 | Variabilidad de proveedor | del diagnóstico |
| CR7 | Layout de planta | del diagnóstico |
| CR8 | Subutilización del área de sopleteado | del diagnóstico |

### Estándar de rigor M / E / S

Cada parámetro declara su origen con una insignia junto al valor:
**M** medido en planta · **E** estimado, pendiente de confirmar · **S** fuente secundaria.
Los reportes impresos llevan la leyenda al pie.

### ⚠️ Lo que falta confirmar

- **CR1, CR2, CR3 y CR4 no están nombradas.** El documento del TIC solo nombra CR5 a CR8.
  El sistema las muestra como «Por definir» y se editan desde *Parámetros*. **No inventé
  nombres para ellas.**
- **Metas de exportable, precios por caja y valores de los destinos están marcados como
  estimados (E).** Son valores de trabajo para que el sistema calcule; hay que
  reemplazarlos por los reales de la empresa.
- Los **destinos del descarte** son una jerarquía de valorización razonable, no la de FLP.
  Edítalos en *Parámetros*.

## 7. Versión publicada

Las dos aplicaciones se publican en **una sola dirección con dos puertas**:

```
<dirección>            portada, elige aplicación
<dirección>#/proveedor Portal del Proveedor
<dirección>#/planta    Sistema de Planta
```

Comparten dirección a propósito: el almacén de datos pertenece a la página, así que
publicarlas por separado les daría dos repositorios distintos y dejarían de consolidarse.
En el repositorio siguen siendo dos aplicaciones independientes (`proveedor/` e
`interno/`) que podrían desplegarse en dominios distintos contra un backend común; por eso
cada una expone `iniciar()` en vez de arrancar sola, y los enlaces entre ellas se resuelven
con `UI.rutaOtraApp()`.

## 8. Cómo ejecutarlo

```bash
python3 -m http.server 8000
# http://localhost:8000/app/
```

Recorrido completo de la demostración:

1. **Portal** (`Marta Cedeño`) → anuncia un envío en cajas.
2. **Planta / Recepción** (`Diego Andrade`) → el lote aparece en la cola; pesa y verifica.
3. **Planta / Producción** (`Carlos Mendoza`) → registra exportable y reparte la merma por
   causa raíz y destino; el balance de masa no deja guardar si no cuadra.
4. **Planta / Supervisor** (`Ing. Andrea Quiroz`) → indicadores, planificación diaria,
   cierre del lote y publicación del reporte.
5. Vuelve al **portal**: el proveedor ya ve el resultado de su lote.

## 9. Dónde se guardan los datos

**Modo compartido** (versión publicada): las dos aplicaciones escriben en el mismo
almacén; los cambios llegan en vivo sin recargar. Un documento por lote, producción,
proveedor, usuario y plan; catálogos y parámetros en un documento de configuración;
bitácora agregada y podada a 200 movimientos.

**Modo local** (archivos abiertos directamente): `localStorage` del navegador, clave
`flp.db.v4`. Persiste en ese equipo pero no se comparte. El pie del menú indica siempre
en qué modo está.

## 10. Migrar a un backend real

Todo el acceso a datos pasa por `core/db.js`. Modelo relacional sugerido:

```sql
proveedores  (id, codigo, nombre, documento, contacto, telefono, email, zona, activo)
usuarios     (id, nombre, clave_hash, rol, proveedor_id FK, activo)
lineas       (id, codigo, nombre, tiempo_estandar_min, origen_tiempo, peso_caja_kg,
              meta_exportable, precio_caja, color, activa)
causas_raiz  (id, codigo, nombre, origen, definida, principal, descripcion)
destinos     (id, nombre, nivel, valoriza, valor_kg)

lotes        (id, folio, codigo_lote, fecha, proveedor_id FK, linea_id FK,
              cajas_anunciadas, kg_anunciados, calidad_declarada, precio_caja,
              transporte, anunciado_por FK,
              fecha_recepcion, cajas_recibidas, kg_recibidos, calidad_verificada,
              recibido_por FK, estado, fecha_cierre, cerrado_por FK, reporte_enviado)

producciones (id, folio, fecha, lote_id FK, linea_id FK, turno, cajas_procesadas,
              cajas_exportables, operarios, tiempo_real_min, operador, registrado_por FK)

merma_detalle(id, produccion_id FK, causa_id FK, destino_id FK, kg)
planes       (id, fecha, horas_turno, operarios, eficiencia, registrado_por FK)
bitacora     (id, fecha, usuario_id FK, accion, detalle)
```

La restricción del balance de masa
(`Σ merma_detalle.kg = (cajas_procesadas − cajas_exportables) × peso_caja_kg`)
debe replicarse en el servidor: la validación del navegador no basta.

## 11. Limitaciones conocidas

1. **No hay autenticación.** Se entra eligiendo rol y escribiendo un nombre. Cómodo para
   planta, pero cualquiera puede declararse de cualquier rol. Producción requiere
   autenticación en servidor con hash (bcrypt/Argon2).
2. **Los permisos se aplican en el cliente.** Guían el proceso; no contienen a un usuario
   malintencionado. El aislamiento entre proveedores está en la capa de datos, pero
   también del lado del navegador.
3. **Escrituras «gana el último».** Sin bloqueo de registros: si dos personas pesan el
   mismo lote a la vez, queda el valor del que guardó después.
4. **Los datos de demostración son simulados**, con semilla fija para que las capturas del
   documento sean reproducibles. Reemplazar por datos reales antes de concluir nada.
5. **Confidencialidad.** La empresa está bajo acuerdo de confidencialidad: cuidado con
   dónde se publica una versión que lleve su nombre y sus parámetros reales.

## 12. Pruebas

Dos suites en Chromium con Playwright. **22 comprobaciones** sobre las aplicaciones
separadas que recorren las dos
aplicaciones contra un mismo almacén compartido — portada, aislamiento del proveedor,
anuncio en cajas, pesaje con contraste de cajas y kg, propagación en vivo al celular sin
recargar, tasa y eficiencia contra el estudio de tiempos, balance de masa (incluidos los
casos que *deben* fallar), Pareto por causa raíz, planificador con takt time y detección
de sobrecarga, catálogos editables con M/E/S, cierre del lote y reporte al proveedor sin
exponerle causas internas de planta.

Y **8 comprobaciones** sobre el paquete publicado: las dos puertas, el almacén compartido
activo, un envío anunciado desde el celular apareciendo en la cola de la planta, el pesaje
llegando en vivo al portal, y la navegación entre puertas.
