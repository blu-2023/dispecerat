import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ro } from "date-fns/locale";

export const dynamic = "force-dynamic";

const actionLabels: Record<string, string> = {
  CREATE: "Creare",
  UPDATE: "Actualizare",
  DELETE: "Ștergere",
  SEND_EMAIL: "Trimitere email",
  LOGIN: "Autentificare",
};

const actionColors: Record<string, string> = {
  CREATE: "bg-green-900/30 text-green-400",
  UPDATE: "bg-blue-900/30 text-blue-400",
  DELETE: "bg-red-900/30 text-red-400",
  SEND_EMAIL: "bg-purple-900/30 text-purple-400",
  LOGIN: "bg-slate-700 text-slate-300",
};

const entityLabels: Record<string, string> = {
  Incident: "Sesizare",
  Client: "Client",
  Site: "Obiectiv",
  EmailTemplate: "Template email",
  User: "Utilizator",
};

export default async function AuditPage() {
  const orgId = await getOrgId();

  const logs = await prisma.auditLog.findMany({
    where: { organizationId: orgId },
    include: {
      user: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Jurnal de audit</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activitate recentă</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Ora</TableHead>
                <TableHead>Utilizator</TableHead>
                <TableHead>Acțiune</TableHead>
                <TableHead>Entitate</TableHead>
                <TableHead>ID Entitate</TableHead>
                <TableHead>Detalii</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nu există înregistrări.
                  </TableCell>
                </TableRow>
              )}
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(log.createdAt), "dd.MM.yyyy HH:mm:ss", {
                      locale: ro,
                    })}
                  </TableCell>
                  <TableCell className="font-medium">{log.user.name}</TableCell>
                  <TableCell>
                    <Badge className={actionColors[log.action] || "bg-slate-700 text-slate-300"}>
                      {actionLabels[log.action] || log.action}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {entityLabels[log.entityType] || log.entityType}
                  </TableCell>
                  <TableCell className="font-mono text-xs max-w-[120px] truncate">
                    {log.entityId || "—"}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                    {log.details || "—"}
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
