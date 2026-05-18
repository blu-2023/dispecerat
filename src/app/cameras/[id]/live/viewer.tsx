"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { ArrowLeft, Maximize2, Minimize2, RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Camera = { id: string; name: string; alarmType: string; siteLabel: string };

declare global {
  interface Window {
    JSMpeg?: { Player: new (url: string, opts: Record<string, unknown>) => { destroy?: () => void } };
  }
}

const ALARM_LABEL: Record<string, string> = {
  person: "Persoană", vehicle: "Vehicul", both: "Persoană+Vehicul", motion: "Mișcare",
};

export default function LiveViewer({ camera, proxyBase }: { camera: Camera; proxyBase: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playerRef = useRef<{ destroy?: () => void } | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [jsmpegReady, setJsmpegReady] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [reloading, setReloading] = useState(0); // bump to recreate player
  const [streamUrl, setStreamUrl] = useState("");

  // Build proxy URL on client (so window.location is available).
  useEffect(() => {
    const base = proxyBase || `${window.location.protocol}//${window.location.hostname}:4011`;
    setStreamUrl(`${base}/stream/${encodeURIComponent(camera.id)}?t=${Date.now()}`);
  }, [camera.id, proxyBase, reloading]);

  // Create jsmpeg player when script ready + URL ready.
  useEffect(() => {
    if (!jsmpegReady || !streamUrl) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      playerRef.current?.destroy?.();
    } catch {}
    try {
      const JS = window.JSMpeg;
      if (!JS) return;
      playerRef.current = new JS.Player(streamUrl, {
        canvas,
        autoplay: true,
        audio: false,
        videoBufferSize: 1024 * 1024,
      });
    } catch (e) {
      console.error("jsmpeg init failed", e);
    }
    return () => {
      try { playerRef.current?.destroy?.(); } catch {}
      playerRef.current = null;
    };
  }, [jsmpegReady, streamUrl]);

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
      <Script src="/vendor/jsmpeg.min.js" strategy="afterInteractive" onReady={() => setJsmpegReady(true)} onLoad={() => setJsmpegReady(true)} />
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
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: "contain" }}
          />
          {!jsmpegReady && (
            <div className="absolute inset-0 flex items-center justify-center text-neutral-400 text-sm">
              Se încarcă player-ul…
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
          <div>Stream proxy: <code className="bg-neutral-900 px-1.5 py-0.5 rounded">{streamUrl || "—"}</code></div>
          <div>Dacă nu apare imagine: așteaptă 5-15s (prin VPN durează mai mult prima conectare), apoi apasă „Reia".</div>
        </div>
      </div>
    </>
  );
}
