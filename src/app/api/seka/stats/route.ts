import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const orgId = await getOrgId();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalReceivers,
      activeReceivers,
      eventsToday,
      eventsByStatus,
      receiversByStatus,
    ] = await Promise.all([
      prisma.sekaReceiver.count({
        where: { organizationId: orgId },
      }),
      prisma.sekaReceiver.count({
        where: { organizationId: orgId, active: true },
      }),
      prisma.sekaEvent.count({
        where: {
          organizationId: orgId,
          createdAt: { gte: todayStart },
        },
      }),
      prisma.sekaEvent.groupBy({
        by: ["status"],
        where: { organizationId: orgId },
        _count: { status: true },
      }),
      prisma.sekaReceiver.groupBy({
        by: ["status"],
        where: { organizationId: orgId },
        _count: { status: true },
      }),
    ]);

    const eventStatusMap: Record<string, number> = {
      NEW: 0,
      PROCESSED: 0,
      IGNORED: 0,
      ERROR: 0,
    };
    for (const row of eventsByStatus) {
      eventStatusMap[row.status] = row._count.status;
    }

    const receiverStatusMap: Record<string, number> = {
      ONLINE: 0,
      OFFLINE: 0,
      ERROR: 0,
    };
    for (const row of receiversByStatus) {
      receiverStatusMap[row.status] = row._count.status;
    }

    return NextResponse.json({
      receivers: {
        total: totalReceivers,
        active: activeReceivers,
        inactive: totalReceivers - activeReceivers,
        byStatus: receiverStatusMap,
      },
      events: {
        today: eventsToday,
        byStatus: eventStatusMap,
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
