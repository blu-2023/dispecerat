# 02-start.ps1 — Pornește MediaMTX RTSP server în foreground
# (Vezi log-urile direct. Pentru rulare ca serviciu Windows: vezi 04-install-service.ps1)

$INSTALL_DIR = "C:\dispecerat-capture"
Set-Location $INSTALL_DIR

if (-not (Test-Path "$INSTALL_DIR\mediamtx.yml")) {
    Write-Host "EROARE: lipsește mediamtx.yml" -ForegroundColor Red
    Write-Host "  Copiază: copy mediamtx.template.yml mediamtx.yml" -ForegroundColor Yellow
    Write-Host "  Apoi editează cu numele camerei (de la 01-list-devices)" -ForegroundColor Yellow
    exit 1
}

Write-Host "=== Pornește MediaMTX ===" -ForegroundColor Cyan
Write-Host "RTSP server pe: rtsp://<IP_PC>:8554/cam1 și /cam2"
Write-Host "Ctrl+C ca să opresti"
Write-Host ""

& "$INSTALL_DIR\mediamtx.exe" "$INSTALL_DIR\mediamtx.yml"
