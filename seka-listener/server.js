/**
 * Dispecerat SEKA listener — TCP server for Sempral SEKA forwarding.
 *
 * Sempral SEKA Manager (PC) connects HERE as a TCP client and pushes
 * Contact ID events. Optionally validates a handshake (ID + password)
 * before accepting events.
 *
 * Configurable via env:
 *   SEKA_LISTEN_HOST=0.0.0.0
 *   SEKA_LISTEN_PORT=6967
 *   SEKA_RECEIVER_ID=BB49           (handshake check, optional — empty disables)
 *   SEKA_RECEIVER_PASSWORD=abcd     (handshake check, optional)
 *   SEKA_INGEST_TOKEN=...           (auth for /api/seka/ingest)
 *   WEB_BASE_URL=http://192.168.1.100:3000
 *   LOG_FRAMES=1                    (log raw bytes for debugging)
 *
 * Generic and tolerant: any text-like line is fed to Contact ID parser
 * server-side, which decides if it's valid.
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const net = require("net");

const HOST = process.env.SEKA_LISTEN_HOST || "0.0.0.0";
const PORT = Number(process.env.SEKA_LISTEN_PORT || 6967);
const RECEIVER_ID = process.env.SEKA_RECEIVER_ID || ""; // optional handshake check
const RECEIVER_PASSWORD = process.env.SEKA_RECEIVER_PASSWORD || "";
const TOKEN = process.env.SEKA_INGEST_TOKEN || process.env.YOLO_INGEST_TOKEN || "dev-token";
const WEB = process.env.WEB_BASE_URL || "http://127.0.0.1:3000";
const LOG_FRAMES = process.env.LOG_FRAMES === "1";

function ts() { return new Date().toISOString(); }
function log(...a) { console.log(`[seka ${ts()}]`, ...a); }
function err(...a) { console.error(`[seka ${ts()}] ERROR`, ...a); }

async function forwardToApp(raw, remoteIP) {
  try {
    const r = await fetch(`${WEB}/api/seka/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-seka-token": TOKEN },
      body: JSON.stringify({ raw, remoteIP, ts: new Date().toISOString() }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      err(`POST /api/seka/ingest ${r.status}: ${body.slice(0, 200)}`);
      return null;
    }
    return await r.json();
  } catch (e) {
    err(`forward failed: ${e.message}`);
    return null;
  }
}

function isValidContactIdShape(s) {
  // Loose Ademco Contact ID frame check.
  // Format: ACCT MT QXYZ GG CCC  (digits only, ~14-18 chars typical)
  const cleaned = s.replace(/[^\dA-Fa-f]/g, "");
  return cleaned.length >= 10 && /^\d/.test(cleaned);
}

const server = net.createServer((sock) => {
  const remote = `${sock.remoteAddress}:${sock.remotePort}`;
  log(`+ client ${remote}`);
  let authed = !RECEIVER_ID; // if no handshake configured, auto-accept
  let buf = Buffer.alloc(0);
  let frameCount = 0;
  let handshakeBuf = "";

  sock.setNoDelay(true);
  sock.setKeepAlive(true, 30000);

  sock.on("data", async (chunk) => {
    if (LOG_FRAMES) log(`bytes from ${remote}: ${chunk.toString("hex").slice(0, 120)}`);
    buf = Buffer.concat([buf, chunk]);

    // Split on newlines OR null bytes (Sempral sometimes uses CR/LF/NUL terminator).
    let idx;
    while ((idx = buf.findIndex(b => b === 0x0a || b === 0x0d || b === 0x00)) >= 0) {
      const line = buf.subarray(0, idx).toString("utf8").trim();
      buf = buf.subarray(idx + 1);
      if (!line) continue;

      if (!authed) {
        // Try handshake. Sempral typically sends: <ID> [SP] <PASS>  or two separate lines.
        handshakeBuf = (handshakeBuf + " " + line).trim();
        const parts = handshakeBuf.split(/[\s\t]+/);
        if (parts.length >= 2) {
          const [id, pass] = parts;
          if (id === RECEIVER_ID && pass === RECEIVER_PASSWORD) {
            authed = true;
            handshakeBuf = "";
            log(`✓ handshake OK from ${remote} (id=${id})`);
            try { sock.write("OK\r\n"); } catch {}
          } else {
            err(`✗ handshake FAILED from ${remote} got id="${id}" — closing`);
            try { sock.write("AUTH_FAIL\r\n"); } catch {}
            sock.destroy();
            return;
          }
        }
        continue;
      }

      // Authenticated — treat as Contact ID frame.
      frameCount++;
      log(`frame #${frameCount} from ${remote}: ${line.slice(0, 80)}`);
      if (!isValidContactIdShape(line)) {
        log(`   (skipping — does not look like Contact ID)`);
        continue;
      }
      const result = await forwardToApp(line, sock.remoteAddress);
      if (result?.ok) {
        try { sock.write("ACK\r\n"); } catch {}
        log(`   → ingested ${result.event?.label || "?"} ${result.site ? `site=${result.site.code}` : "(no site match)"}`);
      } else {
        try { sock.write("NACK\r\n"); } catch {}
      }
    }
  });

  sock.on("error", (e) => err(`${remote} sock error: ${e.message}`));
  sock.on("close", () => log(`- client ${remote} closed (frames: ${frameCount})`));
});

server.on("error", (e) => err("server error", e));
server.listen(PORT, HOST, () => {
  log(`listening on tcp://${HOST}:${PORT}`);
  if (RECEIVER_ID) log(`handshake required: id="${RECEIVER_ID}" + password (hidden)`);
  else log(`handshake disabled — accepting any connection`);
  log(`forwarding to ${WEB}/api/seka/ingest`);
});

process.on("SIGTERM", () => { try { server.close(); } catch {} process.exit(0); });
process.on("SIGINT",  () => { try { server.close(); } catch {} process.exit(0); });
