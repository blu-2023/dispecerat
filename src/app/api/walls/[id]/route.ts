import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";

async function loadOwn(id: string, orgId: string) {
  const wall = await prisma.wallPage.findUnique({ where: { id } });
  if (!wall || wall.organizationId !== orgId) return null;
  return wall;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await getOrgId();
    const { id } = await params;
    const wall = await prisma.wallPage.findUnique({
      where: { id },
      include: {
        sites: {
          orderBy: { position: "asc" },
          include: {
            site: {
              include: {
                cameras: { orderBy: { position: "asc" } },
                client: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });
    if (!wall || wall.organizationId !== orgId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(wall);
  } catch {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await getOrgId();
    const { id } = await params;
    if (!(await loadOwn(id, orgId))) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { name, cols, rows, monitor, notes } = await request.json();
    const wall = await prisma.wallPage.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(cols !== undefined && { cols: Number(cols) }),
        ...(rows !== undefined && { rows: Number(rows) }),
        ...(monitor !== undefined && { monitor: Number(monitor) }),
        ...(notes !== undefined && { notes }),
      },
    });
    return NextResponse.json(wall);
  } catch (e) {
    console.error("update wall failed", e);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await getOrgId();
    const { id } = await params;
    if (!(await loadOwn(id, orgId))) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.wallPage.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
