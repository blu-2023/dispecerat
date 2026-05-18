import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";
import SiteForm from "../site-form";

export const dynamic = "force-dynamic";

export default async function NewSitePage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const orgId = await getOrgId();
  const sp = await searchParams;
  const clients = await prisma.client.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Obiectiv nou</h1>
      {clients.length === 0 ? (
        <p className="text-sm text-muted-foreground">Adaugă întâi un client la <a href="/clients/new" className="text-blue-400 hover:underline">/clients/new</a>.</p>
      ) : (
        <SiteForm clients={clients} defaultClientId={sp.clientId} />
      )}
    </div>
  );
}
