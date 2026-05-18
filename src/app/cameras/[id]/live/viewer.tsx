"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { ArrowLeft, Maximize2, Minimize2, RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Camera = { id: string; name: string; alarmType: string; siteLabel: string };

declare global {
  interface Window {
    mpegts?: {
      isSupported(): boolean;
      createPlayer(media: { type: string; isLive: boolean; url: string }, config?: Record<string, unknown>): {
        attachMediaElement(el: HTMLVideoElement): void;
        load(): void;
        play(): Promise<void>;
        destroy(): void;
        on(ev: string, cb: (...args: unknown[]) => void): void;
      };
    };
  }
}

const ALARM_LABEL: Record<string, string> = {
  person: "Persoană", vehicle: "Vehicul", both: "Persoană+Vehicul", motion: "Mișcare",
};

export default function LiveViewer({ camera, proxyBase }: { camera: Camera; proxyBase: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<ReturnType<NonNullable<typeof window.mpegts>["createPlayer"]> | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [libReady, setLibReady] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [reloading, setReloading] = useState(0);
  const [streamUrl, setStreamUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Build proxy URL (ws:// MPEG-TS H.264 stream)
  useEffect(() => {
    let host: string;
    if (proxyBase) {
      try { host = new URL(proxyBase).host; }
      catch { host = `${window.location.hostname}:4011`; }
    } else {
      host = `${window.location.hostname}:4011`;
    }
    const wsScheme = window.location.protocol === "https:" ? "wss" : "ws";
    setStreamUrl(`${wsScheme}://${host}/ws/${encodeURIComponent(camera.id)}?t=${Date.now()}`);
  }, [camera.id, proxyBase, reloading]);

  // Initialize mpegts.js player
  useEffect(() => {
    if (!libReady || !streamUrl) return;
    const video = videoRef.current;
    if (!video) return;
    setError(null);

    try { playerRef.current?.destroy(); } catch {}
    playerRef.current = null;

    if (!window.mpegts?.isSupported()) {
      setError("Browser-ul nu suportă MSE (Media Source Extensions). Folosește Chrome/Edge/Firefox modern.");
      return;
    }

    try {
      const player = window.mpegts.createPlayer(
        { type: "mpegts", isLive: true, url: streamUrl },
        {
          enableWorker: true,
          enableStashBuffer: false,
          stashInitialSize: 128,
          liveBufferLatencyChasing: true,
          liveBufferLatencyMaxLatency: 2.0,
          liveBufferLatencyMinRemain: 0.3,
          autoCleanupSourceBuffer: true,
          fixAudioTimestampGap: false,
        },
      );
      player.attachMediaElement(video);
      player.load();
      player.play().catch((e) => console.warn("autoplay blocked", e));
      player.on("error", (...args: unknown[]) => {
        console.error("mpegts error", args);
        setError("Eroare la stream. Apasă Reia.");
      });
      playerRef.current = player;
    } catch (e) {
      console.error("mpegts init failed", e);
      setError(String((e as Error).message || e));
    }

    return () => {
      try { playerRef.current?.destroy(); } catch {}
      playerRef.current = null;
    };
  }, [libReady, streamUrl]);

  async function toggleFullscreen() {
    const el = wrapRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      try { await el.requestFullscreen(); setFullscreen(true); } catch {}
    } else {
      try { await document.exitFullscreen(); setFullscreen(false); } catch {}
    }
  }

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  return (
    <>
      <Script src="/vendor/mpegts.min.js" strategy="afterInteractive" onReady={() => setLibReady(true)} onLoad={() => setLibReady(true)} />
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Link href="/cameras"><Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Înapoi</Button></Link>
            <div>
              <h1 className="text-xl font-bold">{camera.name}</h1>
              <p className="text-xs text-muted-foreground">{camera.siteLabel} · alertă: {ALARM_LABEL[camera.alarmType] || camera.alarmType}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setReloading(r => r + 1)} title="Reia stream-ul">
              <RotateCw className="w-4 h-4 mr-1" /> Reia
            </Button>
            <Button variant="outline" size="sm" onClick={toggleFullscreen}>
              {fullscreen ? <Minimize2 className="w-4 h-4 mr-1" /> : <Maximize2 className="w-4 h-4 mr-1" />}
              {fullscreen ? "Ieși fullscreen" : "Fullscreen"}
            </Button>
          </div>
        </div>

        <div
          ref={wrapRef}
          className="relative w-full bg-black rounded-lg overflow-hidden border border-neutral-800"
          style={{ aspectRatio: "16/9" }}
        >
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: "contain" }}
            muted
            playsInline
            autoPlay
          />
          {!libReady && (
            <div className="absolute inset-0 flex items-center justify-center text-neutral-400 text-sm">
              Se încarcă player-ul…
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center text-red-400 text-sm bg-black/70">
              {error}
            </div>
          )}
          {fullscreen && (
            <button
              onClick={toggleFullscreen}
              className="absolute top-3 right-3 z-10 px-2 py-1 bg-black/60 text-white rounded text-xs hover:bg-black/80"
            >
              <X className="w-4 h-4 inline mr-1" /> Ieși (Esc)
            </button>
          )}
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <div>Stream H.264 prin: <code className="bg-neutral-900 px-1.5 py-0.5 rounded">{streamUrl || "—"}</code></div>
          <div>Codec H.264 baseline, decodare nativă MSE. Latență ~1-2s. Apasă „Reia" dacă apar artefacte.</div>
        </div>
      </div>
    </>
  );
}
