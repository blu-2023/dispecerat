import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";
import { notFound } from "next/navigation";
import VideoWallClient from "../../video-wall/client";

export const dynamic = "force-dynamic";

export default async function WallLivePage({ params }: { params: Promise<{ id: string }> }) {
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
              cameras: { where: { enabled: true }, orderBy: { position: "asc" } },
            },
          },
        },
      },
    },
  });
  if (!wall || wall.organizationId !== orgId) notFound();

  // Flatten cameras across all attached sites, in (site position, camera position) order.
  const cameras = wall.sites.flatMap(ws =>
    ws.site.cameras.map(c => ({
      id: c.id,
      name: c.name,
      position: c.position,
      monitor: c.monitor,
      siteLabel: `${ws.site.code} · ${ws.site.name}`,
    }))
  );

  return (
    <VideoWallClient
      cameras={cameras}
      cols={wall.cols}
      rows={wall.rows}
      proxyBase={process.env.NEXT_PUBLIC_STREAM_PROXY || ""}
    />
  );
}
