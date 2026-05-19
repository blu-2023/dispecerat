/**
 * Stream proxy: RTSP → MPEG-TS over WebSocket (preferred) or HTTP.
 *
 * For each cameraId, spawn one ffmpeg process that reads the RTSP source
 * and writes MPEG-TS (mpeg1video). The output is fanned out to all
 * connected clients (WebSocket frames or HTTP response).
 *
 * Browser (jsmpeg) connects to:
 *    ws://host:PORT/ws/{cameraId}       (preferred — fewer issues with chunking)
 *    http://host:PORT/stream/{cameraId} (fallback)
 */
const http = require("http");
const { spawn } = require("child_process");
const { WebSocketServer } = require("ws");

const PORT = Number(process.env.STREAM_PROXY_PORT || 4011);
const WEB = process.env.WEB_BASE_URL || "http://127.0.0.1:3000";
const TOKEN = process.env.STREAM_PROXY_TOKEN || process.env.YOLO_INGEST_TOKEN || "";

const procs = new Map(); // cameraId -> { ff, rtspUrl, clients: Set<{type,res|ws}> }
const cameraCache = new Map(); // cameraId -> rtspUrl
let cacheLoaded = 0;

async function loadCameras() {
  try {
    const r = await fetch(`${WEB}/api/cameras/public`, {
      headers: TOKEN ? { "x-stream-token": TOKEN, "x-yolo-token": TOKEN } : {},
    });
    if (r.ok) {
      const list = await r.json();
      cameraCache.clear();
      for (const c of list) cameraCache.set(c.id, c.rtspUrl);
      cacheLoaded = Date.now();
      console.log(`[proxy] loaded ${list.length} cameras from web`);
    } else {
      console.warn(`[proxy] cameras endpoint returned ${r.status}`);
    }
  } catch (e) {
    console.warn(`[proxy] could not load cameras (${e.message}). Will accept ?rtsp= param.`);
  }
}

function startCamera(cameraId, rtspUrl, mode = "default") {
  if (procs.has(cameraId)) return procs.get(cameraId);
  console.log(`[proxy] starting ffmpeg for ${cameraId} (mode=${mode})`);
  // H.264 in MPEG-TS over WebSocket → browser decodes natively via mpegts.js + MSE.
  // libx264 ultrafast + zerolatency tuning trades small CPU for low latency.
  // 3 profiles: default (single-cam live), wall (many tiles, light), preview.
  let SCALE, FPS, BITRATE, GOP;
  if (mode === "wall") {
    // Many tiles → small + low bandwidth
    SCALE = process.env.STREAM_SCALE_WALL || "scale=480:-2";
    FPS   = process.env.STREAM_FPS_WALL   || "10";
    BITRATE = process.env.STREAM_BITRATE_WALL || "150k";
    GOP   = process.env.STREAM_GOP_WALL || "20";
  } else {
    SCALE = process.env.STREAM_SCALE || "scale=854:-2";
    FPS = process.env.STREAM_FPS || "15";
    BITRATE = process.env.STREAM_BITRATE || "500k";
    GOP = process.env.STREAM_GOP || "30";
  }

  const ff = spawn("ffmpeg", [
    "-rtsp_transport", "tcp",
    "-fflags", "+genpts+nobuffer",
    "-flags", "low_delay",
    "-i", rtspUrl,
    "-vf", `fps=${FPS},${SCALE}`,
    "-codec:v", "libx264",
    "-preset", "ultrafast",
    "-tune", "zerolatency",
    "-profile:v", "baseline",
    "-level", "3.1",
    "-pix_fmt", "yuv420p",
    "-b:v", BITRATE,
    "-maxrate", BITRATE,
    "-bufsize", "1M",
    "-g", GOP,            // keyframe interval
    "-keyint_min", GOP,
    "-sc_threshold", "0", // disable scene-change keyframes (more predictable)
    "-bf", "0",
    "-an",
    "-f", "mpegts",
    "-muxdelay", "0.001",
    "-muxpreload", "0.001",
    "-",
  ], { stdio: ["ignore", "pipe", "pipe"] });

  const entry = { ff, rtspUrl, mode, clients: new Set() };
  procs.set(cameraId, entry);

  ff.stdout.on("data", (chunk) => {
    for (const c of entry.clients) {
      try {
        if (c.type === "ws") c.ws.send(chunk, { binary: true });
        else c.res.write(chunk);
      } catch {}
    }
  });
  let stderrBuf = "";
  ff.stderr.on("data", (c) => {
    stderrBuf += c.toString();
    if (stderrBuf.length > 4000) stderrBuf = stderrBuf.slice(-2000);
  });
  ff.on("exit", (code) => {
    console.log(`[proxy] ffmpeg exit ${cameraId} code=${code} stderr=${stderrBuf.slice(-300)}`);
    for (const c of entry.clients) {
      try {
        if (c.type === "ws") c.ws.close();
        else c.res.end();
      } catch {}
    }
    procs.delete(cameraId);
  });

  // If no client connects within 30s, kill the process to save CPU.
  setTimeout(() => {
    if (entry.clients.size === 0 && procs.get(cameraId) === entry) {
      try { entry.ff.kill("SIGTERM"); } catch {}
      procs.delete(cameraId);
    }
  }, 30000);

  return entry;
}

