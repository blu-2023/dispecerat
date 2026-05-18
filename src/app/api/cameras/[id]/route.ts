import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await getOrgId();
    const { id } = await params;
    const camera = await prisma.camera.findUnique({
      where: { id },
      include: { site: { include: { client: true } } },
    });
    if (!camera || camera.organizationId !== orgId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(camera);
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
    const existing = await prisma.camera.findUnique({ where: { id } });
    if (!existing || existing.organizationId !== orgId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const body = await request.json();
    const { siteId, name, rtspUrl, enabled, yoloEnabled, position, monitor, notes } = body;
    const camera = await prisma.camera.update({
      where: { id },
      data: {
        ...(siteId && { siteId }),
        ...(name !== undefined && { name }),
        ...(rtspUrl !== undefined && { rtspUrl }),
        ...(enabled !== undefined && { enabled }),
        ...(yoloEnabled !== undefined && { yoloEnabled }),
        ...(position !== undefined && { position }),
        ...(monitor !== undefined && { monitor }),
        ...(notes !== undefined && { notes }),
      },
    });
    return NextResponse.json(camera);
  } catch (error) {
    console.error("update camera failed", error);
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
    const existing = await prisma.camera.findUnique({ where: { id } });
    if (!existing || existing.organizationId !== orgId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.camera.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
