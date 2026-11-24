#!/usr/bin/env bash
# Instala la plantilla «Historia Animada» en el Mac DENTRO de esta carpeta (Node portátil, Python con uv,
# motor de vídeo). Lo ejecuta Claude con «bash instalar/instalar.sh»: no hay que abrir nada con doble clic,
# así que el Mac no pide permisos de seguridad. Si se repite, solo completa lo que falte.
set -e
cd "$(dirname "$0")/.."
RAIZ="$PWD"
NODE_V="v24.22.0"
echo "== Historia Animada: instalación (Mac) =="

# 1) Node portátil
if [ ! -x "node/bin/node" ]; then
  ARQ="arm64"; [ "$(uname -m)" = "x86_64" ] && ARQ="x64"
  echo "Descargo Node $NODE_V ($ARQ)…"
  curl -fsSL "https://nodejs.org/dist/$NODE_V/node-$NODE_V-darwin-$ARQ.tar.gz" -o node.tar.gz
  mkdir -p node && tar -xzf node.tar.gz -C node --strip-components=1 && rm node.tar.gz
fi
export PATH="$RAIZ/node/bin:$PATH"

# 2) Motor de vídeo
echo "Instalo el motor de vídeo (unos minutos la primera vez)…"
npm ci --no-audit --no-fund --loglevel=error
npx remotion browser ensure >/dev/null 2>&1 || echo "  (el navegador del motor se descargará en el primer vídeo)"

# 3) Python con uv portátil (dentro de la carpeta)
if [ ! -x "uv/uv" ]; then
  echo "Descargo uv (gestor de Python)…"
  ARQ_UV="aarch64-apple-darwin"; [ "$(uname -m)" = "x86_64" ] && ARQ_UV="x86_64-apple-darwin"
  mkdir -p uv
  curl -fsSL "https://github.com/astral-sh/uv/releases/latest/download/uv-$ARQ_UV.tar.gz" | tar -xz -C uv --strip-components=1
fi
echo "Preparo Python y las librerías…"
[ -x .venv/bin/python ] || uv/uv venv .venv --python 3.12 --quiet
uv/uv pip install --quiet --python .venv/bin/python -r instalar/requirements.txt
echo "Descargo el modelo que escucha la voz (~500 MB, solo la primera vez)…"
.venv/bin/python -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8')" >/dev/null 2>&1 || echo "  (se descargará con la primera voz)"

# 4) El atajo «./historia»
cat > historia <<'LANZ'
#!/usr/bin/env bash
cd "$(dirname "$0")"
export PATH="$PWD/node/bin:$PATH"
exec .venv/bin/python herramientas/historia.py "$@"
LANZ
chmod +x historia
echo
./historia comprobar
