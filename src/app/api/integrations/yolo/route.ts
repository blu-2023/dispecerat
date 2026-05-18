import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// YOLO worker pushes detections here for persistent audit (snapshot, log).
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

  return NextResponse.json({ ok: true });
}
