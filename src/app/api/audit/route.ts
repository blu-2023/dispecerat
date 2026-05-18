import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    const orgId = await getOrgId();
    const entityType = request.nextUrl.searchParams.get("entityType");

    const where: Record<string, unknown> = { organizationId: orgId };
    if (entityType) where.entityType = entityType;

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(logs);
  } catch {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
}
