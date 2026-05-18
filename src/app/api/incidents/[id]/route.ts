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

    const incident = await prisma.incident.findUnique({
      where: { id },
      include: {
        client: true,
        site: true,
        emails: true,
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    if (!incident || incident.organizationId !== orgId) {
      return NextResponse.json(
        { error: "Incident not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(incident);
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

    const existing = await prisma.incident.findUnique({ where: { id } });
    if (!existing || existing.organizationId !== orgId) {
      return NextResponse.json(
        { error: "Incident not found" },
        { status: 404 }
      );
    }

    if (body.eventTime) {
      body.eventTime = new Date(body.eventTime);
    }

    const incident = await prisma.incident.update({
      where: { id },
      data: body,
    });

    return NextResponse.json(incident);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
    }
    console.error("Failed to update incident:", error);
    return NextResponse.json(
      { error: "Failed to update incident" },
      { status: 500 }
    );
  }
}
