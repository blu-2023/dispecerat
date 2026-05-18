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

    const site = await prisma.site.findUnique({
      where: { id },
      include: {
        client: true,
      },
    });

    if (!site || site.organizationId !== orgId) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    return NextResponse.json(site);
  } catch {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await getOrgId();
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.site.findUnique({ where: { id } });
    if (!existing || existing.organizationId !== orgId) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const site = await prisma.site.update({
      where: { id },
      data: body,
    });

    return NextResponse.json(site);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
    }
    console.error("Failed to update site:", error);
    return NextResponse.json(
      { error: "Failed to update site" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await getOrgId();
    const { id } = await params;

    const existing = await prisma.site.findUnique({ where: { id } });
    if (!existing || existing.organizationId !== orgId) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    await prisma.site.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
    }
    console.error("Failed to delete site:", error);
    return NextResponse.json(
      { error: "Failed to delete site" },
      { status: 500 }
    );
  }
}
