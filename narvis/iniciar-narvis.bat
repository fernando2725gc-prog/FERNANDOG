@echo off
rem Doble clic para iniciar Narvis en Windows.
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando dependencias por primera vez...
  call npm install
)
if not exist .env (
  copy .env.example .env >nul
  echo Llena el archivo .env con tu clave de API y la ruta de tu boveda de Obsidian.
  notepad .env
)
rem Abre el navegador cuando el servidor ya esta escuchando.
start "" cmd /c "timeout /t 2 >nul & start http://localhost:8000"
node server\index.js
pause
