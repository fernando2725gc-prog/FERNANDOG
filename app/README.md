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

## 2. Acceso y credenciales

Cada persona tiene su propia cuenta. **Las contraseñas no se guardan**: se guarda el
resultado de derivarlas con **PBKDF2-SHA256**, 150 000 iteraciones y una sal distinta por
persona, así que dos cuentas con la misma contraseña producen hashes distintos y desde el
almacén no se puede llegar a la clave. Por eso una clave olvidada se **restablece**, nunca
se consulta.

| Rol | Entra con | Política | Por qué |
|---|---|---|---|
| Proveedor | Código `PRV-00X` + **su propia** contraseña | 6+ caracteres | La crea él al activarse; nadie se la dicta |
| Recepción | Usuario + **PIN** | 4-8 dígitos | Terminal compartido, con guantes |
| Producción | Usuario + **PIN** | 4-8 dígitos | Ídem |
| Supervisor | Usuario + contraseña | 8+ caracteres | Edita parámetros y cierra lotes |

**Alta de un proveedor — sin claves que dictar.** Supervisión lo registra y el sistema
genera su **código** (`PRV-00X`). No se crea ninguna contraseña. El proveedor entra al
portal, elige *«Activa tu cuenta aquí»*, se identifica con **su código y su RUC o cédula**
—el mismo con el que lo registraron— y **crea su propia contraseña**. Nadie más la conoce
en ningún momento.

Esto elimina el paso donde estas cosas se pierden: no hay clave temporal que dictar por
teléfono, que se anote en un papel o que quede en un WhatsApp. El código no es secreto y
Supervisión puede volver a consultarlo cuando quiera, porque por sí solo no sirve para
entrar: hace falta el documento.

**Si olvida la contraseña**, Supervisión habilita la reactivación con un clic y el
proveedor vuelve a elegir una nueva por el mismo camino. Tampoco ahí se dicta nada.

Los **usuarios internos** sí reciben una clave temporal de un solo uso, porque Supervisión
se los crea en persona dentro de la planta.

**Cómo entrar sin saber nada.** La propia pantalla de acceso ofrece las cuentas de
prueba: se despliega *«¿Estás probando el sistema?»*, se pulsa una y el formulario queda
relleno. Cada cuenta se **verifica contra su credencial guardada** antes de ofrecerse, así
que en cuanto alguien cambia una clave esa cuenta desaparece de la lista sola — y en un
despliegue con usuarios reales la lista sale vacía. Rellenar no es entrar: la contraseña
viaja igual por la comprobación, y borrarla antes de pulsar Entrar deja fuera.

**Practicidad.** El portal ofrece *no cerrar sesión en este teléfono* (30 días), porque
teclear una contraseña en cada envío haría que el proveedor abandone la aplicación. El
sistema interno lo ofrece desmarcado, porque sus terminales son compartidos. Tras 5
intentos fallidos la cuenta espera un minuto.

**Lo que el sistema NO revela:** el mensaje de error es el mismo para un código que no
existe y para una contraseña equivocada. Si se distinguieran, se podría averiguar qué
códigos de proveedor existen.

## 3. Estructura

```
app/
├── index.html              Portada: elige aplicación
├── core/                   Núcleo compartido por las dos apps
│   ├── db.js               Datos, catálogos, almacén compartido
│   ├── indicadores.js      Pérdidas, economía circular, proceso, costeo y simulador
│   ├── graficos.js         SVG a mano: líneas, barras, dona, Pareto, medidor
│   ├── ui.js               Formato, tablas, formularios, exportación
│   ├── guia.js             La guía de uso, armada con los catálogos reales
│   ├── novedades.js        Campana: qué cambió desde la última vez
│   └── estilos.css         Sistema visual, claro/oscuro, impresión
├── proveedor/              Aplicación externa
│   ├── index.html
│   └── portal.js
└── interno/                Aplicación interna
    ├── index.html
    └── planta.js

│   └── pwa/                Instalación móvil: manifiesto, service worker, iconos
tools/empaquetar.js         Arma dist/ (página, manifiesto, sw e iconos)
```

Sin dependencias, sin build, sin conexión a internet.

## 4. El ciclo del lote

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

El proveedor declara **cuántas cajas** envía y **cuánto pesa estimada cada una**; el peso
nominal de la línea se precarga pero se puede ajustar, porque no todas las cajas van
igual de llenas. Recepción cuenta cajas y pesa en báscula, así que quedan **dos contrastes
independientes**: pueden llegar todas las cajas y aun así pesar menos de lo declarado.

