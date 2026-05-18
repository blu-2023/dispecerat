import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";
import { notFound } from "next/navigation";
import CameraForm from "../camera-form";

export const dynamic = "force-dynamic";

export default async function CameraEditPage({ params }: { params: Promise<{ id: string }> }) {
  const orgId = await getOrgId();
  const { id } = await params;
  const camera = await prisma.camera.findUnique({ where: { id } });
  if (!camera || camera.organizationId !== orgId) notFound();
  const sites = await prisma.site.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true, code: true, client: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Editează cameră</h1>
      <CameraForm
        sites={sites.map(s => ({ id: s.id, label: `[${s.code}] ${s.name} — ${s.client.name}` }))}
        initial={{
          id: camera.id, siteId: camera.siteId, name: camera.name, rtspUrl: camera.rtspUrl,
          enabled: camera.enabled, yoloEnabled: camera.yoloEnabled,
          position: camera.position, monitor: camera.monitor, notes: camera.notes,
        }}
      />
    </div>
  );
}
