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

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await getOrgId();

  const client = await prisma.client.findUnique({
    where: { id, organizationId: orgId },
    include: {
      contacts: true,
      sites: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!client) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{client.name}</h1>
          <p className="text-muted-foreground">Detalii client</p>
        </div>
        <div className="flex gap-2">
          <Link href="/clients">
            <Button variant="outline">Înapoi</Button>
          </Link>
          <Link href={`/clients/${client.id}/edit`}>
            <Button>Editează</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informații generale</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{client.email}</p>
            </div>
            {client.emailSecondary && (
              <div>
                <p className="text-sm text-muted-foreground">Email secundar</p>
                <p className="font-medium">{client.emailSecondary}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Telefon</p>
              <p className="font-medium">{client.phone || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Adresă</p>
              <p className="font-medium">{client.address || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Mod notificare</p>
              <Badge variant="outline">
                {client.notifyMode === "AUTO_ASSISTED"
                  ? "Auto-asistat"
                  : "Manual"}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge
                className={
                  client.active
                    ? "bg-green-900/30 text-green-400"
                    : "bg-slate-700 text-slate-300"
                }
              >
                {client.active ? "Activ" : "Inactiv"}
              </Badge>
            </div>
            {client.notes && (
              <div className="col-span-2">
                <p className="text-sm text-muted-foreground">Observații</p>
                <p className="font-medium">{client.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Persoane de contact ({client.contacts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {client.contacts.length === 0 ? (
            <p className="text-muted-foreground">Nu există persoane de contact.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nume</TableHead>
                  <TableHead>Funcție</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Principal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {client.contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell>{contact.role || "—"}</TableCell>
                    <TableCell>{contact.phone || "—"}</TableCell>
                    <TableCell>{contact.email || "—"}</TableCell>
                    <TableCell>
                      {contact.isPrimary && (
                        <Badge className="bg-blue-900/30 text-blue-400">
                          Principal
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Obiective ({client.sites.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {client.sites.length === 0 ? (
            <p className="text-muted-foreground">Nu există obiective.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nume</TableHead>
                  <TableHead>Cod</TableHead>
                  <TableHead>Adresă</TableHead>
                  <TableHead>VPN Video</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Servicii</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {client.sites.map((site) => (
                  <TableRow key={site.id}>
                    <TableCell>
                      <Link
                        href={`/sites/${site.id}`}
                        className="font-medium text-blue-400 hover:underline"
                      >
                        {site.name}
                      </Link>
                    </TableCell>
                    <TableCell>{site.code}</TableCell>
                    <TableCell>{site.address || "—"}</TableCell>
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
                    <TableCell>{site.monitoringSchedule || "—"}</TableCell>
                    <TableCell>{site.services || "—"}</TableCell>
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
