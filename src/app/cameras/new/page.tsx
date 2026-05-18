import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";
import CameraForm from "../camera-form";

export const dynamic = "force-dynamic";

export default async function NewCameraPage() {
  const orgId = await getOrgId();
  const sites = await prisma.site.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true, code: true, client: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Adaugă cameră</h1>
      <CameraForm sites={sites.map(s => ({ id: s.id, label: `[${s.code}] ${s.name} — ${s.client.name}` }))} />
    </div>
  );
}
