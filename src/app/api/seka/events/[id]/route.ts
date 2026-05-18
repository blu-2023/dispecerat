import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";
import { NextResponse } from "next/server";

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
    const { status } = body;

    if (!["PROCESSED", "IGNORED"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be PROCESSED or IGNORED." },
        { status: 400 }
      );
    }

    const existing = await prisma.sekaEvent.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const event = await prisma.sekaEvent.update({
      where: { id },
      data: {
        status,
        processedAt: new Date(),
      },
    });

    return NextResponse.json(event);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
