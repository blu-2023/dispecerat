"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

type Camera = { id: string; name: string; position: number; monitor: number; siteLabel: string };
type AlertState = { id: string; until: number; label: string };

type MpegtsPlayer = {
  attachMediaElement(el: HTMLVideoElement): void;
  load(): void;
  play(): Promise<void>;
  destroy(): void;
  on(ev: string, cb: (...args: unknown[]) => void): void;
};
declare global {
  interface Window {
    mpegts?: {
      isSupported(): boolean;
      createPlayer(media: { type: string; isLive: boolean; url: string }, config?: Record<string, unknown>): MpegtsPlayer;
    };
  }
}

export default function VideoWallClient({
  cameras, cols, rows, proxyBase,
}: { cameras: Camera[]; cols: number; rows: number; proxyBase: string }) {
  const slots = cols * rows;
  const tiles = Array.from({ length: slots }, (_, i) => cameras[i] || null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const playersRef = useRef<Record<string, MpegtsPlayer>>({});
  const [alerts, setAlerts] = useState<Record<string, AlertState>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [libReady, setLibReady] = useState(false);

  function proxyUrl(cameraId: string) {
    let host: string;
    if (proxyBase) {
      try { host = new URL(proxyBase).host; }
      catch { host = `${window.location.hostname}:4011`; }
    } else {
      host = `${window.location.hostname}:4011`;
    }
    const wsScheme = window.location.protocol === "https:" ? "wss" : "ws";
    // mode=wall → proxy uses smaller scale / fps / bitrate (better for many tiles)
    return `${wsScheme}://${host}/ws/${encodeURIComponent(cameraId)}?mode=wall`;
  }

  useEffect(() => {
    if (!libReady) return;
    if (!window.mpegts?.isSupported()) return;

    const timeouts: ReturnType<typeof setTimeout>[] = [];

    // Stagger startup — opening 30 RTSP connections simultaneously overwhelms
    // both the DVR (parallel-connection limits) and the browser MSE decoder.
    // 350ms apart is comfortable: 30 cams take ~10s to fully boot.
    const STAGGER_MS = 350;

    function startPlayer(c: Camera, retryCount = 0) {
      const video = videoRefs.current[c.id];
      if (!video) return;
      if (playersRef.current[c.id]) return; // already running

      try {
        const player = window.mpegts!.createPlayer(
          { type: "mpegts", isLive: true, url: proxyUrl(c.id) },
          {
            enableWorker: true,
            enableStashBuffer: false,
            stashInitialSize: 64,
            liveBufferLatencyChasing: true,
            liveBufferLatencyMaxLatency: 3.0,
            liveBufferLatencyMinRemain: 0.5,
            autoCleanupSourceBuffer: true,
          }
        );
        player.attachMediaElement(video);
        player.load();
        player.play().catch(() => {});
        player.on("error", () => {
          // Destroy + retry after delay (max 5 retries)
          try { player.destroy(); } catch {}
          delete playersRef.current[c.id];
          if (retryCount < 5) {
            const backoff = 2000 + retryCount * 2000;
            const t = setTimeout(() => startPlayer(c, retryCount + 1), backoff);
            timeouts.push(t);
          }
        });
        playersRef.current[c.id] = player;
      } catch (e) {
        console.error("mpegts init failed", c.id, e);
      }
    }

    cameras.forEach((c, idx) => {
      const t = setTimeout(() => startPlayer(c), idx * STAGGER_MS);
      timeouts.push(t);
    });

    return () => {
      timeouts.forEach(clearTimeout);
      for (const id of Object.keys(playersRef.current)) {
        try { playersRef.current[id].destroy(); } catch {}
      }
      playersRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libReady, cameras.length]);

  // YOLO alert WebSocket
  useEffect(() => {
    let ws: WebSocket | null = null;
    let stop = false;
    function connect() {
      if (stop) return;
      const wsHost = window.location.hostname;
      const wsPort = Number(process.env.NEXT_PUBLIC_YOLO_WS_PORT || 4002);
      const url = `ws://${wsHost}:${wsPort}`;
      try { ws = new WebSocket(url); } catch { setTimeout(connect, 3000); return; }
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (!data?.cameraId) return;
          setAlerts((prev) => ({
            ...prev,
            [data.cameraId]: { id: data.cameraId, until: Date.now() + 6000, label: data.label || "persoană" },
          }));
          try { if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play().catch(() => {}); } } catch {}
        } catch {}
      };
      ws.onclose = () => { if (!stop) setTimeout(connect, 3000); };
      ws.onerror = () => { try { ws?.close(); } catch {} };
    }
    connect();
    const tick = setInterval(() => {
      setAlerts((prev) => {
        const now = Date.now();
        const next: typeof prev = {};
        for (const k of Object.keys(prev)) if (prev[k].until > now) next[k] = prev[k];
        return next;
      });
    }, 1000);
    return () => { stop = true; clearInterval(tick); try { ws?.close(); } catch {} };
  }, []);

  return (
    <>
      <Script src="/vendor/mpegts.min.js" strategy="afterInteractive" onReady={() => setLibReady(true)} onLoad={() => setLibReady(true)} />
      <audio ref={audioRef} preload="auto" src="/vendor/alert.wav" />
      <div className="fixed inset-0 bg-black z-10" style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: 2,
      }}>
        {tiles.map((cam, idx) => {
          const alerted = cam && alerts[cam.id]?.until > Date.now();
          return (
            <div key={idx} className="relative overflow-hidden bg-neutral-900" style={alerted ? { outline: "3px solid #dc2626", outlineOffset: -3, animation: "wallpulse 1s infinite" } : undefined}>
              {cam ? (
                <>
                  <video
                    ref={(el) => { videoRefs.current[cam.id] = el; }}
                    className="cam-video"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", background: "#000" }}
                    muted
                    playsInline
                    autoPlay
                    onCanPlay={(e) => { (e.target as HTMLVideoElement).dataset.ready = "1"; }}
                  />
                  {/* Loading overlay: hidden once video has data-ready="1" via sibling selector */}
                  <div className="cam-loading absolute inset-0 flex items-center justify-center pointer-events-none text-neutral-500 text-xs">
                    <div className="bg-black/70 px-2 py-1 rounded">Conectare…</div>
                  </div>
                  <div className="absolute left-1 bottom-1 px-1.5 py-0.5 rounded text-[11px] bg-black/60 text-white">
                    {cam.siteLabel} · {cam.name}
                  </div>
                  {alerted && (
                    <div className="absolute left-1 top-1 px-1.5 py-0.5 rounded text-[11px] bg-red-600 text-white font-bold">
                      ⚠ {alerts[cam.id].label}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center w-full h-full text-neutral-700 text-xs">
                  slot #{idx + 1}
                </div>
              )}
            </div>
          );
        })}
        <button
          onClick={() => history.back()}
          className="fixed top-2 right-2 z-20 px-2 py-1 text-xs bg-neutral-800/80 text-white rounded hover:bg-neutral-700"
        >
          ✕ Ieși
        </button>
      </div>
      <style>{`
        @keyframes wallpulse { 0% { outline-color: #dc2626; } 50% { outline-color: #fca5a5; } 100% { outline-color: #dc2626; } }
        .cam-video[data-ready="1"] ~ .cam-loading { display: none; }
      `}</style>
    </>
  );
}
