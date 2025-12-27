@echo off
REM TRAVE SOCIAL - COMPLETE AUTOMATION STARTER
REM Auto-starts everything and verifies all systems

title Trave Social - Complete Automation
cls

echo.
echo ════════════════════════════════════════════════════════════════
echo     TRAVE SOCIAL - COMPLETE AUTOMATION SYSTEM
echo ════════════════════════════════════════════════════════════════
echo.

cd /d "%~dp0"

echo [1/3] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not installed
    pause
    exit /b 1
)
echo ✓ Node.js found

echo.
echo [2/3] Installing dependencies...
npm list jsonwebtoken >nul 2>&1
if errorlevel 1 (
    echo Installing packages...
    call npm install
)
echo ✓ Dependencies ready

echo.
echo [3/3] Starting complete automation...
echo.

node START_EVERYTHING.js

pause
