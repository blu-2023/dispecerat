import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";

export async function GET() {
  try {
    const orgId = await getOrgId();
    const walls = await prisma.wallPage.findMany({
      where: { organizationId: orgId },
      include: {
        sites: { include: { site: { include: { _count: { select: { cameras: true } } } } } },
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(walls);
  } catch {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const orgId = await getOrgId();
    const body = await request.json();
    const { name, cols, rows, monitor, notes, siteIds } = body;
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

    const wall = await prisma.wallPage.create({
      data: {
        organizationId: orgId,
        name,
        cols: Number(cols) || 5,
        rows: Number(rows) || 4,
        monitor: Number(monitor) || 0,
        notes,
      },
    });

    if (Array.isArray(siteIds) && siteIds.length) {
      // Filter to sites that actually belong to org (multi-tenant guard).
      const sites = await prisma.site.findMany({
        where: { id: { in: siteIds }, organizationId: orgId },
        select: { id: true },
      });
      await prisma.wallPageSite.createMany({
        data: sites.map((s, i) => ({ wallPageId: wall.id, siteId: s.id, position: i })),
      });
    }

    return NextResponse.json(wall, { status: 201 });
  } catch (e) {
    console.error("create wall failed", e);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
