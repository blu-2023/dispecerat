import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";
import { notFound } from "next/navigation";
import TicketDetailClient from "./client";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const orgId = await getOrgId();
  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true, role: true } },
      assignedTo: { select: { id: true, name: true, email: true, role: true } },
      site: { include: { client: { select: { id: true, name: true, phone: true } } } },
      camera: true,
      nvr: true,
      incident: { include: { client: { select: { name: true } }, site: { select: { name: true, code: true } } } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, name: true, role: true } } },
      },
    },
  });
  if (!ticket || ticket.organizationId !== orgId) notFound();
  const technicians = await prisma.user.findMany({
    where: { organizationId: orgId, active: true, role: { in: ["ADMIN", "DIRECTOR"] } },
    select: { id: true, name: true, role: true },
  });
  return <TicketDetailClient ticket={JSON.parse(JSON.stringify(ticket))} technicians={technicians} />;
}
