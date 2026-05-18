import { getOrgId } from "@/lib/session";
import { pollAllReceivers } from "@/lib/seka/poller";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const orgId = await getOrgId();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await pollAllReceivers(orgId);

    return NextResponse.json({ message: "Poll triggered successfully" });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
