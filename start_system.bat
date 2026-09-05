@echo off
title ASL Tutoring System - All Services Launcher
cd /d "%~dp0"
echo ========================================================
echo Starting ASL Tutoring System (Backend + Frontend)...
echo ========================================================
echo [1/2] Launching Backend Server on port 8000...
start "ASL Tutoring Backend (Port 8000)" cmd /k ""C:\Users\Radny\AppData\Local\Programs\Python\Python311\Scripts\uvicorn.exe" server:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 3 /nobreak >nul

echo [2/2] Launching Expo Frontend...
start "ASL Tutoring Frontend (Expo)" cmd /k "npx expo start"

echo ========================================================
echo Both services are now running in their own windows!
echo - Backend:  http://localhost:8000
echo - Frontend: http://localhost:8081
echo ========================================================
exit
