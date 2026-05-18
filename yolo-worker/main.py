"""
Dispecerat YOLO worker.

Per cameră (dintre cele cu yoloEnabled=true):
  - OpenCV citește RTSP în thread propriu (reconnect automat).
  - Motion gating: rulează YOLO doar când frame-ul curent diferă suficient
    față de precedent (economisește CPU enorm când scena e statică).
  - YOLOv8 — auto GPU dacă CUDA e disponibil, altfel CPU.
  - Detecții 'person' peste prag → eveniment broadcast pe WebSocket pentru
    consola web/Electron + POST cu audit la /api/integrations/yolo.

Reload periodic al listei de camere (la 60s) — pickup pentru camere noi.
"""
import os
import io
import json
import time
import asyncio
import threading
import logging
from datetime import datetime, timezone
from pathlib import Path

# Load .env from project root (one level up).
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
except Exception:
    pass

import requests
import cv2
import websockets
import numpy as np

try:
    import torch
except Exception:
    torch = None

try:
    from ultralytics import YOLO
except Exception:
    YOLO = None

LOG = logging.getLogger("yolo")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

WEB = os.environ.get("WEB_BASE_URL", "http://127.0.0.1:3000")
TOKEN = os.environ.get("YOLO_INGEST_TOKEN", "dev-token")
WS_HOST = os.environ.get("YOLO_WS_HOST", "0.0.0.0")
WS_PORT = int(os.environ.get("YOLO_WS_PORT", "4002"))
MODEL_NAME = os.environ.get("YOLO_MODEL", "yolov8n.pt")
CONF = float(os.environ.get("YOLO_CONFIDENCE", "0.45"))
SAMPLE_EVERY = float(os.environ.get("YOLO_SAMPLE_SECONDS", "1.5"))
COOLDOWN = float(os.environ.get("YOLO_COOLDOWN_SECONDS", "8"))
MOTION_THRESHOLD = float(os.environ.get("YOLO_MOTION_THRESHOLD", "0.012"))  # frac of pixels changed
SNAPSHOTS_DIR = Path(os.environ.get("YOLO_SNAPSHOTS_DIR", str(Path(__file__).resolve().parent / "snapshots")))
SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)


def pick_device():
    requested = os.environ.get("YOLO_DEVICE")
    if requested:
        LOG.info("device explicitly set: %s", requested)
        return requested
    if torch is not None and torch.cuda.is_available():
        try:
            name = torch.cuda.get_device_name(0)
        except Exception:
            name = "?"
        LOG.info("CUDA detected (%s) — using cuda:0", name)
        return "cuda:0"
    LOG.warning("No CUDA — falling back to CPU. Detection latency on many cameras may be high.")
    return "cpu"


DEVICE = pick_device()

clients: set = set()
clients_lock = threading.Lock()
loop_ref: asyncio.AbstractEventLoop = None  # set by main()
event_queue: "asyncio.Queue[dict]" = None
camera_threads: dict[str, "CameraThread"] = {}
model = None


def load_cameras():
    """Fetch camera list from the web app (token-protected endpoint)."""
    try:
        r = requests.get(f"{WEB}/api/cameras/public", headers={"x-yolo-token": TOKEN}, timeout=5)
        if r.ok:
            return [c for c in r.json() if c.get("yoloEnabled") and c.get("rtspUrl")]
    except Exception as e:
        LOG.warning("cannot fetch cameras: %s", e)
    return []


def post_audit(ev):
    try:
        requests.post(f"{WEB}/api/integrations/yolo", json=ev, headers={"x-yolo-token": TOKEN}, timeout=2)
    except Exception:
        pass


