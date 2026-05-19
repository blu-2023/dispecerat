import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgId, getSessionUser } from "@/lib/session";
import { logIncidentAction, ActionKind } from "@/lib/incident-log";

const VALID_CATEGORIES = ["CAMERA_OFFLINE", "NVR_ISSUE", "SEKA_ISSUE", "NETWORK", "VPN", "SOFTWARE", "OTHER"];
const VALID_PRIORITY = ["LOW", "NORMAL", "HIGH", "CRITICAL"];

export async function GET(request: NextRequest) {
  try {
    const orgId = await getOrgId();
    const status = request.nextUrl.searchParams.get("status");
    const assignedToId = request.nextUrl.searchParams.get("assignedToId");
    const mine = request.nextUrl.searchParams.get("mine");

    const where: Record<string, unknown> = { organizationId: orgId };
    if (status) where.status = status;
    if (assignedToId) where.assignedToId = assignedToId;
    if (mine === "1") {
      const me = await getSessionUser();
      where.assignedToId = me.id;
    }

    const tickets = await prisma.ticket.findMany({
      where,
      orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        site: { select: { id: true, name: true, code: true } },
        camera: { select: { id: true, name: true } },
        nvr: { select: { id: true, name: true } },
        incident: { select: { id: true, status: true, description: true } },
        _count: { select: { comments: true } },
      },
    });
    return NextResponse.json(tickets);
  } catch {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await getSessionUser();
    const body = await request.json();
    const {
      category = "OTHER", priority = "NORMAL", title, description,
      incidentId, siteId, cameraId, nvrId, assignedToId,
    } = body;

    if (!title || !description) {
      return NextResponse.json({ error: "Titlu și descriere obligatorii" }, { status: 400 });
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Categorie invalidă" }, { status: 400 });
    }
    if (!VALID_PRIORITY.includes(priority)) {
      return NextResponse.json({ error: "Prioritate invalidă" }, { status: 400 });
    }

    const ticket = await prisma.ticket.create({
      data: {
        organizationId: me.organizationId,
        category, priority,
        title: String(title).slice(0, 200),
        description: String(description).slice(0, 4000),
        incidentId: incidentId || null,
        siteId: siteId || null,
        cameraId: cameraId || null,
        nvrId: nvrId || null,
        createdById: me.id,
        assignedToId: assignedToId || null,
        status: "OPEN",
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });

    // If linked to an incident, log it in the timeline
    if (ticket.incidentId) {
      await logIncidentAction({
        incidentId: ticket.incidentId,
        userId: me.id,
        kind: "TICKET_OPENED",
        reason: `Ticket tehnic deschis: ${ticket.title}`,
        payload: { ticketId: ticket.id, category: ticket.category, priority: ticket.priority },
      });
    }

    return NextResponse.json(ticket, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "Unauthorized") return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
    console.error("create ticket failed", e);
    return NextResponse.json({ error: "Eroare la creare ticket" }, { status: 500 });
  }
}
