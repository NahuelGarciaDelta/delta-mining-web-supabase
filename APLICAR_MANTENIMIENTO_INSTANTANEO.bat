@echo off
setlocal
cd /d "%~dp0"

echo.
echo ===============================================
echo DELTA MINING OPS - MANTENIMIENTO INSTANTANEO
echo ===============================================
echo.

if not exist "src\App.jsx" (
  echo ERROR: Descomprimi este ZIP en la raiz del proyecto.
  pause
  exit /b 1
)

if not exist "src\modules\mantenimiento\MantenimientoRoute.jsx" (
  echo ERROR: No se encontro MantenimientoRoute.jsx.
  pause
  exit /b 1
)

echo Ejecutando build...
call npm run build
if errorlevel 1 (
  echo.
  echo ERROR: El build fallo. No hagas push.
  pause
  exit /b 1
)

echo.
echo ===============================================
echo BUILD OK
echo ===============================================
echo.
echo Push:
echo git add src/modules/mantenimiento/MantenimientoRoute.jsx
echo git commit -m "Hacer instantaneos los filtros de mantenimiento"
echo git push origin main
echo.
pause
