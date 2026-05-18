import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function VpnSitesPage() {
  const orgId = await getOrgId();

  const sites = await prisma.site.findMany({
    where: { organizationId: orgId, hasVpnVideo: true, active: true },
    include: {
      client: {
        select: { id: true, name: true },
      },
    },
    orderBy: [{ client: { name: "asc" } }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Obiective VPN Video</h1>
      </div>

      {sites.length === 0 ? (
        <p className="text-muted-foreground">
          Nu există obiective cu VPN Video activ.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sites.map((site) => (
            <Card key={site.id}>
              <CardHeader className="pb-2">
                <p className="text-sm text-muted-foreground">
                  {site.client.name}
                </p>
                <CardTitle className="text-lg">{site.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {site.address && (
                  <p className="text-sm text-muted-foreground">{site.address}</p>
                )}
                <div className="flex gap-2">
                  {site.vpnLink && (
                    <a
                      href={site.vpnLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm">
                        Deschide camere
                      </Button>
                    </a>
                  )}
                  <Link
                    href={`/incidents/new?siteId=${site.id}&source=VPN_VIDEO`}
                  >
                    <Button variant="destructive" size="sm">
                      Sesizare nouă
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
