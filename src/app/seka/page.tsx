import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";
import SekaLiveClient from "./live-client";

export const dynamic = "force-dynamic";

export default async function SekaPage() {
  const orgId = await getOrgId();

  // Initial server-rendered snapshot (so we have content fast)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [receivers, eventsToday, newEvents, errorEvents, recentEvents] = await Promise.all([
    prisma.sekaReceiver.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" } }),
    prisma.sekaEvent.count({ where: { organizationId: orgId, createdAt: { gte: todayStart } } }),
    prisma.sekaEvent.count({ where: { organizationId: orgId, status: "NEW" } }),
    prisma.sekaEvent.count({ where: { organizationId: orgId, status: "ERROR" } }),
    prisma.sekaEvent.findMany({
      where: { organizationId: orgId },
      take: 50,
      orderBy: { createdAt: "desc" },
      include: {
        receiver: { select: { name: true } },
        site: { include: { client: { include: { contacts: true } } } },
      },
    }),
  ]);

  return (
    <SekaLiveClient
      initialReceivers={JSON.parse(JSON.stringify(receivers))}
      initialEvents={JSON.parse(JSON.stringify(recentEvents))}
      initialStats={{ eventsToday, newEvents, errorEvents, onlineReceivers: receivers.filter(r => r.status === "ONLINE").length, totalReceivers: receivers.length }}
    />
  );
}
