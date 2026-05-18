import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgId, getSessionUser } from "@/lib/session";
import { logIncidentAction } from "@/lib/incident-log";

// POST /api/incidents/[id]/actions
// Body: { kind, reason?, payload? }
// Records an operator action on the incident. The kind drives interpretation.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await getOrgId();
    const me = await getSessionUser();
    const { id } = await params;

    const incident = await prisma.incident.findUnique({ where: { id }, select: { organizationId: true, status: true } });
    if (!incident || incident.organizationId !== orgId) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const kind = String(body.kind || "").toUpperCase();
    if (!kind || kind.length > 50) return NextResponse.json({ error: "kind required" }, { status: 400 });

    const remoteIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = request.headers.get("user-agent") || null;

    await logIncidentAction({
      incidentId: id,
      userId: me.id,
      kind,
      reason: body.reason ? String(body.reason).slice(0, 2000) : null,
      payload: body.payload,
      remoteIp,
      userAgent,
    });

    // Side-effects: certain kinds also mutate the incident state
    if (kind === "STATUS_CHANGE" && body.payload?.to) {
      const allowed = ["NEW", "IN_PROGRESS", "SENT", "CONFIRMED", "CLOSED", "CANCELLED"];
      if (allowed.includes(body.payload.to)) {
        await prisma.incident.update({
          where: { id },
          data: { status: body.payload.to },
        });
      }
    } else if (kind === "ASSIGN" && body.payload?.toUserId) {
      const target = await prisma.user.findUnique({ where: { id: body.payload.toUserId } });
      if (target && target.organizationId === orgId) {
        await prisma.incident.update({ where: { id }, data: { assignedToId: target.id } });
      }
    } else if (kind === "ACK" && incident.status === "NEW") {
      await prisma.incident.update({ where: { id }, data: { status: "IN_PROGRESS" } });
    } else if (kind === "CLOSE") {
      await prisma.incident.update({ where: { id }, data: { status: "CLOSED" } });
    } else if (kind === "REOPEN") {
      await prisma.incident.update({ where: { id }, data: { status: "IN_PROGRESS" } });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
    }
    console.error("incident action failed", e);
    return NextResponse.json({ error: "Eroare la log" }, { status: 500 });
  }
}
