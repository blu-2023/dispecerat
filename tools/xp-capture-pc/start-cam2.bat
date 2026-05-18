@echo off
REM start-cam2.bat — Capture DirectShow + RTSP server pentru CAMERA 2

setlocal
set VLC=%~dp0vlc-2.2.8\vlc.exe
set CAPTURE_NAME=NUME_CAPTURE_AICI
set RTSP_PATH=cam2
set RTSP_PORT=8555

echo === Camera 2 - RTSP server pe rtsp://localhost:%RTSP_PORT%/%RTSP_PATH% ===
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
