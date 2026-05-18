"use client";

/**
 * Global alert center — mounted once in MainLayout.
 *
 *  - Connects to YOLO worker WebSocket (default ws://<host>:4002).
 *  - On every detection event:
 *      • Plays /vendor/alert.wav (respecting Mute toggle).
 *      • Shows a sliding toast in top-right with camera, confidence, snapshot.
 *      • Pushes the event into a local history (last 20).
 *  - Renders a bell icon in the bottom-right with unread count and
 *    a dropdown that lists recent alerts.
 *
 * Hides itself on /walls/* live pages (those already show their own overlay).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, BellOff, Volume2, VolumeX, X } from "lucide-react";

type DetectionEvent = {
  cameraId: string;
  label?: string;
  confidence?: number;
  ts?: string;
  snapshotPath?: string | null;
};

type Alert = DetectionEvent & {
  id: string;
  cameraName?: string;
  siteName?: string;
  receivedAt: number;
};

type CameraInfo = { id: string; name: string; site?: { name: string; code: string } };

const HISTORY_LIMIT = 20;
const TOAST_DURATION_MS = 8000;
const MUTE_KEY = "dispecerat.alerts.muted";

function snapshotUrl(p?: string | null): string | null {
  if (!p) return null;
  const name = p.split(/[/\\]/).pop();
  if (!name) return null;
  return `/api/snapshots/${encodeURIComponent(name)}`;
}

export default function AlertCenter() {
  const pathname = usePathname();
  // Don't render on auth or fullscreen wall pages.
  const hidden = pathname === "/login" || pathname.startsWith("/walls/") && pathname !== "/walls";
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<Alert | null>(null);
  const [muted, setMuted] = useState(false);
  const [connected, setConnected] = useState(false);
  const [camMap, setCamMap] = useState<Record<string, CameraInfo>>({});

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore mute preference.
  useEffect(() => {
    try { setMuted(localStorage.getItem(MUTE_KEY) === "1"); } catch {}
  }, []);

  // Fetch camera names once so toasts show "Sediu / Intrare" instead of cuid.
  useEffect(() => {
    if (hidden) return;
    let cancelled = false;
    fetch("/api/cameras")
      .then(r => r.ok ? r.json() : [])
      .then((list: CameraInfo[]) => {
        if (cancelled) return;
        const map: Record<string, CameraInfo> = {};
        for (const c of list) map[c.id] = c;
        setCamMap(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [hidden]);

  // WebSocket lifecycle.
  useEffect(() => {
    if (hidden) return;
    let ws: WebSocket | null = null;
    let stop = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (stop) return;
      const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
      const port = Number(process.env.NEXT_PUBLIC_YOLO_WS_PORT || 4002);
      try { ws = new WebSocket(`ws://${host}:${port}`); }
      catch { reconnectTimer = setTimeout(connect, 3000); return; }
      ws.onopen = () => setConnected(true);
      ws.onclose = () => { setConnected(false); if (!stop) reconnectTimer = setTimeout(connect, 3000); };
      ws.onerror = () => { try { ws?.close(); } catch {} };
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as DetectionEvent;
          if (!data?.cameraId) return;
          handle(data);
        } catch {}
      };
    }

    function handle(ev: DetectionEvent) {
      const cam = camMap[ev.cameraId];
      const alert: Alert = {
        ...ev,
        id: `${ev.cameraId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        cameraName: cam?.name,
        siteName: cam?.site ? `${cam.site.code} · ${cam.site.name}` : undefined,
        receivedAt: Date.now(),
      };
      setAlerts(prev => [alert, ...prev].slice(0, HISTORY_LIMIT));
      setUnread(u => u + 1);
      setToast(alert);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
      if (!muted) {
        try {
          const a = audioRef.current;
          if (a) { a.currentTime = 0; a.play().catch(() => {}); }
        } catch {}
      }
    }

    connect();
    return () => {
      stop = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try { ws?.close(); } catch {}
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden, muted, camMap]);

  function toggleMute() {
    setMuted(m => {
      const next = !m;
      try { localStorage.setItem(MUTE_KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  }

  function clearAll() {
    setAlerts([]); setUnread(0); setOpen(false);
  }

  function dismissToast() {
    setToast(null);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }

  const recent = useMemo(() => alerts.slice(0, 10), [alerts]);

  if (hidden) return null;

  return (
    <>
      {/* Sound element (preload). */}
      <audio ref={audioRef} preload="auto" src="/vendor/alert.wav" />

      {/* Top-right toast (latest detection) */}
      {toast && (
        <div className="fixed top-4 right-4 z-[100] w-80 max-w-[90vw] animate-in slide-in-from-right shadow-2xl">
          <div className="rounded-lg border-2 border-red-600 bg-red-950/95 backdrop-blur p-3 flex gap-3">
            {snapshotUrl(toast.snapshotPath) ? (
              <img
                src={snapshotUrl(toast.snapshotPath)!}
                alt="snapshot"
                className="w-20 h-14 object-cover rounded border border-red-700"
              />
            ) : (
              <div className="w-20 h-14 rounded bg-red-900/60 flex items-center justify-center text-2xl">⚠</div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs uppercase tracking-wide text-red-300 font-bold">Persoană detectată</div>
                <button onClick={dismissToast} className="text-red-300 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              <div className="font-semibold text-white truncate">{toast.cameraName || toast.cameraId}</div>
              {toast.siteName && <div className="text-xs text-red-200/80 truncate">{toast.siteName}</div>}
              <div className="text-[11px] text-red-300/80 mt-0.5">
                conf {(toast.confidence ?? 0).toFixed(2)} · {new Date(toast.receivedAt).toLocaleTimeString("ro-RO")}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom-right floating control (bell + mute + status) */}
      <div className="fixed bottom-4 right-4 z-[90] flex items-center gap-2">
        <button
          onClick={toggleMute}
          title={muted ? "Activează sunet alerte" : "Mute alerte"}
          className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg border ${
            muted ? "bg-neutral-800 border-neutral-700 text-neutral-400" : "bg-neutral-900 border-neutral-700 text-green-400"
          }`}
        >
          {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
        <div className="relative">
          <button
            onClick={() => { setOpen(o => !o); setUnread(0); }}
            title="Alerte recente"
            className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg border bg-neutral-900 border-neutral-700 text-blue-400 hover:bg-neutral-800 relative"
          >
            {unread > 0 ? <Bell className="w-5 h-5 animate-pulse text-red-400" /> : <Bell className="w-5 h-5" />}
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
            <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-neutral-900 ${connected ? "bg-green-500" : "bg-neutral-500"}`} />
          </button>

          {open && (
            <div className="absolute bottom-14 right-0 w-96 max-w-[92vw] bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl overflow-hidden">
              <div className="px-3 py-2 flex items-center justify-between border-b border-neutral-800">
                <div className="text-sm font-semibold">Alerte recente</div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] uppercase tracking-wide ${connected ? "text-green-400" : "text-neutral-500"}`}>
                    {connected ? "● live" : "○ offline"}
                  </span>
                  <button onClick={clearAll} className="text-xs text-neutral-400 hover:text-white">Curăță</button>
                  <button onClick={() => setOpen(false)} className="text-neutral-400 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {recent.length === 0 ? (
                  <div className="p-4 text-center text-sm text-neutral-500">
                    Nicio alertă încă. Sistemul ascultă camerele YOLO.
                  </div>
                ) : (
                  <ul className="divide-y divide-neutral-800">
                    {recent.map(a => (
                      <li key={a.id} className="p-2.5 flex gap-2.5 hover:bg-neutral-800/40">
                        {snapshotUrl(a.snapshotPath) ? (
                          <img src={snapshotUrl(a.snapshotPath)!} alt="" className="w-16 h-12 rounded object-cover border border-neutral-700 flex-shrink-0" />
                        ) : (
                          <div className="w-16 h-12 rounded bg-neutral-800 flex items-center justify-center text-lg flex-shrink-0">⚠</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{a.cameraName || a.cameraId}</div>
                          {a.siteName && <div className="text-xs text-neutral-400 truncate">{a.siteName}</div>}
                          <div className="text-[11px] text-neutral-500 mt-0.5">
                            conf {(a.confidence ?? 0).toFixed(2)} · {new Date(a.receivedAt).toLocaleString("ro-RO")}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="px-3 py-2 text-[11px] text-neutral-500 border-t border-neutral-800">
                Apasă clopoțelul ca să resetezi contorul. Sunetul respectă starea mute.
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
