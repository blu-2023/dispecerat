import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await getOrgId();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const receiver = await prisma.sekaReceiver.findFirst({
      where: { id, organizationId: orgId },
      include: {
        _count: {
          select: { events: true },
        },
      },
    });

    if (!receiver) {
      return NextResponse.json({ error: "Receiver not found" }, { status: 404 });
    }

    return NextResponse.json(receiver);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await getOrgId();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, ipAddress, port, protocol, active, pollInterval } = body;

    const existing = await prisma.sekaReceiver.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Receiver not found" }, { status: 404 });
    }

    const receiver = await prisma.sekaReceiver.update({
      where: { id },
      data: { name, ipAddress, port, protocol, active, pollInterval },
    });

    return NextResponse.json(receiver);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await getOrgId();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.sekaReceiver.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Receiver not found" }, { status: 404 });
    }

    await prisma.sekaReceiver.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
