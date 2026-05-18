import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";
import { notFound } from "next/navigation";
import TemplateForm from "../../template-form";

export const dynamic = "force-dynamic";

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const orgId = await getOrgId();
  const { id } = await params;
  const t = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!t || t.organizationId !== orgId) notFound();
  const clients = await prisma.client.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold">Editare template: {t.name}</h1>
      <TemplateForm clients={clients} initial={{
        id: t.id, type: t.type, name: t.name,
        subjectTemplate: t.subjectTemplate, bodyTemplate: t.bodyTemplate,
        clientId: t.clientId, active: t.active,
      }} />
    </div>
  );
}
