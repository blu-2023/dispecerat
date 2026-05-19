import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";
import TicketsClient from "./client";

export const dynamic = "force-dynamic";

export default async function TicketsPage() {
  const orgId = await getOrgId();
  const tickets = await prisma.ticket.findMany({
    where: { organizationId: orgId },
    orderBy: [
      // OPEN > ACKNOWLEDGED > IN_PROGRESS > RESOLVED > CLOSED
      { status: "asc" },
      { priority: "desc" },
      { createdAt: "desc" },
    ],
    include: {
      createdBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      site: { select: { id: true, name: true, code: true } },
      camera: { select: { id: true, name: true } },
      _count: { select: { comments: true } },
    },
  });
  return <TicketsClient tickets={JSON.parse(JSON.stringify(tickets))} />;
}