**Reglas que el sistema hace cumplir:** la fecha de llegada no puede ser anterior al
envío; no se procesa más de lo recibido; lo exportable no supera lo procesado; el
**balance de masa** de las mermas debe cuadrar con `(procesado − exportable) × 11 kg`;
un lote cerrado no admite cambios.

## 4 bis. Las dos unidades, y por qué importan

Del campo llega la **gaveta**; al contenedor sale la **caja de exportación**. Pesan cosas
distintas y no son intercambiables:

| Línea | kg/gaveta | kg/caja | cajas por gaveta | rendimiento |
|---|---|---|---|---|
| Pitahaya roja | 11 | 3 | 3,54 | 96,5 % |
| Tomate de árbol | 20 | 2,5 | 7,68 | 96,0 % |
| Granadilla | 12 | 2 | 5,85 | 97,5 % |

Hasta la versión 4 la app creía que una caja pesaba 11 kg —que es lo que pesa una gaveta
de pitahaya— y medía el rendimiento dividiendo «cajas entre cajas», con bultos de distinto
peso a la entrada y a la salida. Ese número no significaba nada. Ahora:

- El proveedor anuncia **gavetas**; Recepción cuenta **gavetas** y pesa kilos.
- Producción registra **gavetas procesadas** y **cajas exportables**.
- El rendimiento y el balance de masa se calculan **en kilos**, que es como los calcula el
  balance de la base maestra.
- La liquidación va por **kilo recibido** (1,50 / 1,54 / 1,40 USD/kg), no por bulto.

## 5. Indicadores

Tres familias, en `core/indicadores.js`.

### Pérdidas
| Indicador | Fórmula |
|---|---|
| Diferencia en cajas | `(cajas pesadas − cajas anunciadas) ÷ anunciadas` |
| Diferencia en peso | `(kg en báscula − kg declarados) ÷ kg declarados` |
| kg por caja real | `kg en báscula ÷ cajas contadas` |
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

### Estudio de tiempos y asignación

`core/db.js` guarda las **28 actividades** del estudio de tiempos del TIC —una tabla por
línea, con su estación, su símbolo del DAP, la unidad en que se mide, la lectura, la
valoración y el suplemento. Lo que **no** guarda es el tiempo estándar: se calcula.

```
TN = TO × valoración Westinghouse
TE = TN × (1 + suplemento OIT)
TE por gaveta = TE × (1 si la actividad se mide por gaveta, cajas/gaveta si se mide por caja)
```

De ahí salen **dos relojes distintos**, y confundirlos era el error de la versión anterior:

| | qué mide | para qué sirve | ¿depende de la gente? |
|---|---|---|---|
| **Tiempo de ciclo** | min por gaveta | prometer entregas, comparar con el takt | no |
| **Contenido de trabajo** | min-**persona** por gaveta | asignar personal, costear | sí |

Difieren en las actividades atendidas por más de una persona: el sopleteado de pitahaya
(2 personas), la clasificación de tomate (2) y la de granadilla (1,5) tardan lo mismo y
consumen el doble —o el triple— de mano de obra. El planificador usaba el ciclo para
repartir gente, así que subestimaba el personal justo en las estaciones que mandan.

```
takt           = tiempo disponible del turno ÷ gavetas del día
operarios      = contenido de trabajo ÷ takt
por estación   = contenido de esa estación ÷ takt
```

Los resultados cuadran con la base maestra hasta el tercer decimal:

| | ciclo | contenido | cajas/gav | min/caja | takt | operarios | MO/caja | manda |
|---|---|---|---|---|---|---|---|---|
| Pitahaya | 16,83 | 20,02 | 3,54 | 4,76 | 2,31 | 9 | $0,39 | Empaque (50 %) |
| Tomate | 43,29 | 57,44 | 7,68 | 5,64 | 8,40 | 7 | $0,52 | Clasificación (64 %) |
| Granadilla | 20,24 | 24,84 | 5,85 | 3,46 | 5,86 | 5 | $0,29 | Clasificación (56 %) |

**El estándar se recalcula solo.** Cuando en la próxima visita se cronometren cinco ciclos,
se cambia el TO de esa actividad y se mueven con él el takt, los operarios, el costo por
caja y el costeo de cada causa raíz. Eso es lo que hace que la app sirva para decidir y no
solo para registrar.

