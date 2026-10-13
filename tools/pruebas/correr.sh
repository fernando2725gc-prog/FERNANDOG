#!/bin/bash
# Corre todas las suites y da UN resultado. Antes cada una contaba sus
# fallos a su manera, así que ejecutarlas todas no daba un resultado: daba
# veinte, y había que leerlos uno a uno.
#
#   ./correr.sh            todas
#   ./correr.sh cordura    solo esa
set -uo pipefail
cd "$(dirname "$0")"
RAIZ="$(cd ../.. && pwd)"

# El paquete tiene que estar al día: si no, las suites prueban una versión
# anterior y dan por bueno algo que ya no existe.
node "$RAIZ/tools/empaquetar.js" >/dev/null || { echo "No se pudo empaquetar."; exit 1; }

if [ $# -gt 0 ]; then SUITES=("$@"); else
  SUITES=(humo cordura tiempos bascula excel identidad autenticacion sin-servidor)
fi

fallos=0
for t in "${SUITES[@]}"; do
  [ -f "$t.js" ] || { printf '%-16s no existe\n' "$t"; fallos=$((fallos+1)); continue; }
  salida=$(timeout 600 node "$t.js" 2>&1)
  if echo "$salida" | grep -q "todo en orden"; then
    printf '%-16s verde\n' "$t"
  else
    n=$(echo "$salida" | grep -c '✗' || true)
    printf '%-16s FALLOS (%s)\n' "$t" "$n"
    echo "$salida" | grep '✗' | head -4 | sed 's/^/    /'
    fallos=$((fallos+1))
  fi
done

# Las políticas de seguridad se prueban contra Postgres, no en el navegador.
if [ -x ../pruebas-rls/ataque.sh ] && psql ${ACOPIA_PG:--h /var/tmp -p 5433 -U postgres} -c 'select 1' >/dev/null 2>&1; then
  if ../pruebas-rls/ataque.sh >/dev/null 2>&1; then
    printf '%-16s verde\n' "rls"
  else
    printf '%-16s FALLOS\n' "rls"; fallos=$((fallos+1))
  fi
else
  printf '%-16s omitida (sin PostgreSQL)\n' "rls"
fi

echo
[ $fallos -eq 0 ] && echo "Todo en orden." || echo "$fallos suite(s) con fallos."
exit $fallos
