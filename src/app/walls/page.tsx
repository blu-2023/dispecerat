import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function WallsPage() {
  const orgId = await getOrgId();
  const walls = await prisma.wallPage.findMany({
    where: { organizationId: orgId },
    include: {
      sites: { include: { site: { include: { _count: { select: { cameras: true } } } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pereți video</h1>
          <p className="text-sm text-muted-foreground">
            Fiecare perete este o pagină separată cu propriile locații și camere. Le deschizi pe orice monitor.
          </p>
        </div>
        <Link href="/walls/new"><Button>+ Perete nou</Button></Link>
      </div>

      {walls.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Niciun perete configurat încă. <Link href="/walls/new" className="text-blue-400 hover:underline">Adaugă primul</Link>.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {walls.map(w => {
            const totalCams = w.sites.reduce((acc, s) => acc + s.site._count.cameras, 0);
            return (
              <Card key={w.id}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">{w.name}</h3>
                      <p className="text-xs text-muted-foreground">Monitor #{w.monitor} · {w.cols}×{w.rows} = {w.cols * w.rows} sloturi</p>
                    </div>
                  </div>
                  <div className="text-sm">
                    <div className="text-muted-foreground">Locații: {w.sites.length}</div>
                    <div className="text-muted-foreground">Camere total: {totalCams}</div>
                  </div>
                  {w.sites.length > 0 && (
                    <ul className="text-xs space-y-0.5">
                      {w.sites.slice(0, 4).map(ws => (
                        <li key={ws.id} className="text-muted-foreground">
                          • {ws.site.name} <span className="text-neutral-600">({ws.site._count.cameras} cam)</span>
                        </li>
                      ))}
                      {w.sites.length > 4 && <li className="text-neutral-600">… +{w.sites.length - 4} alte</li>}
                    </ul>
                  )}
                  <div className="flex gap-2 pt-2 border-t border-neutral-800">
                    <Link href={`/walls/${w.id}`} target="_blank" rel="noopener">
                      <Button size="sm">▶ Deschide</Button>
                    </Link>
                    <Link href={`/walls/${w.id}/edit`}>
                      <Button size="sm" variant="outline">Editează</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
