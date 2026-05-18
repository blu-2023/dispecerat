import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";

// Detach a site from a wall page (does not delete the site itself or its cameras).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; siteId: string }> }
) {
  try {
    const orgId = await getOrgId();
    const { id, siteId } = await params;

    const wall = await prisma.wallPage.findUnique({ where: { id } });
    if (!wall || wall.organizationId !== orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.wallPageSite.deleteMany({ where: { wallPageId: id, siteId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
