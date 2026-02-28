@echo off
:: VOXIS Setup Launcher
:: Requests Admin privileges and runs the PowerShell installer
setlocal EnableDelayedExpansion

:: Check for Administrative privileges
net session >nul 2>&1
if !errorlevel! neq 0 (
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\getadmin.vbs"
    "%temp%\getadmin.vbs"
    del "%temp%\getadmin.vbs"
    exit /B
)

:: Ensure we are running from the original directory even after elevation
cd /d "%~dp0"

echo Starting VOXIS Installation...
PowerShell -NoProfile -ExecutionPolicy Bypass -Command "& '.\Install-VOXIS.ps1'"

echo.
pause
