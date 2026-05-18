import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseContactId, getEventInfo, mapToIncidentType } from "@/lib/seka/contact-id";

// Token-protected push endpoint for the SEKA TCP listener sidecar.
//
// The sidecar listens on a TCP port (e.g. 6967), receives raw Contact ID
// frames from Sempral SEKA forwarder, and POSTs each frame here.
//
// We parse the frame, persist a SekaEvent, look up the Site by sekaAccountCode,
// and (if not arm/disarm/test) auto-create an Incident.
//
// Body:
//   {
//     receiverId: "..."   (optional — if omitted, we use the first active receiver of this org)
//     raw: "...frame..."   (one Contact ID line)
//     ts:  ISO date string (optional)
//     remoteIP: "..."      (optional — source IP that sent it; for audit)
//   }
//
// Header: x-seka-token (must match SEKA_INGEST_TOKEN env)
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-seka-token") || "";
  const expected = process.env.SEKA_INGEST_TOKEN || process.env.YOLO_INGEST_TOKEN || "dev-token";
  if (token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !body.raw) {
    return NextResponse.json({ error: "missing 'raw' field" }, { status: 400 });
  }

  const parsed = parseContactId(String(body.raw).trim());
  if (!parsed) {
    return NextResponse.json({ error: "invalid Contact ID frame", raw: body.raw }, { status: 400 });
  }

  // Resolve receiver — explicit id, or the first active receiver in this org.
  let receiver = null;
  if (body.receiverId) {
    receiver = await prisma.sekaReceiver.findUnique({ where: { id: body.receiverId } });
  }
  if (!receiver) {
    receiver = await prisma.sekaReceiver.findFirst({ where: { active: true }, orderBy: { createdAt: "asc" } });
  }
  if (!receiver) {
    return NextResponse.json({ error: "no SekaReceiver configured" }, { status: 412 });
  }

  // Try to resolve Site by sekaAccountCode (account code on the obiective table).
  const site = await prisma.site.findFirst({
    where: {
      organizationId: receiver.organizationId,
      sekaAccountCode: parsed.accountCode,
    },
    include: { client: true },
  });

  const info = getEventInfo(parsed.eventCode);

  const sekaEvent = await prisma.sekaEvent.create({
    data: {
      organizationId: receiver.organizationId,
      receiverId: receiver.id,
      siteId: site?.id,
      accountCode: parsed.accountCode,
      eventCode: parsed.eventCode,
      eventQualifier: parsed.qualifier,
      zone: parsed.zone || null,
      rawMessage: parsed.raw,
      eventType: info.type,
      eventLabel: info.label,
      severity: info.severity,
      status: "NEW",
    },
  });

  // Touch receiver's lastEventAt for monitoring.
  await prisma.sekaReceiver.update({
    where: { id: receiver.id },
    data: { lastEventAt: new Date(), status: "ONLINE" },
  });

  // Auto-create Incident for important events (not arm/disarm/test/bypass restores).
  let incidentId: string | null = null;
  const skip = new Set(["ARM_DISARM", "TEST", "BYPASS"]);
  if (site && parsed.qualifier === "E" && !skip.has(info.type)) {
    const adminUser = await prisma.user.findFirst({
      where: { organizationId: receiver.organizationId, role: { in: ["ADMIN", "DIRECTOR"] }, active: true },
    });
    if (adminUser) {
      const inc = await prisma.incident.create({
        data: {
          organizationId: receiver.organizationId,
          clientId: site.clientId,
          siteId: site.id,
          source: "SEKA",
          incidentType: mapToIncidentType(info.type),
          severity: info.severity,
          description: `${info.label} (cod ${parsed.eventCode}, zona ${parsed.zone || "-"}) — cont ${parsed.accountCode}`,
          eventTime: new Date(),
          status: "NEW",
          createdById: adminUser.id,
        },
      });
      incidentId = inc.id;
      await prisma.sekaEvent.update({
        where: { id: sekaEvent.id },
        data: { incidentId, status: "PROCESSED", processedAt: new Date() },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    sekaEventId: sekaEvent.id,
    incidentId,
    site: site ? { id: site.id, code: site.code, name: site.name } : null,
    event: { type: info.type, label: info.label, severity: info.severity },
  });
}
