# Bóveda de Obsidian

Esta carpeta es una bóveda (*vault*) de Obsidian versionada con Git. Sirve como
puente entre Obsidian en tu equipo y Claude: tú escribes en Obsidian y sincronizas
con Git; Claude lee y edita los mismos archivos `.md` desde el repositorio.

## Estructura

```
00-Inbox/      # Capturas rápidas, todavía sin clasificar
10-Notas/      # Notas permanentes ya trabajadas
20-Proyectos/  # Una carpeta o nota por proyecto activo
30-Recursos/   # Material de referencia: enlaces, extractos, documentación
90-Plantillas/ # Plantillas para notas nuevas
```

Ninguna carpeta es obligatoria: renombra o elimina lo que no uses.

## Configurar Obsidian (una sola vez)

1. **Clona el repositorio** en tu equipo:

   ```bash
   git clone https://github.com/fernando2725gc-prog/fernandog.git
   ```

2. **Abre la bóveda**: en Obsidian → *Open folder as vault* → selecciona la carpeta
   `fernandog/vault` (la carpeta `vault`, no la raíz del repositorio).

3. **Instala el plugin Obsidian Git**: *Ajustes → Plugins de la comunidad →
   Desactivar modo restringido → Explorar → busca "Obsidian Git" → Instalar y Activar*.

4. **Configura la sincronización** en *Ajustes → Obsidian Git*:

   | Opción | Valor sugerido |
   |---|---|
   | Vault backup interval (minutes) | `10` |
   | Auto pull interval (minutes) | `10` |
   | Pull updates on startup | activado |
   | Push on backup | activado |
   | Commit message | `vault: {{date}}` |

   > El plugin ejecuta Git sobre la raíz del repositorio, así que también versionará
   > los cambios del sitio web. Si prefieres separar ambas cosas, mueve `vault/` a su
   > propio repositorio.

5. **Autenticación**: si el push pide credenciales, usa un
   [Personal Access Token](https://github.com/settings/tokens) de GitHub como
   contraseña, o configura una clave SSH y clona con `git@github.com:...`.

## Flujo de trabajo con Claude

1. Escribes notas en Obsidian; el plugin hace commit y push automáticamente.
2. Le pides a Claude que trabaje sobre la bóveda (resumir, reescribir, enlazar,
   crear notas nuevas). Claude hace commit y push de sus cambios.
3. Obsidian hace pull y ves los cambios en tu equipo.

**Regla práctica:** evita editar la misma nota en Obsidian y en Claude al mismo
tiempo. Si ocurre un conflicto, Obsidian Git lo marca y se resuelve como cualquier
conflicto de Git.

## Qué NO se versiona

`.gitignore` excluye el estado local de Obsidian (`workspace.json`, caché, papelera)
para que no genere conflictos entre dispositivos. La configuración compartida
—plugins, temas, atajos— sí se versiona cuando exista.
