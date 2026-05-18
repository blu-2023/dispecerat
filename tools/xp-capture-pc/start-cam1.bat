@echo off
REM start-cam1.bat — Capture DirectShow + RTSP server pentru CAMERA 1
REM
REM INLOCUIESTE "NUME_CAPTURE_AICI" cu numele EXACT al placii de captura
REM (vezi 00-list-devices.bat).
REM
REM Daca placa are mai multe pinuri/canale (ex: Composite In 0, Composite In 1),
REM pune-l in adevarul " :dshow-vdev=NUME :dshow-config "

setlocal
set VLC=%~dp0vlc-2.2.8\vlc.exe
set CAPTURE_NAME=NUME_CAPTURE_AICI
set RTSP_PATH=cam1
set RTSP_PORT=8554

echo === Camera 1 - RTSP server pe rtsp://localhost:%RTSP_PORT%/%RTSP_PATH% ===
echo.

"%VLC%" -I dummy --no-osd ^
  dshow:// ^
  :dshow-vdev="%CAPTURE_NAME%" ^
  :dshow-adev=none ^
  :dshow-size=640x480 ^
  :dshow-fps=15 ^
  :live-caching=300 ^
  --sout "#transcode{vcodec=h264,vb=800,scale=Auto,acodec=none,fps=15,deinterlace}:rtp{sdp=rtsp://0.0.0.0:%RTSP_PORT%/%RTSP_PATH%}" ^
  --sout-keep ^
  --sout-rtp-caching=300 ^
  --rtsp-host=0.0.0.0:%RTSP_PORT%

echo.
echo VLC s-a oprit. Apasa o tasta sa inchizi fereastra.
pause >nul
