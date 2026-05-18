import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logIncidentAction, ActionKind } from "@/lib/incident-log";

// YOLO worker pushes detections here for persistent audit (snapshot, log).
// If body.verification.verified is true, ALSO append to any open incident
// for the same site so the timeline shows live AI confirmation.
//
// Authenticated with a shared token (env: YOLO_INGEST_TOKEN).
export async function POST(request: NextRequest) {
  const token = request.headers.get("x-yolo-token");
  const expected = process.env.YOLO_INGEST_TOKEN || "dev-token";
  if (token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (!body || !body.cameraId) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  // Make sure camera exists; otherwise drop the event quietly.
  const camera = await prisma.camera.findUnique({ where: { id: body.cameraId } });
  if (!camera) return NextResponse.json({ error: "camera not found" }, { status: 404 });

  await prisma.cameraDetection.create({
    data: {
      cameraId: camera.id,
      label: body.label || "person",
      confidence: Number(body.confidence || 0),
      snapshotPath: body.snapshotPath || null,
    },
  });

  // If verified by AI and there is an open incident on this site, log to timeline.
  if (body.verification?.verified) {
    const openIncident = await prisma.incident.findFirst({
      where: {
        organizationId: camera.organizationId,
        siteId: camera.siteId,
        status: { in: ["NEW", "IN_PROGRESS"] },
        eventTime: { gte: new Date(Date.now() - 30 * 60 * 1000) }, // within last 30min
      },
      orderBy: { eventTime: "desc" },
    });
    if (openIncident) {
      await logIncidentAction({
        incidentId: openIncident.id,
        userId: null,
        kind: ActionKind.YOLO_VERIFIED,
        reason: `AI a confirmat: ${body.label} (categorie ${body.verification.category})`,
        payload: {
          cameraId: camera.id,
          cameraName: camera.name,
          label: body.label,
          confidence: body.confidence,
          verification: body.verification,
          snapshotPath: body.snapshotPath,
        },
        userAgent: "yolo-worker",
      });
    }
  }

  return NextResponse.json({ ok: true });
}
