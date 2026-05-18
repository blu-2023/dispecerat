# 04-install-service.ps1 — Pornește MediaMTX ca SERVICIU WINDOWS
# (pornește automat la boot, rulează în background fără să rămâi logat pe PC)
#
# Rulează în PowerShell ca ADMINISTRATOR.
#
# Folosește NSSM (Non-Sucking Service Manager) pentru wrapping ca serviciu.

$ErrorActionPreference = "Stop"
$INSTALL_DIR = "C:\dispecerat-capture"
Set-Location $INSTALL_DIR

# Verifică drepturi admin
$me = [Security.Principal.WindowsIdentity]::GetCurrent()
$role = New-Object Security.Principal.WindowsPrincipal $me
if (-not $role.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "EROARE: Trebuie să rulezi ca Administrator." -ForegroundColor Red
    exit 1
}

# Descarcă NSSM dacă lipsește
if (-not (Test-Path "$INSTALL_DIR\nssm.exe")) {
    Write-Host "Descarcă NSSM..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri "https://nssm.cc/release/nssm-2.24.zip" -OutFile "nssm.zip" -UseBasicParsing
    Expand-Archive -Path "nssm.zip" -DestinationPath . -Force
    Copy-Item -Force "nssm-2.24\win64\nssm.exe" .
    Remove-Item -Recurse -Force "nssm-2.24"
    Remove-Item "nssm.zip"
}

$svcName = "DispeceratCapture"

# Dacă serviciul există deja, oprește-l
$existing = Get-Service -Name $svcName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Serviciu existent găsit, îl șterg..." -ForegroundColor Yellow
    & "$INSTALL_DIR\nssm.exe" stop $svcName 2>$null
    & "$INSTALL_DIR\nssm.exe" remove $svcName confirm 2>$null
}

Write-Host "Instalez serviciu '$svcName'..." -ForegroundColor Cyan
& "$INSTALL_DIR\nssm.exe" install $svcName "$INSTALL_DIR\mediamtx.exe" "$INSTALL_DIR\mediamtx.yml"
& "$INSTALL_DIR\nssm.exe" set $svcName AppDirectory "$INSTALL_DIR"
& "$INSTALL_DIR\nssm.exe" set $svcName Start SERVICE_AUTO_START
& "$INSTALL_DIR\nssm.exe" set $svcName AppStdout "$INSTALL_DIR\mediamtx.log"
& "$INSTALL_DIR\nssm.exe" set $svcName AppStderr "$INSTALL_DIR\mediamtx.log"
& "$INSTALL_DIR\nssm.exe" set $svcName AppRotateFiles 1
& "$INSTALL_DIR\nssm.exe" set $svcName AppRotateBytes 10485760

Start-Service -Name $svcName

Write-Host ""
Write-Host "✓ Serviciu pornit. Status:" -ForegroundColor Green
Get-Service -Name $svcName | Format-Table -AutoSize

Write-Host "Log-uri în: $INSTALL_DIR\mediamtx.log" -ForegroundColor Cyan
Write-Host "Pentru oprire:  Stop-Service $svcName"
Write-Host "Pentru repornire: Restart-Service $svcName"
