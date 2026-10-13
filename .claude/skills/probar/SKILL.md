---
name: probar
description: Empaqueta Acopia y corre todas las suites de prueba (navegador y políticas de seguridad en PostgreSQL). Úsala antes de publicar, después de tocar cualquier cosa, o cuando el usuario pida "prueba", "corre las pruebas" o "¿sigue todo bien?".
---

# Probar Acopia

```bash
tools/pruebas/correr.sh            # todas
tools/pruebas/correr.sh cordura    # una sola
```

El lanzador empaqueta primero: sin eso las suites probarían una versión
anterior y darían por bueno algo que ya no existe.

## Si falta el entorno

Las suites necesitan PostgreSQL en el 5433 y dos servidores (8199 y 8202).
El hook de arranque los deja listos; si la sesión viene de otro sitio:

```bash
.claude/hooks/session-start.sh
```

Si PostgreSQL no está, `rls` y `autenticacion` se omiten y el resto corre
igual. Dilo en el informe en vez de dar por probado lo que no se probó.

## Qué protege cada una

| suite | protege |
|---|---|
| `humo` | el propio banco de pruebas |
| `cordura` | que ningún número imposible llegue a la pantalla |
| `tiempos` | las relaciones del estudio de tiempos |
| `bascula` | el momento del pesaje |
| `excel` | que los libros se abran de verdad |
| `identidad` | el acuerdo de confidencialidad |
| `autenticacion` | el acceso y los permisos, contra Postgres real |
| `sin-servidor` | que se entre igual cuando la base no responde |
| `rls` | las políticas de seguridad, atacándolas |

## Al interpretar un fallo

Antes de tocar la aplicación, averigua si el fallo es de la aplicación o de
la prueba. Pasa a menudo:

- La prueba se ató a la semilla, que es relativa a hoy.
- La prueba miró el texto de un contenedor en vez de los elementos hoja.
- La prueba esperaba un error donde Postgres rechaza en silencio.

La manera de saberlo es reproducir el caso a mano, no razonar sobre él. Si
el fallo ya estaba antes de tu cambio, compruébalo contra el commit anterior
(`git stash`) y dilo.

**Nunca** desactives una comprobación para poner algo en verde. Si una
comprobación sobra, bórrala y explica por qué en el commit.
