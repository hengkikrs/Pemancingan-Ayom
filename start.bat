@echo off
title Pemancingan Ayom - Launcher
color 0B

echo.
echo  ================================================
echo    PEMANCINGAN AYOM - Starting Application...
echo  ================================================
echo.

:: Jalankan Backend di window baru
echo  [1/2] Starting Backend (FastAPI port 8000)...
start "Pemancingan Ayom - BACKEND" cmd /k "cd /d %~dp0backend && echo. && echo  === BACKEND FastAPI === && echo  URL: http://localhost:8000 && echo  Docs: http://localhost:8000/docs && echo. && python -m uvicorn main:app --reload --port 8000"

:: Tunggu sebentar agar backend siap dulu
timeout /t 3 /nobreak > nul

:: Jalankan Frontend di window baru
echo  [2/2] Starting Frontend (Vite port 5173)...
start "Pemancingan Ayom - FRONTEND" cmd /k "cd /d %~dp0frontend && echo. && echo  === FRONTEND Vite React === && echo  URL: http://localhost:5173 && echo. && npm run dev"

:: Tunggu lagi lalu buka browser
timeout /t 5 /nobreak > nul
echo.
echo  [3/3] Opening browser...
start http://localhost:5173

echo.
echo  ================================================
echo    Semua sudah berjalan!
echo    Backend  : http://localhost:8000
echo    Frontend : http://localhost:5173
echo  ================================================
echo.
pause
