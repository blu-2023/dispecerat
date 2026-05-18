/**
 * Stream proxy: RTSP → MPEG-TS over HTTP.
 *
 * For each camera, a request to GET /stream/<cameraId> spawns one ffmpeg
 * process that reads the RTSP source and writes MPEG-TS (mpeg1video) to
 * stdout. Multiple clients connecting to the same camera share the same
 * ffmpeg process (each HTTP response is added to the broadcast set).
 *
 * The browser side decodes MPEG-TS with jsmpeg into a <canvas>.
 *
 * Cameras are fetched from the Next.js API on demand.
 */
const http = require("http");
const { spawn } = require("child_process");

const PORT = Number(process.env.STREAM_PROXY_PORT || 4011);
const WEB = process.env.WEB_BASE_URL || "http://127.0.0.1:3000";
// Use STREAM_PROXY_TOKEN if set, else fall back to YOLO_INGEST_TOKEN
// (the public endpoint accepts both header names with the same token).
const TOKEN = process.env.STREAM_PROXY_TOKEN || process.env.YOLO_INGEST_TOKEN || "";

const procs = new Map(); // cameraId -> { ff, rtspUrl, clients: Set<res> }
const cameraCache = new Map(); // cameraId -> rtspUrl
let cacheLoaded = 0;

async function loadCameras() {
  // Cameras live behind auth; for now, the proxy reads RTSP URLs from a
  // public-by-token endpoint the worker also uses. If not available, the
  // RTSP URL must be provided directly via the request query string.
  try {
    const r = await fetch(`${WEB}/api/cameras/public`, {
      headers: TOKEN ? { "x-stream-token": TOKEN } : {},
    });
    if (r.ok) {
      const list = await r.json();
      for (const c of list) cameraCache.set(c.id, c.rtspUrl);
      cacheLoaded = Date.now();
      console.log(`[proxy] loaded ${list.length} cameras from web`);
    }
  } catch (e) {
    console.warn(`[proxy] could not load cameras (${e.message}). Will accept ?rtsp= param.`);
  }
}

function startCamera(cameraId, rtspUrl) {
  if (procs.has(cameraId)) return procs.get(cameraId);
  console.log(`[proxy] starting ffmpeg for ${cameraId}`);
  const ff = spawn("ffmpeg", [
    "-rtsp_transport", "tcp",
    "-fflags", "+genpts",
    "-i", rtspUrl,
    "-f", "mpegts",
    "-codec:v", "mpeg1video",
    "-b:v", "600k",
    "-vf", "fps=25,scale=640:-2",
    "-bf", "0",
    "-an",
    "-tune", "zerolatency",
    "-muxdelay", "0.001",
    "-",
  ], { stdio: ["ignore", "pipe", "pipe"] });

  const entry = { ff, rtspUrl, clients: new Set() };
  procs.set(cameraId, entry);

  ff.stdout.on("data", (chunk) => {
    for (const res of entry.clients) {
      try { res.write(chunk); } catch {}
    }
  });
  let stderrBuf = "";
  ff.stderr.on("data", (c) => { stderrBuf += c.toString(); if (stderrBuf.length > 4000) stderrBuf = stderrBuf.slice(-2000); });
  ff.on("exit", (code) => {
    console.log(`[proxy] ffmpeg exit ${cameraId} code=${code}\n${stderrBuf.slice(-500)}`);
    for (const res of entry.clients) try { res.end(); } catch {}
    procs.delete(cameraId);
  });

  // If no client connects within 30s, kill the process to save CPU.
  setTimeout(() => {
    if (entry.clients.size === 0) {
      try { entry.ff.kill("SIGTERM"); } catch {}
      procs.delete(cameraId);
    }
  }, 30000);

  return entry;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, active: procs.size, cached: cameraCache.size }));
    return;
  }

  const m = url.pathname.match(/^\/stream\/([^/]+)$/);
  if (!m) { res.writeHead(404); res.end("not found"); return; }
  const cameraId = decodeURIComponent(m[1]);
  let rtspUrl = url.searchParams.get("rtsp") || cameraCache.get(cameraId);

  if (!rtspUrl && Date.now() - cacheLoaded > 60000) {
    await loadCameras();
    rtspUrl = cameraCache.get(cameraId);
  }
  if (!rtspUrl) { res.writeHead(404); res.end("camera not found"); return; }

  const entry = startCamera(cameraId, rtspUrl);
  res.writeHead(200, {
    "Content-Type": "video/mp2t",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  entry.clients.add(res);
  req.on("close", () => {
    entry.clients.delete(res);
    if (entry.clients.size === 0) {
      // Linger 10s in case browser reconnects (page reload)
      setTimeout(() => {
        if (entry.clients.size === 0 && procs.get(cameraId) === entry) {
          try { entry.ff.kill("SIGTERM"); } catch {}
          procs.delete(cameraId);
        }
      }, 10000);
    }
  });
});

loadCameras().finally(() => {
  server.listen(PORT, "0.0.0.0", () => console.log(`[proxy] listening on http://0.0.0.0:${PORT}`));
});

process.on("SIGTERM", () => { for (const e of procs.values()) try { e.ff.kill("SIGTERM"); } catch {}; process.exit(0); });
process.on("SIGINT",  () => { for (const e of procs.values()) try { e.ff.kill("SIGTERM"); } catch {}; process.exit(0); });
