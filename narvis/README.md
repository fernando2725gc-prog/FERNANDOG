# Narvis — asistente de ingeniería de producción

Asistente personal en español que vive dentro de la app de Claude: **no cobra
nada aparte de tu suscripción**, no necesita clave de API ni instalar nada.

Abre la app: https://claude.ai/artifact/Jmp7DKnNPsmYWnEosjrGco

## Qué hace

- **Piensa como un ingeniero de producción senior:** manufactura esbelta,
  Six Sigma y control estadístico, TPM y OEE, planeación y control de la
  producción, balanceo de líneas, estudio del trabajo, calidad, logística,
  costos e Industria 4.0, además de conocimiento general de ingeniería.
- **Pensamiento crítico:** cada respuesta señala supuestos, datos que faltan y
  riesgos en la sección «Pensamiento crítico».
- **Acciones de mejora:** cuando hay algo que mejorar, propone acciones con
  impacto, esfuerzo, prioridad (matriz impacto-esfuerzo: ganancia rápida,
  proyecto estratégico, ajuste menor, reconsiderar) y el indicador para medirlas.
- **Te recuerda:** guarda en tu cuenta lo importante que le cuentas (dónde
  trabajas, qué produces, tus proyectos) y lo usa después. Lo ves y lo puedes
  borrar en «Lo que sé de ti». La conversación también se guarda.
- **Canva:** busca tus diseños y crea presentaciones, documentos o infografías
  nuevas cuando se lo pides.
- **Voz:** te contesta en voz alta (botón «Voz activada» para silenciarla).
- **Rápido y sin gastar uso:** hora, fecha, cuentas, temporizadores y notas
  («anota…», «lee mis notas») se resuelven al instante.

## Cómo hablarle

La app de Claude no deja que las páginas usen el micrófono directamente, así
que se dicta con el sistema:

- **Windows:** clic en la caja de texto y pulsa `Windows` + `H`.
- **Mac:** pulsa `Fn` dos veces.
- **Celular:** toca el micrófono del teclado.

Luego `Enter` para enviar.

## Cómo está hecho

```
narvis/
├── app.html          # La página que se publica en Claude
├── css/styles.css    # Diseño (claro y oscuro)
├── js/app.js         # Interfaz, voz, temporizadores
├── js/brain.js       # Instrucciones de Narvis y llamada a Claude (respuesta en JSON)
├── js/commands.js    # Órdenes rápidas sin usar a Claude
├── js/store.js       # Memoria, conversación y notas (privadas, en tu cuenta)
├── js/canva.js       # Herramientas de Canva para el cerebro
└── tests/            # npm test
```

La página usa estas capacidades de la app de Claude: `sample` (el cerebro, con
tu cuenta), `db` y `user` (memoria y notas privadas por persona, y tu nombre)
y `mcp` (tu conector de Canva). La primera vez Claude te pide permiso para cada
una.

Para cambiar en qué se enfoca, edita `RULES` en `js/brain.js`.
