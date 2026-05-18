# 01-list-devices.ps1 — Listează toate sursele DirectShow (camere video, capture cards)
# disponibile pe Windows. Vei vedea exact numele de care MediaMTX/ffmpeg are nevoie.
#
# Rulează:
#   .\01-list-devices.ps1

$ErrorActionPreference = "Continue"
$INSTALL_DIR = "C:\dispecerat-capture"
Set-Location $INSTALL_DIR

Write-Host "=== Surse video DirectShow disponibile pe acest PC ===" -ForegroundColor Cyan
Write-Host ""

# ffmpeg -list_devices true scrie pe stderr, deci redirectam.
$output = & "$INSTALL_DIR\ffmpeg.exe" -hide_banner -list_devices true -f dshow -i dummy 2>&1
$output | Select-String -Pattern "\[dshow" | ForEach-Object { $_.ToString() -replace "^\[dshow @ [0-9a-fx]+\] ", "" }

Write-Host ""
Write-Host "=== Indicații ===" -ForegroundColor Cyan
Write-Host "  - Caută în lista de mai sus liniile cu '(video)'"
Write-Host "  - De obicei capture card-urile au nume gen:"
Write-Host "      'Pinnacle PCTV', 'AverMedia', 'Hauppauge WinTV',"
Write-Host "      'NV6010', 'TC-200', 'Geovision', 'DVR Capture', etc."
Write-Host "  - Trimite-mi LISTA ASTA copy-paste ca să configurez mediamtx.yml"
