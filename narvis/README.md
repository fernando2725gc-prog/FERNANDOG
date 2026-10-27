# N.A.R.V.I.S. — Asistente personal por voz

Asistente en español que escucha, responde en voz alta y está enfocado en los
temas importantes: geopolítica, economía, México, ciencia y tecnología, salud
y clima. Su cerebro es Claude y tiene un **radar de noticias** que se actualiza
solo varias veces al día.

## Dos formas de usarlo

| | App en Claude (`app.html`) | Versión local (`index.html`) |
| --- | --- | --- |
| Cerebro (preguntas abiertas, análisis) | Sí, con tu cuenta de Claude | No |
| Radar de noticias actualizado | Sí | No |
| Comandos rápidos (hora, cuentas, notas, temporizadores, abrir sitios) | Sí | Sí |
| Respuesta en voz alta | Sí | Sí |
| Micrófono | Dictado del teclado (el marco de Claude no deja usar el micrófono directo) | Sí, con palabra clave «Narvis» (Chrome o Edge) |
| Notas | Privadas, guardadas en tu cuenta | En el navegador |

### App en Claude

Se publica como Artifact con `app.html` y los archivos de `css/` y `js/`.
Declara tres capacidades:

- `sample`: le pregunta a Claude (el cerebro). La primera vez pide permiso.
- `db`: lee las noticias de `news/latest` y guarda las notas de cada persona en
  `data/users/<id>/notes`. Solo la dueña puede escribir noticias.
- `user`: identifica a quien la usa para separar sus notas.

Las noticias las escribe una **tarea programada** de Claude Code (3 veces al
día) que busca en la web lo más importante de las últimas 24 horas y guarda
entre 15 y 25 notas con fuente, tema e importancia.

### Versión local

```bash
cd narvis
npm start            # o: python3 -m http.server 8000
# abre http://localhost:8000 en Chrome o Edge
```

Pulsa **Activar micrófono** y di: *«Narvis, ¿qué hora es?»*.

## Cómo piensa

1. Si la frase es un comando rápido (`js/commands.js`), se resuelve al
   instante sin gastar uso de Claude.
2. Si no, va al cerebro (`js/brain.js`) con: las instrucciones de Narvis, la
   fecha y hora, las noticias del radar y los últimos turnos de conversación.
3. Preguntas cortas usan el modelo rápido; «explica», «analiza», «por qué» y el
   resumen del día usan el modelo más capaz.
4. La respuesta se muestra mientras se escribe y luego se lee en voz alta.

## Estructura

```
narvis/
├── app.html               # Entrada para la app de Claude
├── index.html             # Entrada para abrirlo en local
├── css/styles.css         # Estilo HUD
├── js/app.js              # Interfaz, micrófono, voz, radar, temporizadores
├── js/commands.js         # Comandos rápidos
├── js/brain.js            # Instrucciones y llamadas al cerebro (Claude)
├── js/store.js            # Noticias y notas (base de datos de Claude o navegador)
└── tests/                 # Pruebas con node:test, sin dependencias
```

```bash
npm test
```

## Agregar un comando rápido

Añade un objeto al arreglo `COMMANDS` en `js/commands.js`. Los patrones se
comparan contra el texto normalizado (minúsculas, sin acentos ni signos) y gana
el primero que coincida:

```js
{
  name: "moneda",
  help: "Lanza una moneda",
  patterns: [/^(?:lanza|tira) una moneda$/],
  run: () => (Math.random() < 0.5 ? "Salió águila." : "Salió sol.")
}
```

Para cambiar en qué temas se enfoca el cerebro, edita `RULES` y `TOPICS` en
`js/brain.js`.
