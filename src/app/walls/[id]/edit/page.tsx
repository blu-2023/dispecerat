import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";
import { notFound } from "next/navigation";
import WallEditor from "./editor";

export const dynamic = "force-dynamic";

export default async function WallEditPage({ params }: { params: Promise<{ id: string }> }) {
  const orgId = await getOrgId();
  const { id } = await params;
  const wall = await prisma.wallPage.findUnique({
    where: { id },
    include: {
      sites: {
        orderBy: { position: "asc" },
        include: {
          site: {
            include: {
              cameras: { orderBy: { position: "asc" } },
              client: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });
  if (!wall || wall.organizationId !== orgId) notFound();

  // All sites in the org (for the "attach existing site" picker).
  const allSites = await prisma.site.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true, code: true, client: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  const allClients = await prisma.client.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <WallEditor
      wall={JSON.parse(JSON.stringify(wall))}
      allSites={allSites.map(s => ({
        id: s.id,
        code: s.code,
        name: s.name,
        clientName: s.client.name,
      }))}
      clients={allClients}
    />
  );
}
