import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";
import VideoSitesClient from "./client";

export const dynamic = "force-dynamic";

export default async function VideoSitesPage() {
  const orgId = await getOrgId();

  const sites = await prisma.site.findMany({
    where: { organizationId: orgId, active: true },
    include: {
      client: { select: { id: true, name: true } },
      nvrs: {
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { cameras: true } } },
      },
      cameras: {
        orderBy: [{ nvrId: "asc" }, { channel: "asc" }, { position: "asc" }],
      },
    },
    orderBy: [{ client: { name: "asc" } }, { name: "asc" }],
  });

  // Serialize Date fields for client component.
  const data = JSON.parse(JSON.stringify(sites));
  return <VideoSitesClient sites={data} />;
}
