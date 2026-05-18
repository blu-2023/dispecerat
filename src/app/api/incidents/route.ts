import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgId, getSessionOrThrow } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    const orgId = await getOrgId();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const source = searchParams.get("source");
    const clientId = searchParams.get("clientId");
    const severity = searchParams.get("severity");

    const where: Record<string, unknown> = { organizationId: orgId };

    if (status) where.status = status;
    if (source) where.source = source;
    if (clientId) where.clientId = clientId;
    if (severity) where.severity = severity;

    const incidents = await prisma.incident.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        site: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(incidents);
  } catch {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionOrThrow();
    const orgId = session.user.organizationId;
    const body = await request.json();
    const {
      clientId,
      siteId,
      source,
      incidentType,
      severity,
      description,
      eventTime,
      timeRange,
      measures,
      assignedToId,
    } = body;

    if (!clientId || !siteId || !source || !incidentType || !description || !eventTime) {
      return NextResponse.json(
        { error: "clientId, siteId, source, incidentType, description, and eventTime are required" },
        { status: 400 }
      );
    }

    const incident = await prisma.incident.create({
      data: {
        organizationId: orgId,
        clientId,
        siteId,
        source,
        incidentType,
        severity,
        description,
        eventTime: new Date(eventTime),
        timeRange,
        measures,
        createdById: session.user.id,
        assignedToId,
      },
    });

    return NextResponse.json(incident, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
    }
    console.error("Failed to create incident:", error);
    return NextResponse.json(
      { error: "Failed to create incident" },
      { status: 500 }
    );
  }
}
