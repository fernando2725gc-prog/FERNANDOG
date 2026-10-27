# J.A.R.V.I.S. — Asistente personal por voz

Asistente con control de voz en español que corre en el navegador, sin instalar
nada ni usar claves de API. Escucha con el micrófono, entiende la orden y
responde en voz alta.

## Cómo usarlo

```bash
cd jarvis
npm start            # o: python3 -m http.server 8000
# abre http://localhost:8000 en Chrome o Edge
```

1. Pulsa **Activar micrófono** y acepta el permiso.
2. Di **«Jarvis»** seguido de la orden: *«Jarvis, ¿qué hora es?»*.
   Si dices solo «Jarvis», responde «¿Sí?» y escucha la siguiente frase durante 8 segundos.
3. También puedes escribir las órdenes en la caja de texto.

> El micrófono solo funciona en `localhost` o en un sitio con `https`.
> El reconocimiento de voz lo ofrecen Chrome, Edge y Safari; en Firefox
> solo funciona la caja de texto.

## Qué sabe hacer

| Orden de ejemplo | Qué hace |
| --- | --- |
| «Hola Jarvis» | Saluda según la hora del día |
| «¿Qué hora es?» / «¿Qué día es hoy?» | Hora y fecha |
| «¿Cuánto es 25 por 4 más 3?» | Calculadora (más, menos, por, entre, elevado a) |
| «Pon un temporizador de 5 minutos» | Temporizador con aviso hablado |
| «Anota comprar leche» / «Lee mis notas» / «Borra mis notas» | Notas guardadas en el navegador |
| «Abre YouTube» / «Abre github.com» | Abre sitios web |
| «Busca recetas de pasta» | Búsqueda en Google |
| «Pon música relajante en YouTube» | Búsqueda en YouTube |
| «¿Cómo está el clima en Monterrey?» | Clima actual (Open-Meteo, sin clave) |
| «¿Quién es Marie Curie?» / «¿Qué es la fotosíntesis?» | Resumen de Wikipedia en español |
| «Cuéntame un chiste» | Chistes |
| «Ayuda» | Lista lo que puede hacer |
| «Apágate» | Desactiva el micrófono |

## Estructura

```
jarvis/
├── index.html             # Interfaz (núcleo animado, conversación, ajustes)
├── css/styles.css         # Estilo HUD
├── js/app.js              # Micrófono, voz, temporizadores, notas, interfaz
├── js/commands.js         # "Cerebro": interpreta frases y arma respuestas
└── tests/commands.test.js # Pruebas de los comandos (Node, sin dependencias)
```

`commands.js` no depende del navegador: recibe la frase y un objeto `ctx` con
las acciones disponibles (abrir URL, notas, temporizadores, `fetch`), así que
se puede probar con Node:

```bash
npm test
```

## Agregar un comando nuevo

Añade un objeto al arreglo `COMMANDS` en `js/commands.js`. Los patrones se
comparan contra el texto normalizado (minúsculas, sin acentos ni signos):

```js
{
  name: "moneda",
  help: "Lanza una moneda",
  patterns: [/^(?:lanza|tira) una moneda$/],
  run: () => (Math.random() < 0.5 ? "Salió águila." : "Salió sol.")
}
```

`run` puede ser `async` y debe devolver el texto que Jarvis dirá. El orden del
arreglo importa: gana el primer comando cuyo patrón coincida.

## Próximos pasos posibles

- Conectar un modelo de IA (por ejemplo Claude) para responder preguntas
  libres cuando ningún comando coincida. Debe hacerse desde un pequeño
  backend para no exponer la clave de API en el navegador.
- Versión de escritorio en Python para controlar el sistema (abrir
  programas, volumen, apagar el equipo).
- Recordatorios con fecha y hora, y control de domótica.
