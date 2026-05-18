@echo off
REM 00-list-devices.bat — Listează plăcile de captură video instalate
REM Folosește VLC's DirectShow listing capability.

setlocal
set VLC=%~dp0vlc-2.2.8\vlc.exe

if not exist "%VLC%" (
  echo EROARE: nu gasesc VLC la calea:
  echo   %VLC%
  echo Verifica dezarhivarea kit-ului.
  pause
  exit /b 1
)

echo === Listare dispozitive DirectShow ===
echo.
echo Se deschide o fereastra VLC cu dialogul de captura.
echo Mergi la:  Media -^> Open Capture Device  (Ctrl+C)
echo In tab-ul "Capture Device", deschide combobox-ul
echo "Video device name" si vei vedea TOATE placile de
echo captura instalate pe acest PC.
echo.
echo Scrie/copiaza numele EXACT al placii tale.
echo.
echo Apasa orice tasta sa porneasca VLC...
pause >nul

"%VLC%" --intf qt --no-loop
