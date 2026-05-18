# 01-discover.ps1 — Detectează SQL Server + schema Sempral
#
# RULEAZĂ pe PC-ul Sempral (Windows 7+).
# Cere PowerShell ca Administrator (recomandat) sau standard.
#
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
#   .\01-discover.ps1
#
# Output: discovery.txt — lista de instanțe SQL găsite + tabele + coloane.
# Trimite-mi discovery.txt ca să-ți generez sync-ul exact.

$ErrorActionPreference = "Continue"
$out = "C:\sempral-sync\discovery.txt"
New-Item -ItemType Directory -Force -Path "C:\sempral-sync" | Out-Null

function Section($t) { "`n=== $t ===" | Tee-Object -FilePath $out -Append }
function W($t) { $t | Tee-Object -FilePath $out -Append }

"# Sempral SEKA Discovery Report" | Out-File $out
"Generat: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Tee-Object -FilePath $out -Append
"Computer: $env:COMPUTERNAME" | Tee-Object -FilePath $out -Append
"User: $env:USERNAME" | Tee-Object -FilePath $out -Append

# 1. Detectează servicii SQL Server local
Section "1. Servicii SQL Server instalate"
Get-Service | Where-Object { $_.Name -like "MSSQL*" -or $_.Name -like "SQL*" } |
  Select-Object Name, Status, StartType, DisplayName |
  Format-Table -AutoSize | Out-String | Tee-Object -FilePath $out -Append

# 2. Detectează instanțe SQL Server
Section "2. Instanțe SQL Server (din registry)"
$instances = @()
try {
  $key = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL"
  if (Test-Path $key) {
    $instances = (Get-ItemProperty $key).PSObject.Properties |
      Where-Object { $_.Name -notmatch "^PS" } |
      Select-Object -ExpandProperty Name
  }
} catch {}
if ($instances) {
  $instances | ForEach-Object { W "  - $_" }
} else {
  W "  Niciuna detectată în registry."
}

# 3. Încearcă conectare la fiecare instanță locală cu Windows Auth
Section "3. Test conectare (Windows Authentication)"
$candidates = @(".\SQLEXPRESS", "(local)", "localhost", "(local)\SQLEXPRESS", ".\MSSQLSERVER")
foreach ($i in $instances) { $candidates += ".\$i"; $candidates += "$env:COMPUTERNAME\$i" }
$candidates = $candidates | Sort-Object -Unique

$workingInstance = $null
foreach ($inst in $candidates) {
  W ""
  W "Testez: $inst"
  try {
    $cn = New-Object System.Data.SqlClient.SqlConnection
    $cn.ConnectionString = "Server=$inst;Integrated Security=true;Connection Timeout=3;Encrypt=false"
    $cn.Open()
    W "  ✓ CONECTAT cu Windows Auth"
    if (-not $workingInstance) { $workingInstance = $inst }
    $cn.Close()
  } catch {
    W "  ✗ $($_.Exception.Message.Split([Environment]::NewLine)[0])"
  }
}

if (-not $workingInstance) {
  W ""
  W "============================================================"
  W "ATENȚIE: Nicio instanță SQL nu acceptă Windows Authentication."
  W "Posibile cauze:"
  W "  1. SQL Server nu rulează (vezi pct 1 — status Running?)"
  W "  2. SQL Server cere SQL Authentication (user/parolă)"
  W "  3. SQL Server e pe alt computer din rețea"
  W ""
  W "Dacă știi credentialele SQL, editează ACEST script:"
  W "   Modifică linia '\$workingInstance = \$null' la:"
  W "   \$workingInstance = 'localhost'  # sau numele exact instanță"
  W "  Și înlocuiește în secțiunea 4 'Integrated Security=true' cu:"
  W "   'User Id=USER;Password=PAROLA;'"
  W "============================================================"
  return
}

# 4. Listează DB-urile, tabelele și coloanele
Section "4. Baze de date pe $workingInstance"
$cn = New-Object System.Data.SqlClient.SqlConnection
$cn.ConnectionString = "Server=$workingInstance;Integrated Security=true;Connection Timeout=10;Encrypt=false"
$cn.Open()

$cmd = $cn.CreateCommand()
$cmd.CommandText = "SELECT name FROM sys.databases WHERE database_id > 4 ORDER BY name"  # skip system DBs
$reader = $cmd.ExecuteReader()
$dbs = @()
while ($reader.Read()) { $dbs += $reader["name"] }
$reader.Close()

if ($dbs.Count -eq 0) {
  W "Nicio DB user-defined găsită."
  $cn.Close()
  return
}
$dbs | ForEach-Object { W "  - $_" }

# 5. Pentru DB-urile candidate (probabil Sempral), listează schema
Section "5. Schema bazelor de date candidate"
$candidates = $dbs | Where-Object { $_ -match "sempral|seka|sky|alarm|monitor|dispatch|sentinel" }
if ($candidates.Count -eq 0) {
  W "Nicio DB cu nume tipic Sempral — listez TOATE:"
  $candidates = $dbs
}

foreach ($db in $candidates) {
  W ""
  W "------- DB: $db -------"
  $cmd.CommandText = "USE [$db]; SELECT TABLE_NAME, (SELECT COUNT(*) FROM sys.tables WHERE name=t.TABLE_NAME) as exists_check FROM INFORMATION_SCHEMA.TABLES t WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME"
  $r = $cmd.ExecuteReader()
  $tables = @()
  while ($r.Read()) { $tables += $r["TABLE_NAME"] }
  $r.Close()

  W "Tabele ($($tables.Count) total):"
  $tables | ForEach-Object { W "  • $_" }

  W ""
  W "Coloane în tabele candidate (Client/Subscriber/Event):"
  $tableCandidates = $tables | Where-Object {
    $_ -match "client|subscriber|customer|abonat|location|object|obiectiv|account|cont|partition|zone|zona|contact|persoana|event|alarm|alarma|history"
  }
  foreach ($t in $tableCandidates) {
    $cmd.CommandText = "USE [$db]; SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='$t' ORDER BY ORDINAL_POSITION"
    $r = $cmd.ExecuteReader()
    $cols = @()
    while ($r.Read()) { $cols += "$($r['COLUMN_NAME']):$($r['DATA_TYPE'])" }
    $r.Close()
    W "  [$t] $($cols -join ', ')"
  }

  # Sample rowcount pe candidate
  W ""
  W "Număr rânduri în tabele candidate:"
  foreach ($t in $tableCandidates) {
    try {
      $cmd.CommandText = "USE [$db]; SELECT COUNT(*) FROM [$t]"
      $cnt = $cmd.ExecuteScalar()
      W "  $t : $cnt"
    } catch {}
  }
}

$cn.Close()

W ""
W "============================================================"
W "GATA. Raportul e salvat în: $out"
W ""
W "Trimite-mi conținutul lui (copy/paste sau atașează fișierul)"
W "și-ți generez sync-ul exact pentru schema ta."
W "============================================================"

Write-Host ""
Write-Host "Output complet salvat: $out" -ForegroundColor Green
Start-Process "notepad.exe" "$out"
