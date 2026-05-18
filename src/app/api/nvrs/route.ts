import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    const orgId = await getOrgId();
    const siteId = request.nextUrl.searchParams.get("siteId");
    const nvrs = await prisma.nvr.findMany({
      where: { organizationId: orgId, ...(siteId ? { siteId } : {}) },
      include: { _count: { select: { cameras: true } } },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(nvrs);
  } catch {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const orgId = await getOrgId();
    const body = await request.json();
    const { siteId, name, brand, model, ipAddress, webPort, rtspPort, username, password, channelsCount, notes } = body;
    if (!siteId || !name || !ipAddress) {
      return NextResponse.json({ error: "siteId, name, ipAddress required" }, { status: 400 });
    }
    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site || site.organizationId !== orgId) {
      return NextResponse.json({ error: "Site invalid" }, { status: 400 });
    }
    const nvr = await prisma.nvr.create({
      data: {
        organizationId: orgId,
        siteId, name,
        brand: brand || null, model: model || null,
        ipAddress,
        webPort: Number(webPort) || 80,
        rtspPort: Number(rtspPort) || 554,
        username: username || null,
        password: password || null,
        channelsCount: Number(channelsCount) || 0,
        notes: notes || null,
      },
    });
    return NextResponse.json(nvr, { status: 201 });
  } catch (e) {
    console.error("create nvr failed", e);
    return NextResponse.json({ error: "Eroare la creare NVR" }, { status: 500 });
  }
}
