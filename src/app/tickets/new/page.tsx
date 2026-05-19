import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";
import NewTicketForm from "./form";

export const dynamic = "force-dynamic";

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ incidentId?: string; siteId?: string; cameraId?: string; nvrId?: string; category?: string; title?: string }>;
}) {
  const orgId = await getOrgId();
  const sp = await searchParams;

  const [sites, technicians, incident, camera, nvr] = await Promise.all([
    prisma.site.findMany({ where: { organizationId: orgId }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { organizationId: orgId, active: true, role: { in: ["ADMIN", "DIRECTOR"] } }, select: { id: true, name: true, role: true } }),
    sp.incidentId ? prisma.incident.findUnique({ where: { id: sp.incidentId }, include: { site: true } }) : null,
    sp.cameraId ? prisma.camera.findUnique({ where: { id: sp.cameraId }, include: { site: true } }) : null,
    sp.nvrId ? prisma.nvr.findUnique({ where: { id: sp.nvrId }, include: { site: true } }) : null,
  ]);

  return (
    <div className="space-y-5 max-w-3xl">
      <h1 className="text-2xl font-bold">Ticket tehnic nou</h1>
      <NewTicketForm
        sites={sites}
        technicians={technicians}
        defaults={{
          incidentId: sp.incidentId,
          siteId: sp.siteId || incident?.siteId || camera?.siteId || nvr?.siteId,
          cameraId: sp.cameraId,
          nvrId: sp.nvrId,
          category: sp.category || (sp.cameraId ? "CAMERA_OFFLINE" : sp.nvrId ? "NVR_ISSUE" : sp.incidentId ? "SEKA_ISSUE" : "OTHER"),
          title: sp.title || (incident ? `Incident #${sp.incidentId?.slice(-6)} — necesită intervenție` : ""),
        }}
      />
    </div>
  );
}
