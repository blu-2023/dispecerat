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

export default async function IncidentsPage() {
  const orgId = await getOrgId();

  const incidents = await prisma.incident.findMany({
    where: { organizationId: orgId },
    include: {
      client: { select: { id: true, name: true } },
      site: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sesizări</h1>
        <Link href="/incidents/new">
          <Button>Sesizare nouă</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista sesizărilor</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Severitate</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Obiectiv</TableHead>
                <TableHead>Sursă</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Nu există sesizări.
                  </TableCell>
                </TableRow>
              )}
              {incidents.map((incident) => (
                <TableRow key={incident.id}>
                  <TableCell>
                    <Badge className={severityColors[incident.severity]}>
                      {severityLabels[incident.severity] || incident.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/incidents/${incident.id}`}
                      className="font-medium text-blue-400 hover:underline"
                    >
                      {incidentTypeLabels[incident.incidentType] ||
                        incident.incidentType}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/clients/${incident.client.id}`}
                      className="text-blue-400 hover:underline"
                    >
                      {incident.client.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/sites/${incident.site.id}`}
                      className="text-blue-400 hover:underline"
                    >
                      {incident.site.name}
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
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(incident.createdAt), "dd.MM.yyyy HH:mm", {
                      locale: ro,
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
