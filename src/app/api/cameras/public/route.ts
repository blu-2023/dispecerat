import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Token-protected camera list for the stream proxy + YOLO worker.
// Returns RTSP URLs across all organizations (the proxy runs on the same host
// and is trusted infrastructure, not user-facing).
export async function GET(request: NextRequest) {
  const token =
    request.headers.get("x-stream-token") ||
    request.headers.get("x-yolo-token") ||
    "";
  const expected = process.env.YOLO_INGEST_TOKEN || "dev-token";
  if (token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const cameras = await prisma.camera.findMany({
    where: { enabled: true },
    select: {
      id: true,
      name: true,
      rtspUrl: true,
      yoloEnabled: true,
      monitor: true,
      position: true,
      siteId: true,
      organizationId: true,
    },
    orderBy: [{ monitor: "asc" }, { position: "asc" }],
  });
  return NextResponse.json(cameras);
}