### Costeo por causa raíz
| Indicador | Fórmula |
|---|---|
| Valor de la fruta perdida | `Σ (kg merma × precio de caja ÷ kg por caja)` |
| Recuperado por destino | `Σ (kg × valor del destino)` — negativo en relleno (−0,02 $/kg) |
| Horas-hombre hundidas | `Σ (kg ÷ kg por caja × tiempo estándar ÷ 60 × costo hora-hombre)` |
| Costo de la causa | `fruta − recuperado + horas-hombre` |
| Proyección anual | `costo del período × 365 ÷ días del período` |
| Pareto económico | % y % acumulado sobre el costo; las causas hasta el 80% quedan marcadas **vitales** |

Es el puente entre el diagnóstico y la decisión: mientras la pérdida se mide en kilos nadie
la prioriza; medida en dólares al año, sí. La proyección anual es un supuesto (**S**) y la
pantalla lo dice.

### Simulador de escenario «con mejora»

Las ocho medidas vienen de la **matriz KPI de la base maestra**, no de la app: cada una
trae su indicador actual, su meta, la pérdida ya calculada y sobre qué base se calculó.
Las tres de merma (causas 6 a 8) suman **77.191,85 USD/año**, que es exactamente la cifra
del balance de masa. La causa 5 —capacidad ociosa de sopleteado— se deja en cero a
propósito: es pérdida indirecta, y monetizarla sería el tipo de número que hace desconfiar
de todo lo demás.

Se elige cuánto se cree que baja cada causa y cuánto costaría lograrlo:

```
ahorro por causa   = costo anual de la causa × reducción supuesta
ahorro por valorizar = kg que aún irían a relleno × fracción valorizada
                       × (valor del destino objetivo − valor del relleno)
ahorro neto anual  = ahorro por causa + ahorro por valorizar − costo anual añadido
payback (meses)    = inversión ÷ ahorro neto × 12
VAN a 3 años       = −inversión + Σ ahorro neto ÷ (1 + 12%)^t
beneficio/costo    = ahorro neto × 3 años ÷ inversión
```

Trae las cuatro medidas del diagnóstico como interruptores, con una estimación inicial
editable: segregar la merma (CR5), estandarizar la entrega del proveedor (CR6), reordenar
el layout (CR7) y balancear el sopleteado (CR8). Dos medidas sobre la misma causa **no se
suman**: se combinan como reducciones sucesivas. Al mover un deslizador a mano las medidas
se desmarcan, porque el escenario ya dejó de ser el del catálogo.

Cierra con los tres indicadores clave *antes → después* (tasa exportable, merma y descarte
aprovechado) y un veredicto explícito cuando la propuesta no se sostiene. Reducciones,
inversiones y tasa de descuento son **supuestos (S)**, nunca datos medidos, y deben
discutirse con la empresa.

## 5 bis. Guía de uso dentro de la app

Un manual aparte envejece y nadie lo abre, así que la guía vive en el sistema
(`core/guia.js`) y se imprime desde él. No es texto fijo: el recorrido del pedido, los
roles y los orígenes M/E/S se arman con los catálogos reales, de modo que si mañana
cambia un parámetro, la guía cambia con él.

- **Planta** → menú *Guía de uso*. Cada rol ve primero sus propios pasos (Recepción no
  ve el procedimiento de cierre, que no le toca) y después el recorrido completo, cómo
  leer cada indicador, qué significa la letra junto a los números y las dudas frecuentes.
- **Portal** → pestaña *Ayuda*. Escrita para el proveedor: anunciar, seguir el lote,
  su desempeño, su contraseña y qué pasa sin señal. Los estados se le explican en sus
  términos —la ayuda del catálogo habla de causas raíz y mermas, que ni le sirven ni le
  corresponden.

Al imprimir, las preguntas plegadas se abren solas y vuelven después a como estaban: un
`<details>` cerrado no sale en el papel y ninguna regla de CSS lo arregla.

## 5 ter. Lo que hace que se use a diario

Tres cosas que no añaden ningún indicador y son las que más se tocan.

**Campana de novedades** (`core/novedades.js`). Saber si algo cambió obligaba a entrar a
mirar: el proveedor revisaba si ya habían pesado su fruta, Recepción si había llegado un
anuncio, Supervisión si quedaba algo sin cerrar. Ahora lo dice la campana. No se guarda
ninguna lista de avisos: se **deducen** del estado actual de los lotes cada vez que hacen
falta, y lo único que se guarda —solo en el propio equipo— es qué avisos ya vio esa
persona. Así no hay nada que sincronizar, nada que se desfase y nada que limpiar. Cada rol
ve lo suyo: el proveedor, lo que pasó con su fruta; Recepción, lo que tiene que pesar;
Supervisión, lo que espera su cierre y qué accesos se entregaron y nadie estrenó.

