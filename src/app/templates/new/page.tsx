import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";
import TemplateForm from "../template-form";

export const dynamic = "force-dynamic";

export default async function NewTemplatePage() {
  const orgId = await getOrgId();
  const clients = await prisma.client.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold">Template email nou</h1>
      <TemplateForm clients={clients} />
    </div>
  );
}
