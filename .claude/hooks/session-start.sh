#!/bin/bash
# =========================================================================
# Deja la sesión lista para trabajar en Acopia.
#
# El proyecto no tiene dependencias que instalar —no hay package.json, y es
# a propósito—, pero sí necesita tres cosas levantadas para poder probar
# nada, y montarlas a mano cuesta media hora cada vez:
#
#   · PostgreSQL con el esquema y las políticas. Las políticas de seguridad
#     están escritas en SQL y solo se pueden verificar ejecutándolas: contra
#     una imitación en JavaScript, lo que se probaría es la imitación.
#   · Un servidor sobre la raíz del repositorio, para abrir app/ con las dos
#     aplicaciones por separado.
#   · Otro sobre docs/, que es el sitio publicado tal como lo sirve GitHub
#     Pages: ahí es donde se comprueban el service worker y el uso sin señal.
#
# Es idempotente: si algo ya está en marcha, lo deja estar.
# =========================================================================
set -euo pipefail

RAIZ="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PGDATA=/var/tmp/pgdata
PGBIN=/usr/lib/postgresql/16/bin
PGPUERTO=5433
PGSOCK=/var/tmp

aviso() { echo "  $*"; }

# ------------------------------------------------------------ PostgreSQL

if [ -x "$PGBIN/initdb" ]; then
  if [ ! -s "$PGDATA/PG_VERSION" ]; then
    aviso "PostgreSQL: creando el cluster"
    rm -rf "$PGDATA"
    mkdir -p "$PGDATA"
    # initdb se niega a correr como root, así que el cluster es de `postgres`.
    id postgres >/dev/null 2>&1 || useradd -m postgres
    chown postgres "$PGDATA"
    chmod 700 "$PGDATA"
    su postgres -c "$PGBIN/initdb -D $PGDATA -A trust -U postgres" >/dev/null
  fi

  # `pg_ctl status` mira el pid del cluster; `pg_isready` solo intenta
  # conectarse, y falla también cuando el servidor está arrancando. Con el
  # segundo, arrancarlo dos veces soltaba un «another server might be
  # running» cada vez que se reanudaba la sesión.
  if ! su postgres -c "$PGBIN/pg_ctl -D $PGDATA status" >/dev/null 2>&1; then
    aviso "PostgreSQL: arrancando en el puerto $PGPUERTO"
    chown postgres "$PGSOCK" 2>/dev/null || true
    su postgres -c "$PGBIN/pg_ctl -D $PGDATA -o '-p $PGPUERTO -k $PGSOCK' -l /var/tmp/pg.log -w start" >/dev/null
  fi

  if "$PGBIN/pg_isready" -h "$PGSOCK" -p "$PGPUERTO" >/dev/null 2>&1; then
    aviso "PostgreSQL: cargando esquema y políticas"
    for f in tools/pruebas-rls/01-andamiaje-supabase.sql tools/supabase.sql tools/supabase-auth.sql; do
      # Los avisos de «ya existe» son lo normal al reejecutar: psql los
      # imprime con el nombre del archivo delante, así que no basta con
      # anclar al principio de la línea.
      psql -h "$PGSOCK" -p "$PGPUERTO" -U postgres -q -v ON_ERROR_STOP=1 \
        -f "$RAIZ/$f" 2>&1 | grep -v "NOTICE:" || true
    done
  else
    aviso "PostgreSQL: no arrancó (ver /var/tmp/pg.log). Las pruebas de seguridad no correrán."
  fi
else
  aviso "PostgreSQL: no está instalado. Las pruebas de seguridad no correrán."
fi

# --------------------------------------------------------- servidores web

servir() {  # servir <puerto> <carpeta> <nombre>
  local puerto="$1" carpeta="$2" nombre="$3"
  if curl -s -o /dev/null --max-time 2 "http://localhost:$puerto/" 2>/dev/null; then
    return 0
  fi
  aviso "Servidor $nombre: puerto $puerto"
  (cd "$carpeta" && nohup python3 -m http.server "$puerto" >/dev/null 2>&1 &)
}

servir 8199 "$RAIZ" "aplicación"
[ -d "$RAIZ/docs" ] && servir 8202 "$RAIZ/docs" "sitio publicado"

# ------------------------------------------------------------- variables

if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  {
    echo "export ACOPIA_BASE=http://localhost:8199/app"
    echo "export ACOPIA_SITIO=http://localhost:8202"
    echo "export ACOPIA_PG='-h /var/tmp -p 5433 -U postgres'"
    # Las pruebas abren Chromium; la ruta cambia con la versión del
    # contenedor, así que se resuelve ahora y no se escribe a mano.
    for c in /opt/pw-browsers/chromium-*/chrome-linux/chrome; do
      [ -x "$c" ] && echo "export ACOPIA_CHROMIUM=$c" && break
    done
  } >> "$CLAUDE_ENV_FILE"
fi

aviso "Listo. Pruebas: tools/pruebas/correr.sh"
