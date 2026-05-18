import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";
import { notFound } from "next/navigation";
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
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import {
  incidentTypeLabels,
  severityColors,
  severityLabels,
  statusColors,
  statusLabels,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await getOrgId();

  const site = await prisma.site.findUnique({
    where: { id, organizationId: orgId },
    include: {
      client: true,
      incidents: {
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!site) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{site.name}</h1>
          <p className="text-muted-foreground">Cod: {site.code}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/sites">
            <Button variant="outline">Înapoi</Button>
          </Link>
          <Link href={`/sites/${site.id}/edit`}>
            <Button>Editează</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Informații obiectiv</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Client</p>
              <Link
                href={`/clients/${site.client.id}`}
                className="font-medium text-blue-400 hover:underline"
              >
                {site.client.name}
              </Link>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Adresă</p>
              <p className="font-medium">{site.address || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Program monitorizare</p>
              <p className="font-medium">{site.monitoringSchedule || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Servicii</p>
              <p className="font-medium">{site.services || "—"}</p>
            </div>
            {site.notes && (
              <div>
                <p className="text-sm text-muted-foreground">Observații</p>
                <p className="font-medium">{site.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acces VPN</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">VPN Video</p>
              <Badge
                className={
                  site.hasVpnVideo
                    ? "bg-green-900/30 text-green-400"
                    : "bg-slate-700 text-slate-300"
                }
              >
                {site.hasVpnVideo ? "Activ" : "Inactiv"}
              </Badge>
            </div>
            {site.vpnLink && (
              <div>
                <p className="text-sm text-muted-foreground">Link VPN</p>
                <a
                  href={site.vpnLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-400 hover:underline break-all"
                >
                  {site.vpnLink}
                </a>
              </div>
            )}
            {site.vpnUsername && (
              <div>
                <p className="text-sm text-muted-foreground">Utilizator VPN</p>
                <p className="font-medium font-mono">{site.vpnUsername}</p>
              </div>
            )}
            {site.vpnNotes && (
              <div>
                <p className="text-sm text-muted-foreground">Note VPN</p>
                <p className="font-medium">{site.vpnNotes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Sesizări recente ({site.incidents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {site.incidents.length === 0 ? (
            <p className="text-muted-foreground">Nu există sesizări pentru acest obiectiv.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severitate</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead>Sursă</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Operator</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {site.incidents.map((incident) => (
                  <TableRow key={incident.id}>
                    <TableCell>
                      <Badge className={severityColors[incident.severity]}>
                        {severityLabels[incident.severity] || incident.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/incidents/${incident.id}`}
                        className="text-blue-400 hover:underline"
                      >
                        {incidentTypeLabels[incident.incidentType] ||
                          incident.incidentType}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {incident.source === "VPN_VIDEO" ? "VPN" : "Manual"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[incident.status]}>
                        {statusLabels[incident.status] || incident.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{incident.createdBy.name}</TableCell>
                    <TableCell>
                      {format(new Date(incident.createdAt), "dd.MM.yyyy HH:mm", {
                        locale: ro,
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