**Buscador.** Un solo cuadro que filtra mientras se escribe, por código de lote,
proveedor, línea o estado —que es como la gente busca de verdad: se acuerda del código o
del proveedor, no del filtro. En planta vive en `Indicadores.filtrar`, así que lo honran
también los reportes; en el portal filtra las tarjetas de envíos.

**Repetir envío.** Casi todos los envíos de un proveedor se parecen al anterior. Cada
tarjeta trae *Repetir este envío*: abre el formulario con la línea, las cajas, el peso por
caja, la calidad y el transporte ya puestos, y la fecha de hoy —esa no se copia—. Minuto y
medio de formulario pasa a diez segundos.

### Tres pantallas que se leían igual

Recepción, Producción y Lotes tenían la misma forma (bloque arriba, tabla ancha abajo) y
las de Recepción y Lotes eran **literalmente la misma tabla**, con las mismas nueve
columnas. Se arregló quitando la repetición, no maquillándola:

- **Recepción** es ahora solo la cola del patio y *lo pesado hoy*, con las columnas que le
  importan a quien pesa y el botón de corregir. El histórico completo, con su buscador,
  vive en Lotes, y un aviso al pie lo dice.
- **Producción** conserva su propia tabla, que nunca fue igual (folio, turno, tasa,
  eficiencia, CR principal), y remite a Lotes para el recorrido del pedido.
- Cada módulo tiene su **acento de color** propio, para saber dónde estás de un vistazo.
- Mientras se busca algo concreto, la cola de cierre se oculta: quien escribe un código
  quiere ver ese lote, no otra tabla encima.

### Que se entienda sin explicación

Tres cosas que el refactor de unidades dejó confusas y se arreglaron mirando los
formularios reales, no el código:

- **«Tiempo real de proceso»** no decía si eran minutos de reloj o minutos-persona, y el
  estándar se mostraba en la otra unidad. Ahora el campo pregunta *«¿Cuánto tardó la
  línea? (minutos de reloj)»* y, debajo, traduce el estándar con la gente que se acaba de
  escribir: «Con 4 operarios, el estándar para estas 60 gavetas es 300 min de reloj».
- **Las cajas esperadas** no se decían: quien registra tenía que calcularlas. Ahora el
  campo dice cuántas deberían salir de ese lote, así que se compara en vez de calcular y
  una diferencia grande salta sola.
- **El balance** decía «Merma total: 32 kg». Ahora dice de dónde sale: «Se perdieron 32 kg
  (662 kg entraron − 630 kg se empacaron)».
- En el celular, **el resumen del envío** quedaba tapado por el pie fijo justo antes de
  guardar. Se movió arriba, junto a las gavetas: se escribe el número y aparece al
  instante «880 kg · aprox. $1.320».

## 5 quater. Liquidación al proveedor

El documento con el que se paga, y lo que cierra el ciclo: el proveedor anuncia, la planta
pesa, y esto resulta de ese pesaje. *Liquidaciones* en planta, *Pagos* en el portal, con
el mismo cálculo a los dos lados.

```
importe del lote = kg de báscula × precio por kilo
total            = Σ importes de los lotes no rechazados
```

Tres decisiones que conviene conocer antes de la primera discusión con un proveedor:

1. **Se liquida sobre el kilo de báscula**, no sobre lo declarado ni sobre bultos: es el
   único dato que las dos partes vieron.
2. **Un lote ya pesado se paga aunque siga en planta.** Se liquida lo que entró, no lo que
   salió; el documento lo marca como «en planta» para que nadie se sorprenda.
3. **Un lote rechazado aparece igual**, con importe cero y su motivo escrito. No decirlo es
   lo que genera la llamada.

El documento es imprimible, lleva el detalle lote por lote y dos espacios de firma. El
folio es estable —mismo período y mismo proveedor dan siempre el mismo número— así que
reimprimirlo no crea un documento distinto.

## 6. Planificación diaria

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

### Ningún estado se marca a mano

No hay un botón de «marcar como procesado», ni de «marcar como recibido». Cada estado se
alcanza **haciendo el trabajo**: el lote pasa a *Recibido* cuando Recepción lo pesa, a
*Procesado* cuando Producción registra lo que salió, y a *Cerrado* cuando Supervisión lo
cierra. Es lo correcto —un estado que se puede marcar sin haber hecho el trabajo acaba
mintiendo— pero no era evidente, así que ahora la app lo dice en tres sitios:

