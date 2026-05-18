import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function SitesPage() {
  const orgId = await getOrgId();

  const sites = await prisma.site.findMany({
    where: { organizationId: orgId },
    include: {
      client: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Obiective</h1>
        <Link href="/sites/new"><Button>+ Obiectiv nou</Button></Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista obiectivelor</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nume</TableHead>
                <TableHead>Cod</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>VPN Video</TableHead>
                <TableHead>Servicii</TableHead>
                <TableHead>Program monitorizare</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sites.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nu există obiective.
                  </TableCell>
                </TableRow>
              )}
              {sites.map((site) => (
                <TableRow key={site.id}>
                  <TableCell>
                    <Link
                      href={`/sites/${site.id}`}
                      className="font-medium text-blue-400 hover:underline"
                    >
                      {site.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{site.code}</TableCell>
                  <TableCell>
                    <Link
                      href={`/clients/${site.client.id}`}
                      className="text-blue-400 hover:underline"
                    >
                      {site.client.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        site.hasVpnVideo
                          ? "bg-green-900/30 text-green-400"
                          : "bg-slate-700 text-slate-300"
                      }
                    >
                      {site.hasVpnVideo ? "Da" : "Nu"}
                    </Badge>
                  </TableCell>
                  <TableCell>{site.services || "—"}</TableCell>
                  <TableCell>{site.monitoringSchedule || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
