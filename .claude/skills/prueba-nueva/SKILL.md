---
name: prueba-nueva
description: Crea el andamiaje de una suite de pruebas de Acopia dentro del repositorio, con el armazón compartido. Úsala al añadir cobertura nueva o cuando el usuario pida "escribe una prueba para...".
---

# Una suite nueva

**Dentro de `tools/pruebas/`.** Vivieron una vez en un directorio temporal y
se perdieron veintiuna.

## Plantilla

```js
/* =========================================================================
   <nombre>.js — <qué protege, en una línea>

   <Por qué existe: qué error real atrapó, o qué podría romperse sin ella.>
   ========================================================================= */
const E = require("./entorno.js");
const falsoDB = require("./falsodb.js");

(async () => {
  const s = E.suite("<nombre>");
  const b = await E.navegador();
  const ctx = await b.newContext(E.ESCRITORIO);   // o E.MOVIL
  await ctx.addInitScript(falsoDB);
  const p = s.vigilar(await ctx.newPage(), "planta");
  await p.goto(E.BASE + "/interno/", { waitUntil: "networkidle" });
  await E.entrar(p, "aquiroz", "supervision2026", ".lateral");

  s.bloque("[1] <lo que se comprueba aquí>");

  await s.paso("<la afirmación, no la acción>", async () => {
    // throw si no se cumple
  });

  await b.close();
  s.fin();
})();
```

Después, añádela a la lista `SUITES` de `correr.sh`.

## Lo que hace útil una comprobación

- **Afirma, no narra.** «el proveedor no ve lotes ajenos», no «hace clic en
  lotes».
- **Falla por una razón sola.** Si una comprobación puede fallar por tres
  motivos, el mensaje no dice cuál.
- **El mensaje de error dice qué pasó y con qué valor.** `"eficiencia de
  997%"` sirve; `"mal"` no.

## Cuentas

| rol | usuario | clave |
|---|---|---|
| Supervisión | `aquiroz` | `supervision2026` |
| Recepción | `dandrade` | `4521` |
| Producción | `cmendoza` | `7734` |
| Proveedora | `PRV-001` | `pitahaya2026` |

## Trampas conocidas

- **Elementos hoja, no contenedores.** Concatenar las celdas de una fila
  fabrica números que nadie escribió: «5.470» + «94,1%» se lee «394,1%».
- **No ates nada a la semilla.** Es relativa a hoy; un lote de hace ocho
  días sale del filtro de 7 días al pasar la medianoche. Deriva lo que
  necesites de lo que haya en pantalla, por su id.
- **Postgres rechaza de dos maneras.** `INSERT` contra `WITH CHECK` da
  error; `UPDATE` contra `USING` afecta a cero filas **sin error**.
- **Elige la fila por lo que tiene, no por su posición.** `.last()` se rompe
  en cuanto cambia el orden.

## Si necesita Postgres

Mira `autenticacion.js`: usa `falsogotrue.js`, que finge la API de
autenticación de Supabase pero manda las consultas a un PostgreSQL de
verdad con las políticas de verdad. Unas políticas escritas en SQL solo se
pueden verificar ejecutándolas: contra una imitación en JavaScript, lo que
se probaría es la imitación.