- **Un contador por cola en el menú.** Eran dos de tres: Recepción y Lotes lo tenían y
  Producción no, que es justo donde se preguntaba dónde marcar.
- **Un bloque «¿Qué sigue?» en la ficha de cualquier lote**, con el paso que falta, a quién
  le toca y un botón que lleva a esa pantalla. En un lote recibido dice, con todas sus
  letras, que no hay que marcarlo como procesado.
- **La guía**, en el recorrido del pedido y en las dudas frecuentes.

### Cerrar un pedido

El cierre lo da solo Supervisión, y solo sobre un lote en estado *Procesado*. Estaba
escondido en una columna de acciones, así que ahora hay tres caminos al mismo sitio:

1. **Lotes → «Terminados, esperando el cierre»**, un bloque que junta todos los
   pendientes con los días que llevan abiertos. Deliberadamente **no** se filtra por
   fecha: un pedido olvidado de hace tres semanas tiene que seguir saltando a la vista
   aunque el filtro mire solo esta semana. El número junto a *Lotes* en el menú es esa
   misma cuenta.
2. **Desde la ficha** de cualquier lote procesado.
3. **En la fila** del lote, en la tabla general.

Al cerrar se decide si se publica el reporte en el portal del proveedor. Un lote cerrado
no admite cambios; para enmendarlo hay que *Reabrir*, y la reapertura queda en la bitácora
con nombre y fecha.

## 7. Datos del TIC ya cargados

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

## 8. Versión publicada

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

## 8 bis. Poner en marcha con datos reales

Lo que trae cargado es **demostración**: proveedores inventados, lotes simulados y cuentas
de ejemplo cuyas claves están a la vista en la pantalla de acceso. Para empezar a trabajar
de verdad: *Datos del sistema → **Empezar de cero con datos reales***.

- Borra **toda la operación**: lotes, producciones, planes, proveedores y usuarios, en
  todos los dispositivos a la vez.
- Conserva los **catálogos**: líneas, estudio de tiempos, causas raíz, destinos y
  parámetros. No son demostración, son lo medido en el TIC.
- Deja **una sola cuenta**, la de quien lo pone en marcha, con una clave temporal que se
  muestra una única vez y que hay que cambiar al entrar.
- Con las cuentas de ejemplo desaparecen sus claves conocidas, así que la pantalla de
  acceso **deja de ofrecerlas sola**: no hay que acordarse de quitarlas.

Es irreversible, así que pide escribir la palabra `EMPEZAR` además de confirmar, y conviene
descargar el respaldo JSON antes. A partir de ahí: *Proveedores → Nuevo* (cada proveedor
activa su propia contraseña con su RUC) y *Usuarios → Nuevo* para la gente de planta.

### Antes de poner datos reales de la empresa

Lo de §12 no es retórica. Quien tenga el enlace puede leer el almacén, incluidos los
hashes de las contraseñas, y los permisos se aplican en el cliente. Para un **piloto
controlado** —el equipo del TIC y dos o tres proveedores de confianza— es suficiente. Para
operación real con los datos de una empresa bajo acuerdo de confidencialidad, hace falta
antes un servidor que verifique la contraseña y no exponga nunca los hashes.

## 8 ter. Instalarlo en el celular

El paquete publicado es una aplicación instalable: `manifest.json` y los iconos viajan
como archivos sueltos junto a la página (`tools/empaquetar.js` los copia a `dist/`).

- **Android / Chrome:** abrir el enlace → menú ⋮ → *Añadir a pantalla de inicio*.
- **iPhone / Safari:** abrir el enlace → compartir → *Añadir a pantalla de inicio*.

Queda un icono propio y la app abre a pantalla completa, sin barra de navegador. El
manifiesto declara además dos atajos —*Portal del Proveedor* y *Sistema de Planta*— que en
Android aparecen al mantener pulsado el icono.

### Abre sin conexión

`app/pwa/sw.js` hace que la app **cargue** sin señal, no solo que siga funcionando una vez
abierta. En la finca es la diferencia entre poder usarla y no.

- La **página** se pide primero a la red y solo se tira del cache si falla. Al revés, una
  versión nueva publicada no llegaría hasta vaciar el cache a mano.
- **Iconos y manifiesto** salen del cache y se refrescan por detrás.
- **Nada más se intercepta.** Los datos viven en el almacén compartido, que ya tiene su
  propia cola para trabajar sin señal; cachear sus respuestas solo serviría para enseñar
  datos viejos como si fueran de ahora.

