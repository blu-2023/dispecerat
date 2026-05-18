import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";
import VideoWallClient from "./client";

export const dynamic = "force-dynamic";

export default async function VideoWallPage({
  searchParams,
}: {
  searchParams: Promise<{ monitor?: string; cols?: string; rows?: string }>;
}) {
  const orgId = await getOrgId();
  const sp = await searchParams;
  const monitor = sp.monitor ? Number(sp.monitor) : null; // null = all
  const cols = Number(sp.cols ?? 5);
  const rows = Number(sp.rows ?? 4);

  const cameras = await prisma.camera.findMany({
    where: {
      organizationId: orgId,
      enabled: true,
      ...(monitor !== null && !Number.isNaN(monitor) ? { monitor } : {}),
    },
    select: {
      id: true, name: true, position: true, monitor: true,
      site: { select: { code: true, name: true } },
    },
    orderBy: [{ monitor: "asc" }, { position: "asc" }],
  });

  const proxyBase = process.env.NEXT_PUBLIC_STREAM_PROXY || "";
  return (
    <VideoWallClient
      cameras={cameras.map(c => ({
        id: c.id, name: c.name, position: c.position, monitor: c.monitor,
        siteLabel: `${c.site.code} · ${c.site.name}`,
      }))}
      cols={cols}
      rows={rows}
      proxyBase={proxyBase}
    />
  );
}
