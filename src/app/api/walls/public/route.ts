import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Token-protected list of wall pages, used by the Electron menu to build
// "Video Wall → Wall X on monitor Y" entries.
export async function GET(request: NextRequest) {
  const token = request.headers.get("x-yolo-token") || request.headers.get("x-stream-token") || "";
  const expected = process.env.YOLO_INGEST_TOKEN || "dev-token";
  if (token !== expected) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const walls = await prisma.wallPage.findMany({
    select: { id: true, name: true, cols: true, rows: true, monitor: true, organizationId: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(walls);
}
