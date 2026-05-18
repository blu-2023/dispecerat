# 00-install.ps1 — Setup MediaMTX + ffmpeg pe Windows PC cu capture card
# Rulează în PowerShell ca Administrator pe PC-ul cu capture card (192.168.8.1).
#
# Ce face:
#   1. Creează C:\dispecerat-capture
#   2. Descarcă MediaMTX (RTSP server) și ffmpeg
#   3. Le pune în PATH (în folder-ul nostru)
#   4. Pregătește config-ul inițial
#
# Rulează:
#   Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force
#   .\00-install.ps1

$ErrorActionPreference = "Stop"
$INSTALL_DIR = "C:\dispecerat-capture"

Write-Host "=== Setup Dispecerat Capture ===" -ForegroundColor Cyan

# 1. Folder
New-Item -ItemType Directory -Force -Path $INSTALL_DIR | Out-Null
Set-Location $INSTALL_DIR

# 2. MediaMTX
Write-Host "`n[1/3] Descarcă MediaMTX..." -ForegroundColor Yellow
$mediamtxUrl = "https://github.com/bluenviron/mediamtx/releases/download/v1.13.1/mediamtx_v1.13.1_windows_amd64.zip"
Invoke-WebRequest -Uri $mediamtxUrl -OutFile "mediamtx.zip" -UseBasicParsing
Expand-Archive -Path "mediamtx.zip" -DestinationPath . -Force
Remove-Item "mediamtx.zip"
Write-Host "  ✓ MediaMTX instalat" -ForegroundColor Green

# 3. ffmpeg (build static)
Write-Host "`n[2/3] Descarcă ffmpeg..." -ForegroundColor Yellow
$ffmpegUrl = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
Invoke-WebRequest -Uri $ffmpegUrl -OutFile "ffmpeg.zip" -UseBasicParsing
Expand-Archive -Path "ffmpeg.zip" -DestinationPath . -Force
Remove-Item "ffmpeg.zip"
# Mută binarele într-un folder predictibil
$ffmpegSubdir = Get-ChildItem -Directory -Filter "ffmpeg-*" | Select-Object -First 1
if ($ffmpegSubdir) {
    Move-Item -Path "$($ffmpegSubdir.FullName)\bin\*" -Destination $INSTALL_DIR -Force
    Remove-Item -Recurse -Force $ffmpegSubdir.FullName
}
Write-Host "  ✓ ffmpeg instalat" -ForegroundColor Green

# 4. Test
Write-Host "`n[3/3] Verificări..." -ForegroundColor Yellow
& "$INSTALL_DIR\mediamtx.exe" --version 2>&1 | Select-Object -First 1
& "$INSTALL_DIR\ffmpeg.exe" -version 2>&1 | Select-Object -First 1

Write-Host "`n=== GATA ===" -ForegroundColor Green
Write-Host "Instalate în: $INSTALL_DIR" -ForegroundColor Green
Write-Host ""
Write-Host "URMĂTORII PAȘI:" -ForegroundColor Cyan
Write-Host "  1. Rulează: .\01-list-devices.ps1  → vezi numele capture card-ului"
Write-Host "  2. Editează: mediamtx.yml  → pune numele corect"
Write-Host "  3. Rulează: .\02-start.ps1   → pornește serverul RTSP"
