---
name: publicar
description: Ritual completo para publicar Acopia - empaquetar, correr las pruebas, comprobar que no se coló el nombre de la empresa, commit, push y republicar el artefacto. Úsala cuando el usuario pida "publica", "sube esto", "actualiza la app" o similar.
---

# Publicar Acopia

**El orden importa.** Publicar sin probar ha metido errores dos veces.

## 1. Empaquetar y probar

```bash
node tools/empaquetar.js
tools/pruebas/correr.sh
```

Todo en verde o no se publica. Si algo falla, arréglalo o dilo; no publiques
«con esa sola en rojo».

## 2. La confidencialidad

```bash
node tools/pruebas/identidad.js
```

Tiene que acabar en «todo en orden». Recorre todos los archivos del
proyecto, el sitio publicado y las pantallas de las dos aplicaciones.

El patrón de lo vetado vive **solo** en `tools/pruebas/identidad.js`. No lo
copies aquí ni a ningún otro sitio: escribirlo en un segundo archivo es
precisamente la filtración que la prueba busca, y la primera versión de esta
skill se delató sola por eso.

La empresa del caso de estudio está bajo acuerdo de confidencialidad y el
sitio es **público**. Un push es irreversible.

## 3. Commit y push

Rama de trabajo: `claude/thesis-app-github-uo9umr`.

```bash
git add -A
git commit            # ver abajo
git push -u origin claude/thesis-app-github-uo9umr
```

El mensaje cuenta **por qué**, no qué. Si el cambio arregló algo, di qué
estaba roto y cómo se notaba. Si una prueba encontró el fallo, dilo: es lo
que justifica tenerla.

No crees un pull request salvo que te lo pidan.

## 4. Republicar el artefacto

Con la herramienta Artifact, `action: "publish"`, sobre
`https://claude.ai/artifact/HqCfQhnMHYbzgFq1MTDCay`, con
`file_path: dist/acopia.html`. Mantiene la URL.

El sitio de GitHub Pages se actualiza solo con el push: sirve `docs/`.

## Qué decirle al usuario

La dirección pública, qué cambió en una línea, y **qué no pudiste
verificar**. Desde este contenedor no se alcanza ni Supabase ni el sitio
publicado: la política de red los bloquea. Dilo en vez de dar por hecho que
funcionó.
