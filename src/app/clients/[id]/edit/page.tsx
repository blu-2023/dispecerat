import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";
import { notFound } from "next/navigation";
import ClientForm from "../../client-form";

export const dynamic = "force-dynamic";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const orgId = await getOrgId();
  const { id } = await params;
  const c = await prisma.client.findUnique({ where: { id } });
  if (!c || c.organizationId !== orgId) notFound();
  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Editare client: {c.name}</h1>
      <ClientForm initial={{
        id: c.id, name: c.name, email: c.email,
        emailSecondary: c.emailSecondary, phone: c.phone, address: c.address,
        notifyMode: c.notifyMode, notes: c.notes,
      }} />
    </div>
  );
}
