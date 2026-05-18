import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";
import net from "net";

// Probe an NVR with TCP connect on the configured ports.
// Returns reachability + measured latency for web + RTSP ports.
function tcpProbe(host: string, port: number, timeoutMs = 3000): Promise<{ ok: boolean; ms: number; err?: string }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const sock = new net.Socket();
    let done = false;
    const finish = (ok: boolean, err?: string) => {
      if (done) return;
      done = true;
      try { sock.destroy(); } catch {}
      resolve({ ok, ms: Date.now() - start, err });
    };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => finish(true));
    sock.once("timeout", () => finish(false, "timeout"));
    sock.once("error", (e) => finish(false, e.message));
    try { sock.connect(port, host); } catch (e) { finish(false, (e as Error).message); }
  });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await getOrgId();
    const { id } = await params;
    const nvr = await prisma.nvr.findUnique({ where: { id } });
    if (!nvr || nvr.organizationId !== orgId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const [web, rtsp] = await Promise.all([
      tcpProbe(nvr.ipAddress, nvr.webPort),
      tcpProbe(nvr.ipAddress, nvr.rtspPort),
    ]);
    return NextResponse.json({
      ipAddress: nvr.ipAddress,
      web: { port: nvr.webPort, ...web },
      rtsp: { port: nvr.rtspPort, ...rtsp },
      reachable: web.ok || rtsp.ok,
    });
  } catch (e) {
    console.error("nvr test failed", e);
    return NextResponse.json({ error: "Eroare la test" }, { status: 500 });
  }
}