Probado cortando la red de verdad (`setOffline`): la app abre, se entra al portal y se
trabaja; al volver la señal se recoge la versión nueva.

## 9. Cómo ejecutarlo

```bash
python3 -m http.server 8000
# http://localhost:8000/app/
```

Recorrido completo de la demostración:

Cuentas de la demostración:

| Aplicación | Usuario | Clave | Quién es |
|---|---|---|---|
| Portal | `PRV-001` | `pitahaya2026` | Marta Cedeño — Finca La Esperanza |
| Portal | `PRV-002` | `granadilla2026` | Luis Vera — Agrícola El Progreso |
| Planta | `dandrade` | `4521` | Diego Andrade — Recepción |
| Planta | `cmendoza` | `7734` | Carlos Mendoza — Producción |
| Planta | `aquiroz` | `supervision2026` | Ing. Andrea Quiroz — Supervisor |

Recorrido:

1. **Portal** (`PRV-001`) → anuncia un envío en cajas, con su peso estimado.
2. **Planta / Recepción** (`dandrade`) → el lote aparece en la cola; cuenta y pesa.
3. **Planta / Producción** (`cmendoza`) → registra exportable y reparte la merma por
   causa raíz y destino; el balance de masa no deja guardar si no cuadra.
4. **Planta / Supervisor** (`aquiroz`) → indicadores, planificación diaria, cierre del
   lote, y alta de un proveedor nuevo con su acceso.
5. Vuelve al **portal**: el proveedor ya ve el resultado de su lote.

## 10. Dónde se guardan los datos

**Modo compartido** (versión publicada): las dos aplicaciones escriben en el mismo
almacén; los cambios llegan en vivo sin recargar. Un documento por lote, producción,
proveedor, usuario y plan; catálogos y parámetros en un documento de configuración;
bitácora agregada y podada a 200 movimientos.

**Modo local** (archivos abiertos directamente): `localStorage` del navegador, clave
`flp.db.v5`. Persiste en ese equipo pero no se comparte. El pie del menú indica siempre
en qué modo está.

**Sin señal**: en la finca la cobertura se cae, y el trabajo no puede caerse con ella.
Lo que no se logra enviar queda en una cola local (`flp.cola.v1`) que guarda la
*referencia* —colección e id—, no una copia: varias ediciones del mismo registro salen
una sola vez, con su último estado. La pantalla lo dice en lugar de fingir que se guardó,
y la cola se vacía sola al volver la red (evento `online` y un reintento cada 20 s, porque
en el celular el evento a veces no llega). Tres cosas que costaron encontrarse y que
conviene no volver a romper:

1. Se **envía antes de suscribirse**. Al revés, el primer snapshot llega sin lo que se
   registró sin señal y lo borra del cache justo antes de poder enviarlo.
2. Al resembrar el almacén, lo pendiente se aparta y se vuelve a aplicar encima de la
   semilla nueva — incluidos catálogo y bitácora, que no viven en una colección y por eso
   no salían en `registrosPendientes()`.
3. Mientras haya un cambio de catálogo sin enviar, el snapshot remoto **no** lo pisa:
   lo remoto está atrasado, no al día.

## 10 bis. Capacidad: cuánto cabe y qué hacer cuando se llene

El almacén compartido de un artefacto tiene límites duros, y conviene conocerlos antes de
chocarse con ellos:

| Límite | Valor |
|---|---|
| Documentos por artefacto | **5.000** |
| Tamaño de un documento | **256 KiB**, 32 niveles de profundidad |
| Archivos subidos (fotos, adjuntos) | cuota aparte; 20 MiB por archivo |

La app gasta **un documento por lote, por producción, por proveedor, usuario, plan y
resumen**, más tres de sistema (catálogos, bitácora y metadatos). El documento más grande
es el de catálogos, con unos 12 KiB de 256: no es el tamaño lo que aprieta, es el número.

**Ese techo no se puede subir.** Lo que sí se puede es verlo venir y liberar espacio sin
perder la historia, y eso es lo que hace *Datos del sistema*:

- Un **medidor de ocupación** con el número real de documentos y una proyección calculada
  con el ritmo **medido en esa instalación** —documentos nuevos por día entre el primer
  registro y hoy—, no con un supuesto.
- **Archivar un mes cerrado**: guarda su resumen —kilos, rendimiento, merma por causa y
  por destino, valor por proveedor y por línea— y borra sus lotes y producciones sueltos.
  Un mes pasa de decenas de documentos a uno. En las pruebas, archivar un mes liberó 86.

