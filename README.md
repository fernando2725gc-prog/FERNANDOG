# Repositorio FERNANDOG

Este repositorio contiene dos proyectos independientes:

| Carpeta | Proyecto |
|---|---|
| [`app/`](app/) | **AgroRegistro** — Sistema de registro y control de producción frutícola (proyecto de tesis) |
| raíz (`index.html`) | Landing page de la Clínica Dental Sonrisa Imperial |

---

## AgroRegistro (proyecto de tesis)

Aplicación web que centraliza en un solo repositorio de información el recorrido completo
de la fruta: el proveedor **anuncia** el envío, recepción lo **pesa**, producción registra
**lo exportable y las mermas con su causa**, y supervisión **cierra el lote** y emite los
reportes e indicadores.

Cuatro roles: 🚜 Proveedor · ⚖️ Recepción · 🏭 Producción · 📋 Supervisión.

```bash
python3 -m http.server 8000
# Abrir http://localhost:8000/app/
```

Se entra eligiendo rol y escribiendo el nombre. Para recorrer el ciclo completo:
`Marta Cedeño` → `Diego Andrade` → `Carlos Mendoza` → `Ing. Andrea Quiroz`.

La documentación completa — parámetros registrados, fórmulas de cada indicador, roles,
modelo de datos y limitaciones — está en **[`app/README.md`](app/README.md)**.

---

# Sonrisa Imperial — Landing page

Landing page de una página para la **Clínica Dental Sonrisa Imperial**, enfocada en un
único objetivo de conversión: **que el visitante agende una cita**.

## Estructura

```
index.html            # Toda la página (header, hero, servicios, equipo, FAQ, footer)
assets/css/styles.css # Estilos (tema navy + dorado, responsive)
assets/js/main.js     # Menú móvil, animaciones al scroll y validación del formulario
```

## Secciones

1. **Hero** — propuesta de valor + CTA principal "Agendar mi cita" y teléfono directo.
2. **Franja de confianza** — certificaciones y seguros aceptados.
3. **Servicios** — 6 tratamientos con precio de referencia.
4. **Cómo trabajamos** — proceso en 3 pasos + lista de diferenciadores.
5. **Equipo** — especialistas con cédula profesional.
6. **Opiniones** — testimonios de pacientes.
7. **Agendar** — datos de contacto y el formulario de cita (CTA central).
8. **Preguntas frecuentes** — objeciones previas al agendamiento.
9. **CTA final + footer** y botón flotante de WhatsApp.

## Formulario de cita

El sitio es estático, así que no hay backend. Al enviar, el formulario:

1. valida los campos en el navegador (nombre, teléfono de 10 dígitos, motivo,
   fecha no pasada y no domingo, horario y aceptación del aviso de privacidad);
2. arma un mensaje con los datos y abre **WhatsApp** (`wa.me`) listo para enviar;
3. muestra una confirmación en pantalla.

### Conectar un backend real

Si más adelante se quiere guardar la cita en un CRM o enviarla por correo,
sustituye el bloque `window.open(url, ...)` en `assets/js/main.js` por un `fetch`
al endpoint correspondiente:

```js
await fetch("/api/citas", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(datos)
});
```

## Datos por personalizar

Son de ejemplo y deben reemplazarse por los reales antes de publicar:

- Teléfono / WhatsApp: `55 1234 5678` (`WHATSAPP` en `assets/js/main.js` y los
  enlaces `tel:` / `wa.me` en `index.html`).
- Dirección, horarios y correo `citas@sonrisaimperial.mx`.
- Nombres, cédulas del equipo, precios, testimonios y logos de convenios.

## Ver la página

Abre `index.html` en el navegador, o sirve la carpeta:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## Notas técnicas

- Sin dependencias ni build: HTML, CSS y JS puros.
- Tipografías desde Google Fonts (`Cormorant Garamond` + `Inter`).
- Responsive con menú hamburguesa en móvil.
- Accesibilidad: skip link, `aria-*` en menú y formulario, foco visible,
  y respeto a `prefers-reduced-motion`.
