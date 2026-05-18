# Kit de instalare pe PC Windows cu capture card

Acest kit instalează **MediaMTX** (server RTSP) și **ffmpeg** pe PC-ul `192.168.8.1` (Windows + Smart DVR Intotech).

Rezultat: cele 2 camere BNC vor fi accesibile ca:
```
rtsp://192.168.8.1:8554/cam1
rtsp://192.168.8.1:8554/cam2
```

… exact așa cum aplicația noastră de dispecerat se așteaptă.

---

## Pași de urmat pe PC-ul Windows

### 0. Pregătire
- RDP pe PC-ul 192.168.8.1
- Deschide PowerShell ca **Administrator**

### 1. Copiază fișierele
Adu fișierele din folderul ăsta (`tools/windows-capture-pc/`) pe PC. Variante:
- Clonezi repo: `git clone https://github.com/blu-2023/dispecerat.git C:\repo` și folosești `C:\repo\tools\windows-capture-pc\`
- Sau descarci ZIP-ul de la https://github.com/blu-2023/dispecerat/archive/refs/heads/main.zip și extragi pe Desktop

### 2. Permite scripturi PowerShell
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force
```

### 3. Rulează instalarea
```powershell
cd <folder-cu-scripturi>
.\00-install.ps1
```
Descarcă MediaMTX (~10 MB) + ffmpeg (~80 MB) în `C:\dispecerat-capture\`.

### 4. Identifică numele capture card-ului
```powershell
.\01-list-devices.ps1
```
Vei vedea ceva de genul:
```
"NV6010 Video Capture" (video)
"NV6010 Audio Capture" (audio)
```
**Copiază numele EXACT** (cu ghilimele) și trimite-mi-l.

### 5. Configurează MediaMTX
```powershell
copy mediamtx.template.yml mediamtx.yml
notepad mediamtx.yml
```
Înlocuiește `NUME_CAPTURE_CARD_AICI` și `NUME_AL_DOILEA_CAPTURE_CARD` cu numele real.

⚠️ Dacă cele 2 canale BNC vin pe **același** dispozitiv DirectShow (cu pinuri multiple), spune-mi — adaptez config-ul.

### 6. Test în primă fază (foreground)
```powershell
.\02-start.ps1
```
- Lasă să ruleze
- De pe alt PC din rețea (sau de pe serverul nostru), testează:
  ```
  ffplay rtsp://192.168.8.1:8554/cam1
  ```
  sau în aplicația dispecerat, adaugă camera cu URL `rtsp://192.168.8.1:8554/cam1`.
- Dacă se vede imaginea → ✓
- Ctrl+C ca să oprești

### 7. Instalează ca SERVICIU Windows (auto-start la boot)
```powershell
.\04-install-service.ps1
```
De acum se pornește singur la fiecare boot. Log-urile în `C:\dispecerat-capture\mediamtx.log`.

---

## Probleme posibile

### „Could not open device" / „I/O error" la ffmpeg
Capture card-ul e ținut **EXCLUSIV** de softul Intotech.
**Soluții (în ordine):**
1. Oprește Intotech, retestează → confirmă cauza
2. Dezactivează din Intotech opțiunea „Exclusive mode" (dacă există în setări)
3. Folosește varianta **screen capture** (vezi `03-screen-capture-fallback.ps1`) — captează direct desktop-ul Windows-ului unde Intotech afișează camerele

### Lag mare / freeze
- Reduce bitrate-ul în `mediamtx.yml`: `-b:v 800k`
- Reduce framerate: adaugă `-r 15` în comanda ffmpeg
- Folosește `-preset veryfast` în loc de `ultrafast`

### Firewall blochează port 8554
```powershell
New-NetFirewallRule -DisplayName "MediaMTX RTSP" -Direction Inbound -LocalPort 8554 -Protocol TCP -Action Allow
```

### Vrei să schimbi portul
Editează `mediamtx.yml` → `rtspAddress: :8554` → schimbă cu alt port. Apoi update și firewall.

---

## Suport

Trimite-mi:
1. Output-ul de la `.\01-list-devices.ps1`
2. Versiunea de Windows (`winver`)
3. Modelul capture card-ului (de pe placă sau în Device Manager → Sound, video and game controllers)

Și-ți configurez `mediamtx.yml` exact pentru hardware-ul tău.