Antes de archivar se descarga el respaldo completo de ese mes con el detalle lote a lote:
dentro de la app queda el resumen, el detalle vive en ese archivo. No se archiva un mes con
lotes sin cerrar —se perdería trabajo a medias— y la pantalla lo dice en vez de ofrecerlo.

**Lo que el archivo no hace:** los indicadores normales siguen leyendo solo los lotes
vivos, así que una serie que cruce un mes archivado lo mostrará vacío. El resumen está
guardado y es consultable, pero no se mezcla automáticamente con el detalle. Decir lo
contrario sería un gráfico que miente sin avisar.

## 11. Migrar a un backend real

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

## 12. Limitaciones conocidas

1. **La contraseña se comprueba en el navegador, no en un servidor.** El hash es real
   (PBKDF2-SHA256, sal por persona), pero quien pueda leer el almacén ve los hashes y
   podría intentar adivinarlos sin conexión. Basta para que nadie entre haciéndose pasar
   por otro en planta —que es el problema práctico— pero un despliegue real debe verificar
   la contraseña en el servidor y no exponer nunca los hashes al cliente.
2. **Los permisos se aplican en el cliente.** Guían el proceso; no contienen a un usuario
   malintencionado. El aislamiento entre proveedores está en la capa de datos, pero
   también del lado del navegador.
3. **Sin recuperación automática de contraseña.** No hay correo ni SMS: Supervisión
   habilita la reactivación y el proveedor elige una nueva. Es una decisión, no un olvido
   — en planta es más fiable que un enlace que nadie abre.
4. **La identidad se prueba con el documento registrado.** Quien conozca el código y el
   RUC de un proveedor podría activar su cuenta antes que él. En un despliegue real
   convendría añadir un segundo factor (un código al teléfono registrado) o que
   Supervisión confirme la activación.
5. **Escrituras «gana el último».** Sin bloqueo de registros: si dos personas pesan el
   mismo lote a la vez, queda el valor del que guardó después.
6. **Los datos de demostración son simulados**, con semilla fija para que las capturas del
   documento sean reproducibles. Reemplazar por datos reales antes de concluir nada.
7. **Confidencialidad.** La empresa está bajo acuerdo de confidencialidad: cuidado con
   dónde se publica una versión que lleve su nombre y sus parámetros reales.

## 13. Pruebas

Dos suites en Chromium con Playwright. **22 comprobaciones** sobre las aplicaciones
separadas que recorren las dos
aplicaciones contra un mismo almacén compartido — portada, aislamiento del proveedor,
anuncio en cajas, pesaje con contraste de cajas y kg, propagación en vivo al celular sin
recargar, tasa y eficiencia contra el estudio de tiempos, balance de masa (incluidos los
casos que *deben* fallar), Pareto por causa raíz, planificador con takt time y detección
de sobrecarga, catálogos editables con M/E/S, cierre del lote y reporte al proveedor sin
exponerle causas internas de planta.

**7 comprobaciones de primera entrada**: que la pantalla ofrezca cuentas, que al pulsarlas
quede listo el formulario, que se entre sin conocimiento previo, que la planta no ofrezca
cuentas de proveedor y que una cuenta con la clave cambiada deje de ofrecerse.

**18 comprobaciones de autenticación**: que la contraseña no quede escrita en el almacén,
que dos cuentas con la misma clave den hashes distintos, que rechace la clave equivocada,
que no revele si un código existe, que un proveedor no entre con credencial de planta, que
frene la adivinación, que la sesión se recuerde, que Supervisión pueda crear un acceso y
entregarlo una sola vez, y que la clave temporal deje de servir en cuanto se cambia.

**15 comprobaciones de activación por el propio proveedor** y **10 de corrección con
rastro**: que un pesaje equivocado pueda enmendarse y que la bitácora conserve el valor
anterior, quién lo cambió y cuándo.

**11 comprobaciones sin señal**: que la app no finja haber guardado, que lo registrado
sobreviva a cerrar y reabrir, que salga solo al volver la red —incluido un cambio de
catálogo, que no vive en una colección— y que deje de marcarse como pendiente.

**17 comprobaciones de costeo y simulador**: que las tres partes del costo cuadren con el
total, que el Pareto económico cierre en 100%, que el payback concuerde con inversión y
ahorro, que quitar una medida baje las dos cifras, que mover un deslizador recalcule **sin
robar el foco**, que valorizar el residuo aporte ahorro propio, y que una inversión
imposible o un costo anual mayor que el ahorro se declaren inviables en vez de mostrar un
número absurdo.

