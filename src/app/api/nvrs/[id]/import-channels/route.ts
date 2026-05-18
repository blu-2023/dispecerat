import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";

// Bulk-create cameras for each channel on the NVR using brand-specific RTSP templates.
// Skips channels that already exist for this NVR.
function buildRtsp(nvr: {
  brand: string | null; ipAddress: string; rtspPort: number;
  username: string | null; password: string | null;
}, channel: number, stream: "main" | "sub" = "main") {
  const auth = nvr.username
    ? `${encodeURIComponent(nvr.username)}:${encodeURIComponent(nvr.password || "")}@`
    : "";
  const host = `${nvr.ipAddress}:${nvr.rtspPort}`;
  const brand = (nvr.brand || "").toLowerCase();

  if (brand === "dahua") {
    const subtype = stream === "main" ? 0 : 1;
    return `rtsp://${auth}${host}/cam/realmonitor?channel=${channel}&subtype=${subtype}`;
  }
  if (brand === "uniview") {
    const sub = stream === "main" ? "01" : "02";
    return `rtsp://${auth}${host}/media/video${channel}/${sub}`;
  }
  if (brand === "axis") {
    return `rtsp://${auth}${host}/axis-media/media.amp?camera=${channel}&resolution=${stream === "main" ? "1920x1080" : "640x360"}`;
  }
  if (brand === "hanwha") {
    return `rtsp://${auth}${host}/profile${stream === "main" ? 1 : 2}/media.smp?ch=${channel}`;
  }
  // Hikvision / generic fallback.
  const sub = stream === "main" ? "01" : "02";
  return `rtsp://${auth}${host}/Streaming/Channels/${channel}${sub}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await getOrgId();
    const { id } = await params;
    const nvr = await prisma.nvr.findUnique({ where: { id } });
    if (!nvr || nvr.organizationId !== orgId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const body = await req.json().catch(() => ({}));
    const from = Math.max(1, Number(body.from) || 1);
    const to = Math.min(
      nvr.channelsCount > 0 ? nvr.channelsCount : 64,
      Number(body.to) || nvr.channelsCount || 16
    );
    const stream: "main" | "sub" = body.stream === "sub" ? "sub" : "main";
    const enableYolo: boolean = body.yoloEnabled !== false;

    if (from > to) return NextResponse.json({ error: "Interval invalid" }, { status: 400 });

    const existing = await prisma.camera.findMany({
      where: { nvrId: id },
      select: { channel: true },
    });
    const taken = new Set(existing.map(c => c.channel).filter((x): x is number => x != null));

    const created: { id: string; channel: number; name: string }[] = [];
    for (let ch = from; ch <= to; ch++) {
      if (taken.has(ch)) continue;
      const cam = await prisma.camera.create({
        data: {
          organizationId: orgId,
          siteId: nvr.siteId,
          nvrId: nvr.id,
          channel: ch,
          name: `${nvr.name} · canal ${ch}`,
          rtspUrl: buildRtsp(nvr, ch, stream),
          enabled: true,
          yoloEnabled: enableYolo,
          position: 0,
          monitor: 0,
        },
        select: { id: true, channel: true, name: true },
      });
      created.push({ id: cam.id, channel: cam.channel as number, name: cam.name });
    }
    return NextResponse.json({ created: created.length, cameras: created });
  } catch (e) {
    console.error("import channels failed", e);
    return NextResponse.json({ error: "Eroare la import canale" }, { status: 500 });
  }
}
