# Guía rápida: hacer videos desde cero

## Las 3 herramientas

| Herramienta | Qué hace (en simple) |
|---|---|
| **HyperFrames** | Convierte una página web (texto, colores, animaciones) en un video MP4. Tú describes el video, la herramienta lo "graba". |
| **FFmpeg** | La navaja suiza del video: recorta, une, convierte formatos, saca fotos de un video, cambia tamaño. HyperFrames lo usa por dentro. |
| **yt-dlp** | Descarga videos de internet para usarlos como referencia. |

## Estructura

```
videos/
  mi-primer-video/   # proyecto de prueba (index.html = el video)
  referencias/       # aquí van los videos descargados (no se suben a git)
```

## Comandos básicos

Entrar al proyecto:

```bash
cd videos/mi-primer-video
```

Revisar que el video no tenga errores:

```bash
npx hyperframes check
```

Ver el video en el navegador mientras lo editas:

```bash
npm run dev
```

Convertirlo en MP4:

```bash
npx hyperframes render -o mi-video.mp4
```

Crear un proyecto nuevo (vertical para Reels/TikTok):

```bash
npx hyperframes init nombre-del-video --example blank --resolution portrait
```

Ver información de un video con FFmpeg:

```bash
ffprobe mi-video.mp4
```

Descargar un video de referencia:

```bash
yt-dlp -o "referencias/%(title)s.%(ext)s" "URL_DEL_VIDEO"
```

> YouTube y Vimeo bloquean descargas desde servidores en la nube. En tu propia computadora
> funciona normal; si pide "confirmar que no eres un bot", agrega
> `--cookies-from-browser chrome`.
