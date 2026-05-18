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
import Link from "next/link";
import { Radio } from "lucide-react";
import {
  sekaEventStatusColors,
  severityColors,
  severityLabels,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

const sekaEventStatusLabels: Record<string, string> = {
  NEW: "Nou",
  PROCESSED: "Procesat",
  IGNORED: "Ignorat",
  ERROR: "Eroare",
};

export default async function SekaEventsPage() {
  const orgId = await getOrgId();

  const events = await prisma.sekaEvent.findMany({
    where: { organizationId: orgId },
    take: 200,
    orderBy: { createdAt: "desc" },
    include: {
      receiver: { select: { name: true } },
      site: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Radio className="w-6 h-6 text-orange-400" />
          <h1 className="text-2xl font-bold">Evenimente SEKA</h1>
        </div>
        <Link
          href="/seka"
          className="text-sm text-blue-400 hover:underline"
        >
          Înapoi la SEKA
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Jurnal evenimente ({events.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Ora</TableHead>
                <TableHead>Receptor</TableHead>
                <TableHead>Cont</TableHead>
                <TableHead>Cod</TableHead>
                <TableHead>Q</TableHead>
                <TableHead>Eveniment</TableHead>
                <TableHead>Severitate</TableHead>
                <TableHead>Zon&#259;</TableHead>
                <TableHead>Obiectiv</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sesizare</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={11}
                    className="text-center text-muted-foreground"
                  >
                    Nu exist&#259; evenimente.
                  </TableCell>
                </TableRow>
              )}
              {events.map((ev) => (
                <TableRow key={ev.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {format(new Date(ev.createdAt), "dd.MM.yyyy HH:mm:ss", {
                      locale: ro,
                    })}
                  </TableCell>
                  <TableCell className="text-sm">
                    {ev.receiver.name}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {ev.accountCode}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {ev.eventCode}
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    {ev.eventQualifier}
                  </TableCell>
                  <TableCell className="text-sm">{ev.eventLabel}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        severityColors[ev.severity] ||
                        "bg-slate-700 text-slate-300"
                      }
                    >
                      {severityLabels[ev.severity] || ev.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {ev.zone || "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {ev.site?.name || (
                      <span className="text-slate-500">Nemapat</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        sekaEventStatusColors[ev.status] ||
                        "bg-slate-700 text-slate-300"
                      }
                    >
                      {sekaEventStatusLabels[ev.status] || ev.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {ev.incidentId ? (
                      <Link
                        href={`/incidents/${ev.incidentId}`}
                        className="text-blue-400 hover:underline text-sm"
                      >
                        Deschide
                      </Link>
                    ) : (
                      <span className="text-slate-500 text-sm">—</span>
                    )}
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
