@echo off
chcp 65001 >nul
title Juego Impostor

:menu
cls
echo ========================================
echo          JUEGO IMPOSTOR
echo ========================================
echo.
echo 1. JUGAR EN MODO LOCAL
echo 2. JUGAR EN MODO ONLINE  
echo 3. CONFIGURAR ONLINE (primera vez)
echo 4. SALIR
echo.
set /p opcion="Elige una opcion (1-4): "

if "%opcion%"=="1" goto local
if "%opcion%"=="2" goto online
if "%opcion%"=="3" goto config
if "%opcion%"=="4" exit
goto menu

:local
cls
echo ========================================
echo          MODO LOCAL
echo ========================================
echo.
echo Iniciando servidor local...
echo El juego estara en: http://localhost:3000
echo.
echo Presiona Ctrl+C para cerrar
echo.
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 >nul
cd server
D:\node-v22.20.0-win-x64\node-v22.20.0-win-x64\node.exe server.js
pause
goto menu

:online
cls
echo ========================================
echo          MODO ONLINE
echo ========================================
echo.
echo Verificando configuracion...
"D:\ngrok-v3-stable-windows-amd64\ngrok.exe" config check >nul 2>&1
if errorlevel 1 (
    echo ERROR: Ngrok no esta configurado
    echo Ejecuta la opcion 3 primero
    echo.
    pause
    goto menu
)

echo Configuracion correcta
echo Iniciando modo ONLINE...
echo.
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im ngrok.exe >nul 2>&1
timeout /t 2 >nul

cd server
start "Servidor" /min cmd /c "D:\node-v22.20.0-win-x64\node-v22.20.0-win-x64\node.exe server.js"

echo Esperando 3 segundos...
timeout /t 3 >nul

cls
echo ========================================
echo          ONLINE ACTIVADO
echo ========================================
echo.
echo Se abrira una ventana con tu URL publica
echo COMPARTE esa URL con amigos
echo.
pause

"D:\ngrok-v3-stable-windows-amd64\ngrok.exe" http 3000
goto menu

:config
cls
echo ========================================
echo       CONFIGURAR MODO ONLINE
echo ========================================
echo.
echo Para obtener tu token:
echo 1. Ve a: https://dashboard.ngrok.com/get-started/your-authtoken
echo 2. Registrate y copia el token
echo.
echo Presiona cualquier tecla para abrir la pagina...
pause >nul
start https://dashboard.ngrok.com/get-started/your-authtoken

echo.
echo Pega tu token aqui:
set /p token=Token: 

if "%token%"=="" (
    echo No se ingreso token
    pause
    goto menu
)

echo Configurando...
"D:\ngrok-v3-stable-windows-amd64\ngrok.exe" authtoken %token%

if errorlevel 1 (
    echo ERROR: Token invalido
) else (
    echo CONFIGURADO EXITOSAMENTE
    echo Ahora puedes usar modo online
)

pause
goto menu