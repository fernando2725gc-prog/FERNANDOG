#!/bin/sh
# Doble clic para iniciar Narvis en macOS (o ejecútalo en Linux).
cd "$(dirname "$0")"
[ -d node_modules ] || { echo "Instalando dependencias por primera vez..."; npm install; }
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Llena el archivo .env con tu clave de API y la ruta de tu bóveda de Obsidian, y vuelve a abrir este archivo."
  open -e .env 2>/dev/null || ${EDITOR:-nano} .env
  exit 0
fi
( sleep 2; open "http://localhost:${PORT:-8000}" 2>/dev/null || xdg-open "http://localhost:${PORT:-8000}" ) &
node server/index.js
