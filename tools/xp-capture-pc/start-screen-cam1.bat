@echo off
REM start-screen-cam1.bat — FALLBACK pentru cand DirectShow e blocat
REM
REM Captureaza o REGIUNE A ECRANULUI (unde softul Intotech afiseaza cam1).
REM Ajustezi screen-top / screen-left / screen-width / screen-height
REM dupa pozitia ferestrei Intotech pe ecran.

setlocal
set VLC=%~dp0vlc-2.2.8\vlc.exe
set RTSP_PATH=cam1
set RTSP_PORT=8554

REM Zona ecran capturata: top=10 left=10 latime=640 inaltime=480
REM Modifica daca Intotech afiseaza camerele in alta zona.
set SX=10
set SY=10
set SW=640
set SH=480

echo === Camera 1 (SCREEN CAPTURE) - rtsp://localhost:%RTSP_PORT%/%RTSP_PATH% ===
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
