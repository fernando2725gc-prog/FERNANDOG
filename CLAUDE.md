# Acopia

Trazabilidad, control de pérdidas y economía circular para una planta
exportadora de fruta fresca. Dos aplicaciones —el portal del proveedor y el
sistema de planta— sobre un mismo repositorio de datos.

Documentación completa en `app/README.md` (1.200 líneas: indicadores,
fórmulas, decisiones). Esto es solo lo que hay que saber **antes** de tocar
nada, porque olvidarlo sale caro.

---

## Lo que no es obvio y cuesta caro olvidar

### La gaveta no es la caja

Lo que llega del campo es la **gaveta**; lo que sale a exportación es la
**caja**, y pesan cosas muy distintas. Una versión anterior daba por hecho
que una caja pesaba 11 kg —que es lo que pesa una gaveta de pitahaya— y
calculaba el rendimiento como cajas ÷ cajas. Corregirlo costó renombrar unas
260 referencias.

El rendimiento se calcula **en kilos**: `kg empacados ÷ kg que entran a
proceso`. La conversión está en `DB.cajasPorGaveta(linea)` y usa los dos
pesos y el rendimiento de la línea.

### Dos relojes distintos

- **Tiempo de ciclo** (min/gaveta): minutos de reloj.
- **Contenido de trabajo** (min-persona/gaveta): lo mismo, multiplicado por
  las personas de cada actividad.

Confundirlos produce eficiencias del 997%. El planificador usa el
**contenido**, nunca el ciclo. Una actividad medida por caja se repite
tantas veces como cajas salen de una gaveta.

### La empresa está bajo acuerdo de confidencialidad

Su nombre, sus iniciales y su razón social **no pueden aparecer en ninguna
parte**: ni en el código, ni en la interfaz, ni en el paquete publicado. La
identidad vive en los datos (`DB.identidad()`), nace en modo confidencial y
una sola función decide qué nombre es imprimible: `DB.nombreEmpresa(largo)`.

La suite `identidad` falla si alguien lo vuelve a escribir. No la desactives.

### es-EC: la coma es decimal y el punto separa los miles

`«1.234»` son mil doscientos treinta y cuatro. Convertirlo mal exporta una
cifra mil veces más pequeña, y en una columna de kilos eso pasa
desapercibido justo hasta que alguien la suma.

Todo lo que se LEE se formatea con `UI.nf` / `UI.pct`. Lo que va dentro de
un `style` **no**: CSS quiere punto decimal, y una coma deja la barra sin
ancho.

---

## Cómo está armado

Vanilla HTML/CSS/JS. **Sin dependencias, sin build, sin framework**, y es a
propósito: el sistema tiene que poder abrirse dentro de diez años. Cada
módulo es un IIFE que se carga como `<script>` suelto.

```
app/core/      db · indicadores · graficos · ui · auth · sesion · nube · excel · guia · novedades
app/interno/   planta.js      sistema de planta
app/proveedor/ portal.js      portal del proveedor
tools/         empaquetar.js · supabase*.sql · pruebas/ · pruebas-rls/
```

`node tools/empaquetar.js` escribe **dos** salidas de los mismos archivos:

- `dist/acopia.html` — el artefacto de Claude (un solo archivo)
- `docs/index.html` — el sitio web, que es lo que publica GitHub Pages

El orden de carga importa y está en `GUION`, en `tools/empaquetar.js`.

### Dos seams, y conviene respetarlos

**El almacén.** `db.js` habla con un objeto `remoto` con forma de Firestore
(`doc`/`collection`/`onSnapshot`). Detrás hay dos implementaciones: el
almacén del artefacto de Claude y `core/nube.js` sobre Supabase. `db.js` no
sabe con cuál habla. `DB.origen()` lo dice: `"nube"`, `"artefacto"` o
`"local"`.

**El acceso.** Con servidor, la contraseña la verifica Supabase y los
permisos los impone Postgres. Sin servidor, se comprueba en el navegador
contra un hash local. Lo decide `Sesion.disponible()`, que **pregunta a la
base si la autenticación está instalada** en vez de mirar solo si hay
configuración: dar por hecho que hay servidor porque hay URL dejó a todo el
mundo fuera del artefacto una vez.

### La seguridad real está en SQL

`tools/supabase-auth.sql`. Los roles de la interfaz guían el trabajo; no
contienen a nadie. Lo que contiene es la política de Postgres: un proveedor
que pida los lotes de otro recibe **cero filas**.

Si tocas esas políticas, ejecuta `tools/pruebas-rls/ataque.sh`. Y recuerda
que **Postgres rechaza de dos maneras**: un `INSERT` contra `WITH CHECK` da
error; un `UPDATE` contra `USING` no da error, afecta a cero filas. Una
prueba que solo mire si hubo error da por buena una política que no protege
nada.

---

## Trabajar aquí

El hook de arranque (`.claude/hooks/session-start.sh`) deja PostgreSQL con
el esquema cargado y dos servidores en marcha. No hace falta montarlo a
mano.

```bash
node tools/empaquetar.js        # empaquetar (dist/ y docs/)
tools/pruebas/correr.sh         # todas las suites
tools/pruebas/correr.sh cordura # una sola
```

**Antes de publicar**, `correr.sh` entero. La suite `identidad` es la que
protege el acuerdo de confidencialidad y `cordura` es la que más errores
reales ha encontrado.

### Al escribir pruebas

Van en `tools/pruebas/`, **dentro del repositorio**. Vivieron una vez en un
directorio temporal y se perdieron veintiuna.

Usa `entorno.js`: trae el armazón de la suite, la ruta de Chromium resuelta
—cambia con la versión del contenedor— y `falsodb.js`, que simula el almacén
del artefacto entregando los documentos **congelados**, como el de verdad.

Dos trampas conocidas:

- **Mira los elementos hoja, no el texto de un contenedor.** Concatenar las
  celdas de una fila fabrica números que nadie escribió: «5.470» seguido de
  «94,1%» se lee como «394,1%».
- **No ates una prueba a la semilla.** Es relativa a hoy: un lote de hace
  ocho días cae dentro del filtro de 7 días hasta que pasa la medianoche.
  Deriva lo que necesites de lo que haya en pantalla.

### Al escribir código

El castellano de los comentarios explica **por qué**, no qué. Si un comentario
se limita a repetir la línea de abajo, sobra. Los que valen son los que
cuentan qué se intentó antes y por qué no funcionaba.

Los mensajes de la interfaz van en castellano, en segunda persona y sin
jerga: quien los lee está de pie en un patio, con guantes.
