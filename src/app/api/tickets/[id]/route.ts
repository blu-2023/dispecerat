import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgId, getSessionUser } from "@/lib/session";
import { logIncidentAction } from "@/lib/incident-log";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = await getOrgId();
    const { id } = await params;
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
        site: { include: { client: { select: { id: true, name: true, phone: true } } } },
        camera: true,
        nvr: true,
        incident: { include: { client: { select: { name: true } }, site: { select: { name: true, code: true } } } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: { user: { select: { id: true, name: true, role: true } } },
        },
      },
    });
    if (!ticket || ticket.organizationId !== orgId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(ticket);
  } catch {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
}

// PATCH: update ticket (status changes, assign, resolution, priority).
// Status transitions automatically set the corresponding timestamps.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getSessionUser();
    const { id } = await params;
    const existing = await prisma.ticket.findUnique({ where: { id } });
    if (!existing || existing.organizationId !== me.organizationId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const body = await req.json();
    const data: Record<string, unknown> = {};
    const now = new Date();

    if (body.title !== undefined) data.title = String(body.title).slice(0, 200);
    if (body.description !== undefined) data.description = String(body.description).slice(0, 4000);
    if (body.priority !== undefined) data.priority = body.priority;
    if (body.category !== undefined) data.category = body.category;
    if (body.assignedToId !== undefined) data.assignedToId = body.assignedToId || null;
    if (body.resolution !== undefined) data.resolution = body.resolution ? String(body.resolution).slice(0, 4000) : null;

    if (body.status !== undefined) {
      const newStatus = body.status;
      const allowed = ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"];
      if (!allowed.includes(newStatus)) {
        return NextResponse.json({ error: "Status invalid" }, { status: 400 });
      }
      data.status = newStatus;
      if (newStatus === "ACKNOWLEDGED" && !existing.acknowledgedAt) data.acknowledgedAt = now;
      if (newStatus === "IN_PROGRESS" && !existing.inProgressAt) data.inProgressAt = now;
      if (newStatus === "RESOLVED" && !existing.resolvedAt) data.resolvedAt = now;
      if (newStatus === "CLOSED") {
        data.closedAt = now;
        data.closedById = me.id;
      }
    }

    const updated = await prisma.ticket.update({ where: { id }, data });

    // Auto-comment for status changes (so the comment thread reflects history)
    if (body.status && body.status !== existing.status) {
      await prisma.ticketComment.create({
        data: {
          ticketId: id,
          userId: me.id,
          body: body.statusReason || `Status: ${existing.status} → ${body.status}`,
          statusChange: `${existing.status}→${body.status}`,
        },
      });

      // If linked to incident, append to timeline
      if (existing.incidentId) {
        await logIncidentAction({
          incidentId: existing.incidentId,
          userId: me.id,
          kind: body.status === "RESOLVED" ? "TICKET_RESOLVED" : body.status === "CLOSED" ? "TICKET_CLOSED" : "TICKET_UPDATE",
          reason: `Ticket #${id.slice(-6)}: ${existing.status} → ${body.status}`,
          payload: { ticketId: id, newStatus: body.status, resolution: body.resolution },
        });
      }
    }

    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
    }
    console.error("update ticket failed", e);
    return NextResponse.json({ error: "Eroare" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getSessionUser();
    if (!["ADMIN", "DIRECTOR"].includes(me.role)) {
      return NextResponse.json({ error: "Doar admin poate șterge tickete" }, { status: 403 });
    }
    const { id } = await params;
    const t = await prisma.ticket.findUnique({ where: { id } });
    if (!t || t.organizationId !== me.organizationId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.ticket.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Eroare" }, { status: 500 });
  }
}