def save_snapshot(camera_id: str, frame) -> str | None:
    try:
        fname = SNAPSHOTS_DIR / f"{camera_id}-{int(time.time())}.jpg"
        cv2.imwrite(str(fname), frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        return str(fname)
    except Exception:
        return None


class CameraThread(threading.Thread):
    def __init__(self, cam: dict, push):
        super().__init__(daemon=True, name=f"cam:{cam['id']}")
        self.cam = cam
        self.push = push
        self.stopped = False

    def stop(self):
        self.stopped = True

    def run(self):
        rtsp = self.cam["rtspUrl"]
        cam_id = self.cam["id"]
        # alarmType drives which COCO classes we look for:
        #   person  -> [0]
        #   vehicle -> [1 bicycle, 2 car, 3 motorcycle, 5 bus, 7 truck]
        #   both    -> all of the above
        #   motion  -> no YOLO, just motion gating triggers alert
        alarm_type = (self.cam.get("alarmType") or "person").lower()
        if alarm_type == "person":
            yolo_classes = [0]
            class_to_label = {0: "person"}
        elif alarm_type == "vehicle":
            yolo_classes = [1, 2, 3, 5, 7]
            class_to_label = {1: "bicycle", 2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}
        elif alarm_type == "both":
            yolo_classes = [0, 1, 2, 3, 5, 7]
            class_to_label = {0: "person", 1: "bicycle", 2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}
        else:  # motion or unknown
            yolo_classes = None
            class_to_label = {}

        last_emit = 0.0
        last_gray = None
        # Anti-false-positive: require N consecutive detections above HIGH conf.
        # Resets after a gap >5s without detection.
        consecutive_hits = 0
        last_hit_at = 0.0
        REQUIRED_HITS = int(os.environ.get("YOLO_REQUIRED_HITS", "2"))
        HIGH_CONF = float(os.environ.get("YOLO_HIGH_CONFIDENCE", "0.65"))
        # Size filter: ignore detections that occupy too little or too much of the frame
        MIN_BBOX_RATIO = float(os.environ.get("YOLO_MIN_BBOX_RATIO", "0.01"))   # 1% of frame area
        MAX_BBOX_RATIO = float(os.environ.get("YOLO_MAX_BBOX_RATIO", "0.6"))    # 60% of frame area

        cap = cv2.VideoCapture(rtsp)
        LOG.info("opened %s alarm=%s req_hits=%d conf>=%.2f (%s)", cam_id, alarm_type, REQUIRED_HITS, HIGH_CONF, "ok" if cap.isOpened() else "FAILED")
        while not self.stopped:
            if not cap.isOpened():
                time.sleep(2)
                cap = cv2.VideoCapture(rtsp)
                continue
            ok, frame = cap.read()
            if not ok:
                cap.release()
                time.sleep(2)
                cap = cv2.VideoCapture(rtsp)
                continue
            time.sleep(SAMPLE_EVERY)

            # Motion gate to skip inference on static scenes.
            small = cv2.resize(frame, (160, 90))
            gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
            motion_detected = False
            if last_gray is not None:
                diff = cv2.absdiff(gray, last_gray)
                changed = np.count_nonzero(diff > 15) / diff.size
                motion_detected = changed > MOTION_THRESHOLD
            last_gray = gray

            # Motion-only alarmType: alert on any motion above threshold.
            if alarm_type == "motion":
                if motion_detected and time.time() - last_emit > COOLDOWN:
                    last_emit = time.time()
                    snap = save_snapshot(cam_id, frame)
                    ev = {
                        "cameraId": cam_id,
                        "label": "motion",
                        "confidence": 1.0,
                        "ts": datetime.now(timezone.utc).isoformat(),
                        "snapshotPath": snap,
                    }
                    LOG.info("MOTION %s", cam_id)
                    self.push(ev)
                continue

            # YOLO path — need motion to run inference (saves CPU).
            if not motion_detected or model is None:
                continue

            try:
                results = model.predict(
                    source=frame, conf=CONF, device=DEVICE, verbose=False,
                    classes=yolo_classes,
                )
            except Exception as e:
                LOG.warning("inference error %s: %s", cam_id, e)
                continue

            h, w = frame.shape[:2]
            frame_area = float(h * w)
            best = 0.0
            best_label = "object"
            valid_hit = False
            for r in results:
                for box in r.boxes:
                    conf = float(box.conf.item())
                    # Filter by size: too small/large bboxes are likely noise/false
                    xyxy = box.xyxy[0].tolist()
                    bw = max(0, xyxy[2] - xyxy[0])
                    bh = max(0, xyxy[3] - xyxy[1])
                    area_ratio = (bw * bh) / frame_area if frame_area > 0 else 0
                    if area_ratio < MIN_BBOX_RATIO or area_ratio > MAX_BBOX_RATIO:
                        continue  # implausible size
                    if conf > best:
                        best = conf
                        cls_id = int(box.cls.item())
                        best_label = class_to_label.get(cls_id, f"class_{cls_id}")
                        if conf >= HIGH_CONF:
                            valid_hit = True

            # Reset consecutive counter if we lost track for >5s
            now = time.time()
            if now - last_hit_at > 5.0:
                consecutive_hits = 0

            if valid_hit:
                consecutive_hits += 1
                last_hit_at = now
                LOG.info("HIT %s %s conf=%.2f (%d/%d)", cam_id, best_label, best, consecutive_hits, REQUIRED_HITS)
            else:
                # If no high-conf this frame, decay
                if best > 0:
                    LOG.debug("low-conf %s %s conf=%.2f (ignored)", cam_id, best_label, best)
                continue

            if consecutive_hits >= REQUIRED_HITS and now - last_emit > COOLDOWN:
                last_emit = time.time()
                snap = save_snapshot(cam_id, frame)
                ev = {
                    "cameraId": cam_id,
                    "label": best_label,
                    "confidence": round(best, 3),
                    "ts": datetime.now(timezone.utc).isoformat(),
                    "snapshotPath": snap,
                }
                LOG.info("DETECT %s %s conf=%.2f hits=%d", cam_id, best_label, best, consecutive_hits)
                self.push(ev)
                # Reset hit counter after emitting to require fresh confirmation
                consecutive_hits = 0
        try:
            cap.release()
        except Exception:
            pass


def push_factory():
    def push(ev):
        if loop_ref is None:
            return
        loop_ref.call_soon_threadsafe(event_queue.put_nowait, ev)
    return push


async def ws_handler(ws):
    with clients_lock:
        clients.add(ws)
    LOG.info("ws client connected (%d total)", len(clients))
    try:
        async for _ in ws:
            pass
    finally:
        with clients_lock:
            clients.discard(ws)


async def broadcaster():
    while True:
        ev = await event_queue.get()
        with clients_lock:
            targets = list(clients)
        msg = json.dumps(ev)
        for ws in targets:
            try:
                await ws.send(msg)
            except Exception:
                pass
        await asyncio.to_thread(post_audit, ev)


async def reload_loop():
    """Periodically reload cameras and start/stop threads."""
    push = push_factory()
    while True:
        cams = load_cameras()
        ids = {c["id"] for c in cams}
        # stop removed
        for cid in list(camera_threads.keys()):
            if cid not in ids:
                camera_threads[cid].stop()
                del camera_threads[cid]
                LOG.info("stopped removed camera %s", cid)
        # start new
        for cam in cams:
            if cam["id"] not in camera_threads:
                t = CameraThread(cam, push)
                camera_threads[cam["id"]] = t
                t.start()
                LOG.info("started camera %s (%s)", cam["id"], cam["name"])
        await asyncio.sleep(60)


async def main():
    global loop_ref, event_queue, model
    loop_ref = asyncio.get_running_loop()
    event_queue = asyncio.Queue()

    if YOLO is None:
        LOG.error("ultralytics not installed — install with `pip install ultralytics` and restart.")
    else:
        LOG.info("loading model %s on %s", MODEL_NAME, DEVICE)
        model = YOLO(MODEL_NAME)

    asyncio.create_task(broadcaster())
    asyncio.create_task(reload_loop())
    LOG.info("ws server on %s:%d", WS_HOST, WS_PORT)
    async with websockets.serve(ws_handler, WS_HOST, WS_PORT):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
