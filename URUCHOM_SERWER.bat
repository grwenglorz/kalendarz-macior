@echo off
title Uruchamianie Kalkulatora Prosnosci Swin
cd /d "%~dp0"

:: Sprawdzenie czy mamy uprawnienia administratora
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Odblokowywanie portu 8080 w Zaporze Windows...
    netsh advfirewall firewall delete rule name="KalkulatorProsnosci" >nul 2>&1
    netsh advfirewall firewall add rule name="KalkulatorProsnosci" dir=in action=allow protocol=TCP localport=8080 >nul 2>&1
    echo [OK] Zapora Windows odblokowana dla telefonu!
    echo.
    powershell -ExecutionPolicy Bypass -File server.ps1
) else (
    echo Uruchamianie procedury odblokowania portu w Zaporze Windows...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)