**23 comprobaciones de cierre, siguiente paso y guía**: que el contador del menú cuente los pendientes
de cierre, que el bloque sobreviva al filtro de fechas, que cerrar publique el reporte,
que un lote ya cerrado no ofrezca cerrarse otra vez, que Recepción no vea nada de eso,
que cada rol reciba su propia guía, que la guía se arme con los catálogos reales, que no
se cuele marcado HTML en el texto y que al imprimir se abran las preguntas plegadas y
luego vuelvan a su sitio.

**24 comprobaciones de uso diario**: que la campana encienda y se apague sola, que los
avisos de un proveedor no mencionen lotes ajenos, que pulsarlos lleve a la pantalla
correcta, que el buscador no robe el foco mientras se escribe, que *Repetir* copie todo
menos la fecha y no dispare la ficha al pulsarlo, que crear el repetido no toque el
original, y —comprobado comparando las cabeceras de todas las tablas— que **ninguna
pantalla repita la tabla de otra**.

**15 comprobaciones del estudio de tiempos**, contrastadas una a una contra el Excel del
TIC: ciclo, contenido, cajas por gaveta, minutos por caja, minutos-persona por kilo, takt,
operarios mínimos, costo de mano de obra y estación que manda, en las tres líneas. Además:
que TE salga de TO × V × (1 + suplemento) en cada actividad, que cambiar una lectura mueva
el estándar y el costo, que el contenido supere al ciclo donde hay dos personas, que las
estaciones sumen los operarios del total, y que el planificador use el contenido de trabajo
y **no** el tiempo de ciclo.

**14 comprobaciones de cordura**: que ninguna tasa se salga de 0–100 %, que la eficiencia
viva en un rango creíble, que ningún porcentaje imposible llegue a la pantalla —en el
panel, en producción, en lotes, en costeo, en los reportes y en el portal—, que la merma
nunca supere lo procesado, que el balance de masa cierre en cada lote y que el peso real
por gaveta se parezca al nominal. Un número imposible en pantalla es lo menos intuitivo
que hay: quien lo ve deja de confiar en todo lo demás. Esta suite encontró tres sitios
donde se dividían minutos-persona entre minutos de reloj, y uno donde se dividían cajas
entre gavetas.

**11 comprobaciones del arranque en limpio**: que no se borre sin escribir `EMPEZAR`, que
se vaya la operación y se queden los catálogos, que la clave temporal se muestre una vez y
no quede escrita, que las cuentas de ejemplo dejen de ofrecerse solas, que la cuenta nueva
entre y deba cambiar su clave, y que la vieja ya no sirva. Y **4 de instalación móvil**:
manifiesto válido y descargable, iconos PNG reales y los dos atajos llevando a cada puerta.

**10 comprobaciones de liquidación**: que el total salga de kg × precio y **no** de lo
declarado, que un rechazado quede en cero con su motivo, que las líneas del documento
sumen el total, que el folio sea estable, que el proveedor vea exactamente la misma cifra
que calcula la planta y que nunca vea un lote ajeno. Y **6 de uso sin conexión**, cortando
la red de verdad: la app abre, se entra al portal, se trabaja, y al volver la señal se
recoge la versión nueva.

**11 comprobaciones de capacidad y archivo**: que la cuenta de documentos coincida con lo
que de verdad hay, que la proyección salga del ritmo medido, que solo se ofrezcan meses con
todo cerrado, que el resumen conserve los indicadores del mes, que no archive sin escribir
`ARCHIVAR`, que descargue el respaldo, que libere documentos y que nada se rompa después
—incluida la liquidación, que deja de incluir un mes archivado.

Y **9 comprobaciones** sobre el paquete publicado: las dos puertas, el almacén compartido
activo, un envío anunciado desde el celular apareciendo en la cola de la planta, el pesaje
llegando en vivo al portal, la navegación entre puertas, y el costeo y la guía funcionando
dentro del archivo único.

### Empaquetar

```bash
node tools/empaquetar.js      # → dist/sistema-flp.html
```

Concatena los mismos archivos de `app/` que usa el desarrollo, en el orden que exigen las
dependencias, y se niega a escribir el paquete si encuentra una etiqueta `</script>` dentro
del código —que cerraría el bloque antes de tiempo y rompería la página entera en
silencio. Lo publicado y lo versionado no pueden separarse.
