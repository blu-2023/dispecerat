import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";
import { notFound } from "next/navigation";
import LiveViewer from "./viewer";

export const dynamic = "force-dynamic";

export default async function LiveViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const orgId = await getOrgId();
  const { id } = await params;
  const cam = await prisma.camera.findUnique({
    where: { id },
    include: { site: { select: { code: true, name: true } } },
  });
  if (!cam || cam.organizationId !== orgId) notFound();

  const proxyBase = process.env.NEXT_PUBLIC_STREAM_PROXY || "";
  return (
    <LiveViewer
      camera={{
        id: cam.id,
        name: cam.name,
        alarmType: cam.alarmType,
        siteLabel: `${cam.site.code} · ${cam.site.name}`,
      }}
      proxyBase={proxyBase}
    />
  );
}
