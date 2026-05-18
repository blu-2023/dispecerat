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
import { format, formatDistanceToNow } from "date-fns";
import { ro } from "date-fns/locale";
import Link from "next/link";
import { Radio, Wifi, AlertTriangle, Bell, XCircle } from "lucide-react";
import {
  sekaStatusColors,
  sekaEventStatusColors,
  severityColors,
  severityLabels,
} from "@/lib/constants";
import PollButton from "@/components/seka/PollButton";

export const dynamic = "force-dynamic";

export default async function SekaPage() {
  const orgId = await getOrgId();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [receivers, eventsToday, newEvents, errorEvents, recentEvents] =
    await Promise.all([
      prisma.sekaReceiver.findMany({
        where: { organizationId: orgId },
        orderBy: { name: "asc" },
      }),
      prisma.sekaEvent.count({
        where: { organizationId: orgId, createdAt: { gte: todayStart } },
      }),
      prisma.sekaEvent.count({
        where: { organizationId: orgId, status: "NEW" },
      }),
      prisma.sekaEvent.count({
        where: { organizationId: orgId, status: "ERROR" },
      }),
      prisma.sekaEvent.findMany({
        where: { organizationId: orgId },
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
          receiver: { select: { name: true } },
          site: { select: { name: true } },
        },
      }),
    ]);

  const onlineCount = receivers.filter((r) => r.status === "ONLINE").length;

  const stats = [
    {
      label: "Receptoare online",
      value: `${onlineCount}/${receivers.length}`,
      icon: Wifi,
      color: "text-green-400",
      bg: "bg-green-900/30",
    },
    {
      label: "Evenimente azi",
      value: eventsToday,
      icon: Bell,
      color: "text-blue-400",
      bg: "bg-blue-900/30",
    },
    {
      label: "Evenimente noi",
      value: newEvents,
      icon: AlertTriangle,
      color: "text-yellow-400",
      bg: "bg-yellow-900/30",
    },
    {
      label: "Erori",
      value: errorEvents,
      icon: XCircle,
      color: "text-red-400",
      bg: "bg-red-900/30",
    },
  ];

  const sekaStatusLabels: Record<string, string> = {
    ONLINE: "Online",
    OFFLINE: "Offline",
    ERROR: "Eroare",
  };

  const sekaEventStatusLabels: Record<string, string> = {
    NEW: "Nou",
    PROCESSED: "Procesat",
    IGNORED: "Ignorat",
    ERROR: "Eroare",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Radio className="w-6 h-6 text-orange-400" />
          <h1 className="text-2xl font-bold">SEKA - Receptoare alarme</h1>
        </div>
        <div className="flex items-center gap-3">
          <PollButton />
          <Link
            href="/seka/receivers/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
          >
            Adaug&#259; receptor
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Receivers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Receptoare SEKA</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nume</TableHead>
                <TableHead>IP:Port</TableHead>
                <TableHead>Protocol</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ultimul poll</TableHead>
                <TableHead>Activ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receivers.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    Nu exist&#259; receptoare configurate.
                  </TableCell>
                </TableRow>
              )}
              {receivers.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {r.ipAddress}:{r.port}
                  </TableCell>
                  <TableCell>{r.protocol}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        sekaStatusColors[r.status] ||
                        "bg-slate-700 text-slate-300"
                      }
                    >
                      {sekaStatusLabels[r.status] || r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-400">
                    {r.lastPollAt
                      ? formatDistanceToNow(new Date(r.lastPollAt), {
                          addSuffix: true,
                          locale: ro,
                        })
                      : "Niciodat&#259;"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        r.active
                          ? "bg-green-900/30 text-green-400"
                          : "bg-slate-700 text-slate-300"
                      }
                    >
                      {r.active ? "Da" : "Nu"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Evenimente recente</CardTitle>
          <Link
            href="/seka/events"
            className="text-sm text-blue-400 hover:underline"
          >
            Vezi toate
          </Link>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ora</TableHead>
                <TableHead>Receptor</TableHead>
                <TableHead>Cont</TableHead>
                <TableHead>Eveniment</TableHead>
                <TableHead>Severitate</TableHead>
                <TableHead>Zon&#259;</TableHead>
                <TableHead>Obiectiv</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentEvents.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-muted-foreground"
                  >
                    Nu exist&#259; evenimente.
                  </TableCell>
                </TableRow>
              )}
              {recentEvents.map((ev) => (
                <TableRow key={ev.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {format(new Date(ev.createdAt), "HH:mm:ss", {
                      locale: ro,
                    })}
                  </TableCell>
                  <TableCell className="text-sm">
                    {ev.receiver.name}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {ev.accountCode}
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
