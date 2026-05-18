import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";
import { getSessionOrThrow } from "@/lib/session";

// Serves YOLO worker snapshot images saved on local disk.
// Path is constrained to the SNAPSHOTS_DIR — no traversal allowed.
const SNAPSHOTS_DIR = process.env.YOLO_SNAPSHOTS_DIR
  ? path.resolve(process.env.YOLO_SNAPSHOTS_DIR)
  : path.resolve(process.cwd(), "yolo-worker", "snapshots");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    await getSessionOrThrow();
  } catch {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { name } = await params;
  // Reject path traversal and anything other than safe filename chars.
  if (!/^[A-Za-z0-9._-]+\.(jpg|jpeg|png)$/i.test(name)) {
    return NextResponse.json({ error: "Nume invalid" }, { status: 400 });
  }
  const fullPath = path.join(SNAPSHOTS_DIR, name);
  if (!fullPath.startsWith(SNAPSHOTS_DIR)) {
    return NextResponse.json({ error: "Cale invalidă" }, { status: 400 });
  }

  try {
    const s = await stat(fullPath);
    if (!s.isFile()) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const buf = await readFile(fullPath);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
