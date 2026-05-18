import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";
import { notFound } from "next/navigation";
import SiteForm from "../../site-form";

export const dynamic = "force-dynamic";

export default async function EditSitePage({ params }: { params: Promise<{ id: string }> }) {
  const orgId = await getOrgId();
  const { id } = await params;
  const s = await prisma.site.findUnique({ where: { id } });
  if (!s || s.organizationId !== orgId) notFound();
  const clients = await prisma.client.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Editare obiectiv: {s.name}</h1>
      <SiteForm clients={clients} initial={{
        id: s.id, clientId: s.clientId, name: s.name, code: s.code,
        address: s.address, hasVpnVideo: s.hasVpnVideo, vpnLink: s.vpnLink,
        vpnUsername: s.vpnUsername, vpnNotes: s.vpnNotes,
        monitoringSchedule: s.monitoringSchedule, services: s.services,
        sekaAccountCode: s.sekaAccountCode, notes: s.notes,
      }} />
    </div>
  );
}
