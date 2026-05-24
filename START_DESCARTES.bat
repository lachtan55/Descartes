@echo off
setlocal

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

if not exist "%ROOT%\Database\pocketbase.exe" (
  echo PocketBase was not found at:
  echo   %ROOT%\Database\pocketbase.exe
  echo.
  echo Edit START_DESCARTES.bat and set ROOT to your Descartes folder.
  pause
  exit /b 1
)

start "Descartes - PocketBase" powershell.exe -NoExit -ExecutionPolicy Bypass -Command "Set-Location -LiteralPath '%ROOT%\Database'; .\pocketbase.exe serve"

timeout /t 3 /nobreak >nul
start "Descartes - Backend" powershell.exe -NoExit -ExecutionPolicy Bypass -Command "Set-Location -LiteralPath '%ROOT%'; . .\venv\Scripts\Activate.ps1; uvicorn backend.main:app --reload --port 8000"

timeout /t 3 /nobreak >nul
start "Descartes - Frontend" powershell.exe -NoExit -ExecutionPolicy Bypass -Command "$env:PATH = 'C:\Program Files\nodejs;' + $env:PATH; Set-Location -LiteralPath '%ROOT%\frontend'; npm run dev"

timeout /t 5 /nobreak >nul
start "" "http://localhost:5173"

endlocal
