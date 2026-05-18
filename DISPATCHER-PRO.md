# Dispatcher Pro — Video Wall + YOLO + Desktop

Această extensie adaugă peste `vmax-edge` modulul de monitorizare video pro:

- **Cameră (CRUD)** legate de obiective
- **Video Wall** — grilă live RTSP pe oricâte monitoare
- **YOLO human detection** (auto-CPU acum, auto-GPU când A5000 e detectată)
- **Alerte sonore + vizuale** pe tile-ul camerei
- **Aplicație desktop** Electron care încarcă consola și deschide ferestre wall fullscreen per monitor

## Arhitectura serviciilor

```
                     ┌────────────────────┐
                     │  Next.js web app   │  :3000
                     │  /cameras /api/... │
                     └─────────┬──────────┘
                               │  /api/cameras/public (token-protected)
                               │  /api/integrations/yolo (audit POST)
                     ┌─────────┴──────────┐
              ┌──────▼──────┐      ┌──────▼─────┐
              │ stream-proxy│      │ yolo-worker│
              │ :4011       │      │ :4002 (WS) │
              │ ffmpeg×N    │      │ ultralytics│
              │ RTSP→MPEG-TS│      │ CPU/CUDA   │
              └──────┬──────┘      └────────────┘
                     │ HTTP MPEG-TS
                     ▼
               ┌──────────────┐         ┌─────────────────┐
               │ Browser/UI   │◄────────│ Electron desktop│ (optional)
               │ jsmpeg+canvas│   WS    │ multi-window    │
               └──────────────┘         └─────────────────┘
```

## Pornire (toate serviciile)

```bash
# Terminal 1 — Next.js
cd /root/dispecerat
npm run dev

# Terminal 2 — Stream proxy
cd /root/dispecerat/stream-proxy
node server.js

# Terminal 3 — YOLO worker
cd /root/dispecerat/yolo-worker
.venv/bin/python main.py

# Terminal 4 — Electron (pe stația de dispecerat cu monitoare)
cd /root/dispecerat/desktop
npm install        # one-time
npm start
```

Acces în browser: **http://192.168.1.100:3000**

## Configurare camere

1. Login → `/cameras` → **„+ Cameră nouă"**.
2. Alege obiectivul (din Site-urile existente).
3. Introdu URL-ul RTSP (ex: `rtsp://user:parola@10.10.0.5:554/Streaming/Channels/101`).
4. Setează:
   - **Monitor**: pe ce ecran fizic apare camera (0 = primul, 1 = al doilea, etc.)
   - **Poziție**: ordinea în grila acelui monitor (0..(cols×rows-1))
   - **YOLO detection**: ON dacă vrei alertă pe persoane detectate
5. Salvează → Video Wall pickup automat (worker reîncarcă la 60s).

## Video Wall

- URL web: `/video-wall` — toate camerele într-o grilă 5×4 = 20.
- URL filtrat pe monitor: `/video-wall?monitor=0&cols=5&rows=4`
- Layout customizabil din `.env`: `WALL_COLS`, `WALL_ROWS`.

În Electron: meniu **„Video Wall" → „Deschide pe toate monitoarele"** (Ctrl+Shift+W).
Fiecare display primește o fereastră fullscreen care arată camerele cu `monitor=index`.

## YOLO worker — comportament

- Auto-detect GPU: dacă există `cuda:0`, îl folosește; altfel CPU + warning.
- **Motion gating**: scena statică nu invocă inferența — economie majoră CPU.
- **Sampling**: 1 frame/cameră la fiecare `YOLO_SAMPLE_SECONDS` (default 1.5s).
- **Cooldown alertă**: după o detecție, aceeași cameră tace `YOLO_COOLDOWN_SECONDS` (8s).
- **Confidence prag**: `YOLO_CONFIDENCE` (0.45 default).
- **Snapshot** salvat la `yolo-worker/snapshots/` la fiecare detecție.
- **Reload camere** la 60s — adaugă/scoate camere live fără restart.

### Capacitate realistă (CPU vs GPU)

| Mediu | YOLOv8n | Camere simultane realiste |
|---|---|---|
| CPU Intel Sky Lake (acest server) | ~80-150ms/inferență | **4-8** cu motion gating |
| NVIDIA A5000 24GB | ~3-5ms/inferență | **20-40+** |

Când rezolvi hardware A5000, worker-ul detectează singur și trece pe GPU.

## Tokens & securitate

`.env` are:
```
YOLO_INGEST_TOKEN="dev-token-change-me"   # SCHIMBĂ înainte de prod
```

Folosit de:
- worker → `POST /api/integrations/yolo` (audit detecții)
- worker → `GET /api/cameras/public` (listă RTSP)
- proxy → `GET /api/cameras/public` (mapare cameraId → RTSP)

## Endpoint-uri noi

| Metodă | Path | Auth | Scop |
|---|---|---|---|
| GET/POST | `/api/cameras` | sesiune | listă + creare cameră |
| GET/PATCH/DELETE | `/api/cameras/[id]` | sesiune | CRUD pe cameră |
| GET | `/api/cameras/public` | token | RTSP-uri pentru proxy/worker |
| POST | `/api/integrations/yolo` | token | scrie CameraDetection |

## Stream proxy — detalii

- Per cameraId, un singur proces ffmpeg rulează indiferent câți clienți se conectează.
- Toți clienții împart același stream → nu se consumă bandă RTSP suplimentară pe Wall.
- Dacă nu există client 10s, procesul ffmpeg este oprit (economie CPU).
- Format: `mpeg1video` + container `mpegts` — decodat în browser cu `jsmpeg` (vendor în `/public/vendor/`).

## Hardware GPU — pași de făcut

Acum sistemul nu vede A5000 (`lspci` arată doar Matrox). Fă:

1. **Power cycle complet** (oprire + scoatere alimentare + repornire).
2. **Verifică cablul 8-pin PCIe** la placă (A5000 = 230W).
3. **BIOS**: Above 4G Decoding = enabled, Primary Display = PCIe.
4. După ce `lspci | grep -i nvidia` arată placa, instalează driver-ul:
   ```bash
   sudo apt-get install -y nvidia-driver-550 nvidia-utils-550
   sudo reboot
   nvidia-smi   # trebuie să arate A5000 cu ~24GB
   ```
5. Worker-ul auto-detectează — restartează worker-ul.

## Limitări curente

- Worker-ul **nu** are mecanism de retry exponențial la SMTP/HTTP fail — eveniment pierdut dacă serverul moare.
- Stream proxy fără TLS (HTTP) — bun doar pe LAN izolat.
- Niciun control de bandwidth — 20 camere 720p @ 800kbps = ~16 Mbps proxy upstream.
- Nu există încă pagină de „Detection log" în UI — datele sunt în tabela `CameraDetection` (vezi cu `npx prisma studio`).
- Snapshot-urile YOLO se acumulează — pune cron pentru cleanup (`find yolo-worker/snapshots -mtime +7 -delete`).
