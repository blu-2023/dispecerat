import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";

// Returns the full chronological replay of an incident:
// - all IncidentAction entries (ordered ASC by createdAt)
// - all emails sent (IncidentEmail)
// - YOLO detections for the same camera (if site has cameras) — best-effort
// - related SEKA events for the same site (best-effort)
//
// The UI renders this as a timeline.
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
        client: { select: { id: true, name: true } },
        site: { select: { id: true, name: true, code: true, sekaAccountCode: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        emails: true,
        actions: {
          orderBy: { createdAt: "asc" },
          include: { user: { select: { id: true, name: true, email: true, role: true } } },
        },
      },
    });
    if (!incident || incident.organizationId !== orgId) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    // Bring in SEKA events around the incident (same site, ±2h window)
    const window = 2 * 60 * 60 * 1000;
    const from = new Date(incident.eventTime.getTime() - window);
    const to = new Date(incident.eventTime.getTime() + window);
    const sekaEvents = incident.site
      ? await prisma.sekaEvent.findMany({
          where: {
            organizationId: orgId,
            OR: [{ incidentId: id }, { siteId: incident.site.id, createdAt: { gte: from, lte: to } }],
          },
          orderBy: { createdAt: "asc" },
          take: 50,
        })
      : [];

    // Camera detections on the same site within window
    const cameraDetections = incident.site
      ? await prisma.cameraDetection.findMany({
          where: {
            camera: { siteId: incident.site.id, organizationId: orgId },
            createdAt: { gte: from, lte: to },
          },
          orderBy: { createdAt: "asc" },
          take: 50,
          include: { camera: { select: { id: true, name: true } } },
        })
      : [];

    // Parse JSON payloads to ease client rendering
    const actions = incident.actions.map(a => ({
      ...a,
      payload: a.payload ? safeParse(a.payload) : null,
    }));

    return NextResponse.json({
      incident: { ...incident, actions: undefined },
      actions,
      sekaEvents,
      cameraDetections,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
    }
    console.error("replay failed", e);
    return NextResponse.json({ error: "Eroare" }, { status: 500 });
  }
}

function safeParse(s: string): unknown { try { return JSON.parse(s); } catch { return s; } }
