"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

type Camera = { id: string; name: string; position: number; monitor: number; siteLabel: string };

type AlertState = { id: string; until: number; label: string };

declare global {
  interface Window {
    JSMpeg?: { Player: new (url: string, opts: Record<string, unknown>) => unknown };
  }
}

export default function VideoWallClient({
  cameras, cols, rows, proxyBase,
}: { cameras: Camera[]; cols: number; rows: number; proxyBase: string }) {
  const slots = cols * rows;
  const tiles = Array.from({ length: slots }, (_, i) => cameras[i] || null);
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const playersRef = useRef<Record<string, unknown>>({});
  const [alerts, setAlerts] = useState<Record<string, AlertState>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [jsmpegReady, setJsmpegReady] = useState(false);

  // Resolve proxy base. Prefer WebSocket — jsmpeg works most reliably this way.
  function proxyUrl(cameraId: string) {
    let host: string;
    if (proxyBase) {
      try { host = new URL(proxyBase).host; }
      catch { host = `${window.location.hostname}:4011`; }
    } else {
      host = `${window.location.hostname}:4011`;
    }
    const wsScheme = window.location.protocol === "https:" ? "wss" : "ws";
    return `${wsScheme}://${host}/ws/${encodeURIComponent(cameraId)}`;
  }

  useEffect(() => {
    if (!jsmpegReady) return;
    const JS = window.JSMpeg;
    if (!JS) return;
    for (const c of cameras) {
      const canvas = canvasRefs.current[c.id];
      if (!canvas) continue;
      if (playersRef.current[c.id]) continue;
      try {
        playersRef.current[c.id] = new JS.Player(proxyUrl(c.id), {
          canvas, autoplay: true, audio: false, videoBufferSize: 1024 * 1024,
          onSourceCompleted: () => {}, onError: () => {},
        });
      } catch (e) {
        console.error("jsmpeg init failed", c.id, e);
      }
    }
    // Cleanup on unmount
    return () => {
      for (const id of Object.keys(playersRef.current)) {
        const p = playersRef.current[id] as { destroy?: () => void } | undefined;
        try { p?.destroy?.(); } catch {}
      }
      playersRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jsmpegReady, cameras.length]);

  // YOLO alert WebSocket — connect to worker; reconnect on close.
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
      <Script src="/vendor/jsmpeg.min.js" strategy="afterInteractive" onReady={() => setJsmpegReady(true)} onLoad={() => setJsmpegReady(true)} />
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
                  <canvas
                    ref={(el) => { canvasRefs.current[cam.id] = el; }}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
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
      `}</style>
    </>
  );
}
