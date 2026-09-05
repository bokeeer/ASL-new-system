@echo off
title ASL Tutoring Backend Server (Port 8000)
cd /d "%~dp0"
echo ========================================================
echo Starting FastAPI Backend Server on port 8000...
echo ========================================================
"C:\Users\Radny\AppData\Local\Programs\Python\Python311\Scripts\uvicorn.exe" server:app --host 0.0.0.0 --port 8000 --reload
pause
