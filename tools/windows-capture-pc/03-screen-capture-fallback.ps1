# 03-screen-capture-fallback.ps1 — VARIANTĂ DE BACKUP
#
# Folosește ASTA dacă softul Intotech ține capture card-ul exclusiv
# și ffmpeg nu poate accesa direct dispozitivul.
#
# Captează direct DESKTOP-ul Windows-ului unde rulează Intotech.
# Dezavantaje: ia toată fereastra Intotech (poate inclusiv chenare/butoane),
# rezoluție limitată de cea a desktop-ului.
#
# Avantaj: merge ÎNTOTDEAUNA, indiferent de capture card sau software.

$INSTALL_DIR = "C:\dispecerat-capture"
Set-Location $INSTALL_DIR

Write-Host "=== Screen capture fallback ===" -ForegroundColor Yellow
Write-Host "Captează DESKTOP-ul Windows în RTSP."
Write-Host "MediaMTX trebuie să ruleze deja (vezi 02-start.ps1)."
Write-Host ""

# Captează zona stânga-sus 1280x720 a desktop-ului (ajustează după nevoie)
# Pentru a captura ferestre specifice, folosește -i "title=NUME_FEREASTRA"
& "$INSTALL_DIR\ffmpeg.exe" `
  -hide_banner -loglevel warning `
  -f gdigrab `
  -framerate 15 `
  -offset_x 0 -offset_y 0 -video_size 1280x720 `
  -i desktop `
  -c:v libx264 -preset ultrafast -tune zerolatency `
  -b:v 1200k -maxrate 1500k -bufsize 2M `
  -pix_fmt yuv420p `
  -g 30 `
  -an `
  -f rtsp -rtsp_transport tcp `
  "rtsp://localhost:8554/desktop"
