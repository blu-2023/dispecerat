import { NextRequest, NextResponse } from "next/server";
import { getSessionOrThrow } from "@/lib/session";
import net from "net";

// TCP-probe a host:port — used by the camera form to confirm the RTSP port is reachable
// before saving. Doesn't authenticate (would require a real RTSP client),
// just confirms the TCP socket opens.
export async function POST(req: NextRequest) {
  try {
    await getSessionOrThrow();
  } catch {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { host, port } = await req.json().catch(() => ({}));
  if (!host) return NextResponse.json({ ok: false, ms: 0, err: "host lipsește" }, { status: 400 });
  const p = Number(port) || 554;

  const start = Date.now();
  const result = await new Promise<{ ok: boolean; ms: number; err?: string }>((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (ok: boolean, err?: string) => {
      if (done) return;
      done = true;
      try { sock.destroy(); } catch {}
      resolve({ ok, ms: Date.now() - start, err });
    };
    sock.setTimeout(3000);
    sock.once("connect", () => finish(true));
    sock.once("timeout", () => finish(false, "timeout (3s)"));
    sock.once("error", (e) => finish(false, e.message));
    try { sock.connect(p, host); } catch (e) { finish(false, (e as Error).message); }
  });
  return NextResponse.json(result);
}
