# N.A.R.V.I.S. — Asistente personal por voz

Asistente en español que te escucha por el micrófono, responde en voz alta y
está enfocado en los temas importantes: geopolítica, economía, México, ciencia
y tecnología, salud y clima. Su cerebro es Claude, busca en la web para estar
al día y se conecta con tu bóveda de **Obsidian**.

## Ponerlo en marcha (versión completa, con micrófono directo)

Necesitas [Node.js](https://nodejs.org) 22 o más reciente, Chrome o Edge, y una
clave de la API de Claude ([console.anthropic.com](https://console.anthropic.com) → API Keys).

1. Copia `.env.example` como `.env` y llénalo:
   ```ini
   ANTHROPIC_API_KEY=sk-ant-...
   OBSIDIAN_VAULT=C:\Users\TuNombre\Documents\MiBoveda
   ```
   `OBSIDIAN_VAULT` es la carpeta de tu bóveda (la que contiene `.obsidian`).
2. Inicia Narvis:
   - **Windows:** doble clic en `iniciar-narvis.bat`.
   - **macOS:** doble clic en `iniciar-narvis.command`.
   - **Terminal:** `npm install` y luego `npm start`.
3. Se abre `http://localhost:8000`. Pulsa **Activar micrófono**, acepta el
   permiso y di: *«Narvis, ¿qué está pasando en el mundo?»*.

El servidor solo escucha en tu computadora (`127.0.0.1`) y la clave de API nunca
llega al navegador.

## Si el micrófono no funciona

Al pulsar **Activar micrófono**, Narvis prueba el micrófono y, si algo falla,
muestra un aviso amarillo con la causa y un código. Las causas más comunes:

| El aviso dice… | Qué hacer |
| --- | --- |
| Chrome tiene bloqueado el micrófono | Clic en el ícono a la izquierda de `localhost:8000` › Micrófono › **Permitir**, y recarga |
| Tu sistema no le deja usar el micrófono | **Windows:** Configuración › Privacidad y seguridad › Micrófono › activa el acceso y «aplicaciones de escritorio». **Mac:** Ajustes del Sistema › Privacidad y seguridad › Micrófono › activa Chrome y reinícialo |
| No encontré ningún micrófono | Conecta uno y elígelo en `chrome://settings/content/microphone` |
| Otra aplicación lo está usando | Cierra Zoom, Teams, Discord, etc. |
| El dictado de Chrome… no pude conectarme | El reconocimiento de voz de Chrome usa internet; revisa VPN o firewall. Brave no lo trae: usa Chrome o Edge |
| Página en blanco o «Narvis no cargó» | Abriste `index.html` con doble clic: usa el iniciador y entra a `http://localhost:8000` |

## Qué puede hacer

| Di… | Qué pasa |
| --- | --- |
| «Narvis, dame el resumen del día» | Lee las noticias más importantes y guarda el resumen en Obsidian |
| «Narvis, ¿por qué sube el petróleo?» | Responde con contexto; busca en la web si hace falta |
| «Narvis, ¿qué tengo anotado sobre la casa?» | Busca y lee tus notas de Obsidian |
| «Narvis, crea una nota en Obsidian con ideas para el viaje a Oaxaca» | Crea la nota en `Narvis/` |
| «Narvis, agrega a mi nota Proyectos que el lunes empieza la obra» | Agrega texto al final de esa nota |
| «Narvis, anota comprar café» / «lee mis notas» | Lista de pendientes en `Narvis/Notas.md` |
| «Narvis, pon un temporizador de 10 minutos» | Temporizador con aviso hablado |
| «Narvis, ¿cuánto es 18.57 por 250?» | Calculadora |
| «Narvis, abre YouTube» | Abre sitios web |

Si dices solo «Narvis», contesta «¿Sí?» y escucha la siguiente frase durante
8 segundos. Puedes desactivar la palabra clave en la parte de abajo.

## Obsidian

Narvis lee y escribe los archivos Markdown de tu bóveda directamente; no hace
falta instalar ningún plugin. Todo lo que crea queda en la carpeta `Narvis/`:

```
MiBoveda/
└── Narvis/
    ├── Notas.md                 # «anota…» (lista de pendientes)
    ├── Resúmenes/2026-10-27.md  # cada «resumen del día»
    ├── Noticias/2026-10-27.md   # el radar de noticias del día
    └── <notas que le pidas crear>.md
```

Reglas de seguridad: solo crea notas dentro de `Narvis/`; en el resto de la
bóveda puede leer y **agregar al final** de una nota, pero nunca borra ni
reemplaza. «Borra mis notas» marca los pendientes como hechos (`- [x]`) en
lugar de eliminarlos.

## Radar de noticias

Al iniciar, y cada 4 horas (`NEWS_MAX_AGE_HOURS`), el servidor le pide a Claude
que busque en la web las noticias más importantes de las últimas 24 horas y las
ordene por tema e importancia. El botón **Actualizar** fuerza una búsqueda nueva
(tarda uno o dos minutos). Cada actualización usa la API, así que tiene un costo
pequeño.

## Cómo piensa

1. Las órdenes simples (hora, cuentas, notas, temporizadores, abrir sitios) se
   resuelven en el navegador al instante, sin usar la API (`js/commands.js`).
2. Lo demás va al servidor (`server/claude.js`), que llama a Claude
   (`claude-opus-5-5`) con: las instrucciones de Narvis, la fecha, el radar de
   noticias, los últimos turnos de conversación, búsqueda web y las herramientas
   de Obsidian.
3. Preguntas cortas usan esfuerzo bajo para responder rápido; «explica»,
   «analiza», «por qué» y el resumen del día usan esfuerzo medio.
4. La respuesta aparece mientras se escribe y luego se lee en voz alta.

## Otras formas de abrirlo

- **App en Claude** (`app.html`, publicada como Artifact): funciona desde
  claude.ai con tu cuenta, sin clave de API, con un radar que actualiza una
  tarea programada. Ahí el navegador no deja usar el micrófono directo (se
  dicta con el teclado) y no tiene acceso a Obsidian.
- **Sin servidor** (abrir `index.html` con cualquier servidor estático): solo
  comandos simples y micrófono, sin cerebro ni noticias.

## Estructura

```
narvis/
├── server/
│   ├── index.js       # Servidor local: archivos de la app + API
│   ├── claude.js      # Cerebro (Claude + búsqueda web + Obsidian) y radar
│   └── vault.js       # Lectura y escritura de la bóveda de Obsidian
├── js/
│   ├── app.js         # Interfaz, micrófono, voz, radar, temporizadores
│   ├── commands.js    # Comandos rápidos
│   ├── brain.js       # Instrucciones de Narvis y cliente del cerebro
│   └── store.js       # Noticias y notas según dónde corre la app
├── css/styles.css
├── index.html         # Entrada para el servidor local
├── app.html           # Entrada para la app de Claude
└── tests/             # npm test
```

Para cambiar en qué temas se enfoca, edita `RULES` y `TOPICS` en `js/brain.js`.
