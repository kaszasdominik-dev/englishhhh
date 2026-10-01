@echo off
setlocal
cd /d "%~dp0"

echo Starting LIVO backend...
start "LIVO Backend" cmd /k "cd /d "%~dp0backend" && python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000"

echo Starting LIVO frontend...
start "LIVO Frontend" cmd /k "cd /d "%~dp0frontend" && yarn.cmd start"

echo.
echo LIVO is starting. Open http://localhost:3000
endlocal
