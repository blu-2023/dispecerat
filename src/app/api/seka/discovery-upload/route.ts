import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

// Receives the Sempral discovery report from the agent on the Windows PC.
// Token-protected. Writes to /root/dispecerat/seka-importer/discovery-{ts}.txt
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-seka-token") || "";
  const expected = process.env.SEKA_INGEST_TOKEN || process.env.YOLO_INGEST_TOKEN || "dev-token";
  if (token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.text();
  if (!body || body.length < 50) {
    return NextResponse.json({ error: "empty/short body" }, { status: 400 });
  }
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.resolve(process.cwd(), "seka-importer");
  await fs.mkdir(dir, { recursive: true });
  const fname = path.join(dir, `discovery-${ts}.txt`);
  await fs.writeFile(fname, body, "utf8");
  console.log(`[seka discovery] saved ${body.length} bytes to ${fname}`);
  return NextResponse.json({ ok: true, size: body.length, savedAs: fname });
}
