@echo off
REM start-screen-cam2.bat — FALLBACK pentru camera 2 (screen capture)
REM Modifica SX/SY/SW/SH ca sa indici zona unde Intotech afiseaza cam2.

setlocal
set VLC=%~dp0vlc-2.2.8\vlc.exe
set RTSP_PATH=cam2
set RTSP_PORT=8555

REM Zona ecran: ajusteaza pentru pozitia cam2 in fereastra Intotech.
REM Exemplu: daca cam1 e stanga si cam2 e dreapta, pune left = 640.
set SX=660
set SY=10
set SW=640
set SH=480

echo === Camera 2 (SCREEN CAPTURE) - rtsp://localhost:%RTSP_PORT%/%RTSP_PATH% ===
echo Capturez zona ecran: %SX%,%SY% - %SW%x%SH%
echo.

"%VLC%" -I dummy --no-osd ^
  screen:// ^
  :screen-top=%SY% :screen-left=%SX% ^
  :screen-width=%SW% :screen-height=%SH% ^
  :screen-fps=10 ^
  :live-caching=300 ^
  --sout "#transcode{vcodec=h264,vb=600,acodec=none,fps=10}:rtp{sdp=rtsp://0.0.0.0:%RTSP_PORT%/%RTSP_PATH%}" ^
  --sout-keep ^
  --rtsp-host=0.0.0.0:%RTSP_PORT%

pause >nul
