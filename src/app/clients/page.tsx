import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const orgId = await getOrgId();

  const clients = await prisma.client.findMany({
    where: { organizationId: orgId },
    include: {
      _count: {
        select: { sites: true, contacts: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clienți</h1>
        <Link href="/clients/new">
          <Button>Adaugă client</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista clienților</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nume</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Mod notificare</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Obiective</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nu există clienți.
                  </TableCell>
                </TableRow>
              )}
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <Link
                      href={`/clients/${client.id}`}
                      className="font-medium text-blue-400 hover:underline"
                    >
                      {client.name}
                    </Link>
                  </TableCell>
                  <TableCell>{client.email}</TableCell>
                  <TableCell>{client.phone || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {client.notifyMode === "AUTO_ASSISTED"
                        ? "Auto-asistat"
                        : "Manual"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        client.active
                          ? "bg-green-900/30 text-green-400"
                          : "bg-slate-700 text-slate-300"
                      }
                    >
                      {client.active ? "Activ" : "Inactiv"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {client._count.sites}
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
