import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    const orgId = await getOrgId();
    const siteId = request.nextUrl.searchParams.get("siteId");
    const nvrId = request.nextUrl.searchParams.get("nvrId");
    const search = request.nextUrl.searchParams.get("search");

    const where: Record<string, unknown> = { organizationId: orgId };
    if (siteId) where.siteId = siteId;
    if (nvrId) where.nvrId = nvrId;
    if (search) where.OR = [{ name: { contains: search } }, { rtspUrl: { contains: search } }];

    const cameras = await prisma.camera.findMany({
      where,
      include: {
        site: { select: { id: true, name: true, code: true, client: { select: { id: true, name: true } } } },
      },
      orderBy: [{ monitor: "asc" }, { position: "asc" }],
    });

    return NextResponse.json(cameras);
  } catch {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const orgId = await getOrgId();
    const body = await request.json();
    const { siteId, nvrId, channel, name, rtspUrl, enabled, yoloEnabled, position, monitor, notes } = body;

    if (!siteId || !name || !rtspUrl) {
      return NextResponse.json({ error: "siteId, name, rtspUrl required" }, { status: 400 });
    }

    // Verify site belongs to org (multi-tenant guard).
    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site || site.organizationId !== orgId) {
      return NextResponse.json({ error: "Site invalid" }, { status: 400 });
    }

    // If nvrId provided, verify it belongs to this org and site.
    if (nvrId) {
      const nvr = await prisma.nvr.findUnique({ where: { id: nvrId } });
      if (!nvr || nvr.organizationId !== orgId || nvr.siteId !== siteId) {
        return NextResponse.json({ error: "NVR invalid pentru acest obiectiv" }, { status: 400 });
      }
    }

    const camera = await prisma.camera.create({
      data: {
        organizationId: orgId,
        siteId,
        nvrId: nvrId || null,
        channel: channel != null ? Number(channel) : null,
        name,
        rtspUrl,
        enabled: enabled ?? true,
        yoloEnabled: yoloEnabled ?? true,
        position: position ?? 0,
        monitor: monitor ?? 0,
        notes: notes || null,
      },
    });

    return NextResponse.json(camera, { status: 201 });
  } catch (error) {
    console.error("create camera failed", error);
    return NextResponse.json({ error: "Eroare la creare cameră" }, { status: 500 });
  }
}
