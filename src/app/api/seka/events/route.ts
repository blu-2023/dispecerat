import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const orgId = await getOrgId();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const receiverId = searchParams.get("receiverId");
    const accountCode = searchParams.get("accountCode");

    const where: Record<string, unknown> = { organizationId: orgId };
    if (status) where.status = status;
    if (receiverId) where.receiverId = receiverId;
    if (accountCode) where.accountCode = accountCode;

    const events = await prisma.sekaEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        receiver: true,
        site: true,
      },
    });

    return NextResponse.json(events);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
