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

# AI verification — post-event clip analysis.
# When a CameraThread detects something, it pushes a job here instead of
# emitting the alert directly. The VerifierThread opens a NEW VideoCapture
# on the same RTSP, samples N frames over D seconds, classifies each,
# and emits the alert only if a majority confirms.
import queue
verification_queue: "queue.Queue[dict]" = queue.Queue(maxsize=200)
VERIFY_DURATION = float(os.environ.get("YOLO_VERIFY_SECONDS", "8"))   # how long to observe
VERIFY_FRAMES = int(os.environ.get("YOLO_VERIFY_FRAMES", "12"))      # how many samples
VERIFY_THRESHOLD = float(os.environ.get("YOLO_VERIFY_THRESHOLD", "0.50"))  # min fraction of frames that must agree
VERIFY_HIGH_CONF = float(os.environ.get("YOLO_VERIFY_HIGH_CONF", "0.55"))  # per-frame confidence threshold
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


class VerifierThread(threading.Thread):
    """Consumes detection jobs, classifies clip, emits only verified alerts.

    A job = { cameraId, rtspUrl, alarmType, primary_label, primary_confidence, snapshot_path }
    Output via push(ev) — same shape as before, plus verification metadata.
    """
    def __init__(self, push):
        super().__init__(daemon=True, name="verifier")
        self.push = push
        self.stopped = False

    def stop(self):
        self.stopped = True

    def run(self):
        LOG.info("verifier thread started (frames=%d duration=%.1fs threshold=%.2f)",
                 VERIFY_FRAMES, VERIFY_DURATION, VERIFY_THRESHOLD)
        while not self.stopped:
            try:
                job = verification_queue.get(timeout=1)
            except queue.Empty:
                continue
            try:
                self._verify(job)
            except Exception as e:
                LOG.exception("verifier crashed on %s: %s", job.get("cameraId"), e)

    def _verify(self, job: dict):
        cam_id = job["cameraId"]
        rtsp = job["rtspUrl"]
        alarm_type = job.get("alarmType", "person")
        primary_label = job.get("primary_label", "object")

        if alarm_type == "person":
            yolo_classes = [0]
        elif alarm_type == "vehicle":
            yolo_classes = [1, 2, 3, 5, 7]
        elif alarm_type == "both":
            yolo_classes = [0, 1, 2, 3, 5, 7]
        else:
            yolo_classes = [0, 1, 2, 3, 5, 7, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]

        LABELS = {0: "person", 1: "bicycle", 2: "car", 3: "motorcycle", 5: "bus", 7: "truck",
                  14: "bird", 15: "cat", 16: "dog", 17: "horse", 18: "sheep", 19: "cow",
                  20: "elephant", 21: "bear", 22: "zebra", 23: "giraffe"}
        ANIMAL_IDS = {14, 15, 16, 17, 18, 19, 20, 21, 22, 23}
        PERSON_IDS = {0}
        VEHICLE_IDS = {1, 2, 3, 5, 7}

        # Open a fresh capture for verification. Use SUB-stream to avoid hammering
        # the DVR with multiple HD-mainstream connections (some DVRs limit to 4-8
        # parallel clients per channel). For Hikvision URLs like /Streaming/Channels/N01
        # the equivalent substream is /Streaming/Channels/N02. Dahua substream is subtype=1.
        verify_rtsp = rtsp
        # Hikvision: change last digit 1→2 in /Channels/NN01
        import re as _re
        verify_rtsp = _re.sub(r'(/Streaming/Channels/\d+)01(?=\b|$)', r'\g<1>02', verify_rtsp)
        # Dahua: subtype=0 → subtype=1
        verify_rtsp = _re.sub(r'subtype=0\b', 'subtype=1', verify_rtsp)

        cap = cv2.VideoCapture(verify_rtsp)
        if not cap.isOpened():
            LOG.warning("verifier could not open %s — trying mainstream fallback", cam_id)
            cap = cv2.VideoCapture(rtsp)
            if not cap.isOpened():
                LOG.warning("verifier could not open %s on either stream — suppressing alert", cam_id)
                return

        interval = VERIFY_DURATION / max(1, VERIFY_FRAMES)
        start = time.time()
        counts = {"person": 0, "vehicle": 0, "animal": 0, "other": 0, "empty": 0}
        per_frame: list[dict] = []
        best_frame = None
        best_conf = 0.0
        best_label_seen = None

        for i in range(VERIFY_FRAMES):
            if self.stopped: break
            ok, frame = cap.read()
            if not ok:
                counts["empty"] += 1
                time.sleep(interval)
                continue
            try:
                results = model.predict(source=frame, conf=0.30, device=DEVICE,
                                        verbose=False, classes=yolo_classes)
            except Exception as e:
                LOG.warning("verifier inference err %s: %s", cam_id, e)
                counts["empty"] += 1
                time.sleep(interval)
                continue

            # Aggregate per-frame: best class
            frame_best_cls = None
            frame_best_conf = 0.0
            for r in results:
                for box in r.boxes:
                    conf = float(box.conf.item())
                    if conf < VERIFY_HIGH_CONF: continue
                    cls_id = int(box.cls.item())
                    if conf > frame_best_conf:
                        frame_best_conf = conf
                        frame_best_cls = cls_id
            if frame_best_cls is None:
                counts["empty"] += 1
                per_frame.append({"i": i, "cls": None})
            else:
                lbl = LABELS.get(frame_best_cls, f"cls_{frame_best_cls}")
                if frame_best_cls in PERSON_IDS: counts["person"] += 1
                elif frame_best_cls in VEHICLE_IDS: counts["vehicle"] += 1
                elif frame_best_cls in ANIMAL_IDS: counts["animal"] += 1
                else: counts["other"] += 1
                per_frame.append({"i": i, "cls": lbl, "conf": round(frame_best_conf, 3)})
                if frame_best_conf > best_conf:
                    best_conf = frame_best_conf
                    best_label_seen = lbl
                    best_frame = frame
            time.sleep(interval)

        try: cap.release()
        except Exception: pass

        total = sum(counts.values()) or 1
        non_empty = total - counts["empty"]
        elapsed = time.time() - start

        # Pick majority category among non-empty frames
        majority_category = None
        majority_count = 0
        for cat in ("person", "vehicle", "animal", "other"):
            if counts[cat] > majority_count:
                majority_count = counts[cat]
                majority_category = cat

        # Decision: alert only if majority >= threshold of total samples AND matches alarmType (or both)
        confirmed = False
        verdict_label = None
        if non_empty >= 2 and majority_category and majority_category != "empty":
            ratio = majority_count / total
            if ratio >= VERIFY_THRESHOLD:
                if alarm_type == "person" and majority_category == "person":
                    confirmed = True; verdict_label = "person"
                elif alarm_type == "vehicle" and majority_category == "vehicle":
                    confirmed = True; verdict_label = "vehicle"
                elif alarm_type == "both" and majority_category in ("person", "vehicle"):
                    confirmed = True; verdict_label = majority_category
                elif alarm_type == "motion":
                    confirmed = True; verdict_label = majority_category

        if not confirmed:
            LOG.info("VERIFIED-SUPPRESSED %s: %s (counts=%s, elapsed=%.1fs) — would have been false alert",
                     cam_id, primary_label, counts, elapsed)
            return

        # Save the best frame as verified snapshot (overwrites primary if higher conf)
        snap = save_snapshot(cam_id, best_frame) if best_frame is not None else job.get("snapshot_path")

        ev = {
            "cameraId": cam_id,
            "label": verdict_label or best_label_seen or primary_label,
            "confidence": round(best_conf, 3),
            "ts": datetime.now(timezone.utc).isoformat(),
            "snapshotPath": snap,
            # AI verification metadata
            "verification": {
                "verified": True,
                "category": majority_category,
                "counts": counts,
                "frames": VERIFY_FRAMES,
                "duration_sec": round(elapsed, 1),
                "ratio": round(majority_count / total, 3),
                "primary_label": primary_label,
                "per_frame": per_frame[:20],
            },
        }
        LOG.info("VERIFIED-ALERT %s: %s (counts=%s, ratio=%.2f, conf=%.2f, elapsed=%.1fs)",
                 cam_id, verdict_label, counts, majority_count / total, best_conf, elapsed)
        self.push(ev)


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
                # Hand off to AI verifier (post-event clip analysis).
                # The verifier opens its own VideoCapture, samples N frames over
                # D seconds, classifies, votes — only then emits the alert.
                # If queue is full, fall back to direct emit so we don't drop.
                job = {
                    "cameraId": cam_id,
                    "rtspUrl": rtsp,
                    "alarmType": alarm_type,
                    "primary_label": best_label,
                    "primary_confidence": round(best, 3),
                    "snapshot_path": snap,
                }
                try:
                    verification_queue.put_nowait(job)
                    LOG.info("DETECT-PENDING %s %s conf=%.2f hits=%d → queued for verification",
                             cam_id, best_label, best, consecutive_hits)
                except queue.Full:
                    LOG.warning("verification queue full — emitting direct (unverified) %s", cam_id)
                    self.push({
                        "cameraId": cam_id,
                        "label": best_label,
                        "confidence": round(best, 3),
                        "ts": datetime.now(timezone.utc).isoformat(),
                        "snapshotPath": snap,
                        "verification": {"verified": False, "reason": "queue_full"},
                    })
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

    # Start verifier thread (consumes verification_queue)
    push = push_factory()
    verifier = VerifierThread(push)
    verifier.start()

    LOG.info("ws server on %s:%d", WS_HOST, WS_PORT)
    async with websockets.serve(ws_handler, WS_HOST, WS_PORT):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
