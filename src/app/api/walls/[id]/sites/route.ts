import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";

// Attach a site (existing) to a wall page.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await getOrgId();
    const { id } = await params;
    const { siteId } = await request.json();
    if (!siteId) return NextResponse.json({ error: "siteId required" }, { status: 400 });

    const wall = await prisma.wallPage.findUnique({ where: { id } });
    if (!wall || wall.organizationId !== orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site || site.organizationId !== orgId) return NextResponse.json({ error: "Site invalid" }, { status: 400 });

    // Compute next position.
    const count = await prisma.wallPageSite.count({ where: { wallPageId: id } });
    const link = await prisma.wallPageSite.upsert({
      where: { wallPageId_siteId: { wallPageId: id, siteId } },
      update: {},
      create: { wallPageId: id, siteId, position: count },
    });
    return NextResponse.json(link, { status: 201 });
  } catch (e) {
    console.error("attach site failed", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