async function ensureCameraStarted(cameraId, fallbackRtsp, mode = "default") {
  if (procs.has(cameraId)) return procs.get(cameraId);
  let rtspUrl = fallbackRtsp || cameraCache.get(cameraId);
  if (!rtspUrl && Date.now() - cacheLoaded > 60000) {
    await loadCameras();
    rtspUrl = cameraCache.get(cameraId);
  }
  if (!rtspUrl) return null;
  return startCamera(cameraId, rtspUrl, mode);
}

// ---- HTTP server ----
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (url.pathname === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ ok: true, active: procs.size, cached: cameraCache.size }));
    return;
  }

  const m = url.pathname.match(/^\/stream\/([^/]+)$/);
  if (!m) { res.writeHead(404); res.end("not found"); return; }
  const cameraId = decodeURIComponent(m[1]);
  const mode = url.searchParams.get("mode") || "default";
  const entry = await ensureCameraStarted(cameraId, url.searchParams.get("rtsp"), mode);
  if (!entry) { res.writeHead(404); res.end("camera not found"); return; }

  res.writeHead(200, {
    "Content-Type": "video/mp2t",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  const client = { type: "http", res };
  entry.clients.add(client);
  req.on("close", () => {
    entry.clients.delete(client);
    setTimeout(() => {
      if (entry.clients.size === 0 && procs.get(cameraId) === entry) {
        try { entry.ff.kill("SIGTERM"); } catch {}
        procs.delete(cameraId);
      }
    }, 10000);
  });
});

// ---- WebSocket server (preferred for jsmpeg) ----
const wss = new WebSocketServer({ noServer: true });
server.on("upgrade", async (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const m = url.pathname.match(/^\/ws\/([^/]+)$/);
  if (!m) { socket.destroy(); return; }
  const cameraId = decodeURIComponent(m[1]);
  const mode = url.searchParams.get("mode") || "default";
  const entry = await ensureCameraStarted(cameraId, url.searchParams.get("rtsp"), mode);
  if (!entry) { socket.destroy(); return; }

  wss.handleUpgrade(req, socket, head, (ws) => {
    const client = { type: "ws", ws };
    entry.clients.add(client);
    console.log(`[proxy] ws client + ${cameraId} (total: ${entry.clients.size})`);
    ws.on("close", () => {
      entry.clients.delete(client);
      console.log(`[proxy] ws client - ${cameraId} (remaining: ${entry.clients.size})`);
      setTimeout(() => {
        if (entry.clients.size === 0 && procs.get(cameraId) === entry) {
          try { entry.ff.kill("SIGTERM"); } catch {}
          procs.delete(cameraId);
        }
      }, 10000);
    });
    ws.on("error", () => {});
  });
});

loadCameras().finally(() => {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[proxy] listening on http://0.0.0.0:${PORT}`);
    console.log(`[proxy] websocket: ws://0.0.0.0:${PORT}/ws/{cameraId}`);
    console.log(`[proxy] http:      http://0.0.0.0:${PORT}/stream/{cameraId}`);
  });
});

process.on("SIGTERM", () => { for (const e of procs.values()) try { e.ff.kill("SIGTERM"); } catch {}; process.exit(0); });
process.on("SIGINT",  () => { for (const e of procs.values()) try { e.ff.kill("SIGTERM"); } catch {}; process.exit(0); });
