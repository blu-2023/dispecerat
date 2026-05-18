import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";
import CamerasClient from "./client";

export const dynamic = "force-dynamic";

export default async function CamerasPage() {
  const orgId = await getOrgId();
  const cameras = await prisma.camera.findMany({
    where: { organizationId: orgId },
    include: {
      site: { select: { id: true, name: true, code: true } },
      nvr: { select: { id: true, name: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });
  return <CamerasClient cameras={JSON.parse(JSON.stringify(cameras))} />;
}
