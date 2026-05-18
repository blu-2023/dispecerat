import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";

async function loadOwn(id: string, orgId: string) {
  const n = await prisma.nvr.findUnique({ where: { id } });
  if (!n || n.organizationId !== orgId) return null;
  return n;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = await getOrgId();
    const { id } = await params;
    const nvr = await prisma.nvr.findUnique({
      where: { id },
      include: { cameras: { orderBy: { channel: "asc" } } },
    });
    if (!nvr || nvr.organizationId !== orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(nvr);
  } catch {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = await getOrgId();
    const { id } = await params;
    if (!(await loadOwn(id, orgId))) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const b = await req.json();
    const nvr = await prisma.nvr.update({
      where: { id },
      data: {
        ...(b.name !== undefined && { name: b.name }),
        ...(b.brand !== undefined && { brand: b.brand || null }),
        ...(b.model !== undefined && { model: b.model || null }),
        ...(b.ipAddress !== undefined && { ipAddress: b.ipAddress }),
        ...(b.webPort !== undefined && { webPort: Number(b.webPort) }),
        ...(b.rtspPort !== undefined && { rtspPort: Number(b.rtspPort) }),
        ...(b.username !== undefined && { username: b.username || null }),
        ...(b.password !== undefined && { password: b.password || null }),
        ...(b.channelsCount !== undefined && { channelsCount: Number(b.channelsCount) }),
        ...(b.notes !== undefined && { notes: b.notes || null }),
      },
    });
    return NextResponse.json(nvr);
  } catch (e) {
    console.error("update nvr failed", e);
    return NextResponse.json({ error: "Eroare la actualizare" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = await getOrgId();
    const { id } = await params;
    if (!(await loadOwn(id, orgId))) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.nvr.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Eroare la ștergere" }, { status: 500 });
  }
}
