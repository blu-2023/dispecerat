import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Camera, Mail, Clock, Shield, Users } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ro } from "date-fns/locale";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const orgId = await getOrgId();

  const [
    totalIncidents,
    newIncidents,
    sentToday,
    criticalIncidents,
    vpnSites,
    recentIncidents,
  ] = await Promise.all([
    prisma.incident.count({ where: { organizationId: orgId } }),
    prisma.incident.count({ where: { organizationId: orgId, status: "NEW" } }),
    prisma.incident.count({
      where: {
        organizationId: orgId,
        status: "SENT",
        updatedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
    prisma.incident.count({
      where: { organizationId: orgId, severity: "CRITICAL", status: { in: ["NEW", "IN_PROGRESS"] } },
    }),
    prisma.site.count({ where: { organizationId: orgId, hasVpnVideo: true, active: true } }),
    prisma.incident.findMany({
      where: { organizationId: orgId },
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { client: true, site: true, createdBy: true },
    }),
  ]);

  const stats = [
    { label: "Sesizări noi", value: newIncidents, icon: AlertTriangle, color: "text-red-400", bg: "bg-red-900/30" },
    { label: "Trimise azi", value: sentToday, icon: Mail, color: "text-green-400", bg: "bg-green-900/30" },
    { label: "Critice active", value: criticalIncidents, icon: Shield, color: "text-orange-400", bg: "bg-orange-900/30" },
    { label: "Obiective VPN", value: vpnSites, icon: Camera, color: "text-blue-400", bg: "bg-blue-900/30" },
    { label: "Total sesizări", value: totalIncidents, icon: Clock, color: "text-purple-400", bg: "bg-purple-900/30" },
  ];

  const severityColors: Record<string, string> = {
    CRITICAL: "bg-red-900/30 text-red-400",
    HIGH: "bg-orange-900/30 text-orange-400",
    MEDIUM: "bg-yellow-900/30 text-yellow-400",
    LOW: "bg-green-900/30 text-green-400",
  };

  const statusColors: Record<string, string> = {
    NEW: "bg-blue-900/30 text-blue-400",
    IN_PROGRESS: "bg-yellow-900/30 text-yellow-400",
    SENT: "bg-green-900/30 text-green-400",
    CONFIRMED: "bg-emerald-900/30 text-emerald-400",
    CLOSED: "bg-slate-700 text-slate-300",
    CANCELLED: "bg-red-900/30 text-red-400",
  };

  const statusLabels: Record<string, string> = {
    NEW: "Nou",
    IN_PROGRESS: "În lucru",
    SENT: "Trimis",
    CONFIRMED: "Confirmat",
    CLOSED: "Închis",
    CANCELLED: "Anulat",
  };

  const incidentTypeLabels: Record<string, string> = {
    persoana_suspecta: "Persoană suspectă",
    acces_neautorizat: "Acces neautorizat",
    incident_parcare: "Incident parcare",
    comportament_suspect: "Comportament suspect",
    perimetru_incalcat: "Perimetru încălcat",
    efractie: "Efracție",
    lipsa_tensiune: "Lipsă tensiune",
    verificare_client: "Verificare client",
    "staționare_nepermisa": "Staționare nepermisă",
    incident_tehnic: "Incident tehnic",
    panica: "Panică",
    incendiu: "Incendiu",
    sabotaj: "Sabotaj",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard Dispecerat</h1>
        <div className="flex gap-2">
          <Link
            href="/vpn-sites"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
          >
            <Camera className="w-4 h-4" />
            Obiective VPN
          </Link>
          <Link
            href="/incidents/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition"
          >
            <AlertTriangle className="w-4 h-4" />
            Sesizare nouă
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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

      {/* Recent Incidents */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Sesizări recente</CardTitle>
          <Link href="/incidents" className="text-sm text-blue-400 hover:underline">
            Vezi toate
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentIncidents.map((incident) => (
              <Link
                key={incident.id}
                href={`/incidents/${incident.id}`}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-700 hover:bg-slate-700 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={severityColors[incident.severity]}>
                        {incident.severity}
                      </Badge>
                      <span className="font-medium text-sm">
                        {incidentTypeLabels[incident.incidentType] || incident.incidentType}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{incident.client.name}</span>
                      <span>•</span>
                      <span>{incident.site.name}</span>
                      <span>•</span>
                      <Badge variant="outline" className="text-[10px]">
                        {incident.source === "VPN_VIDEO" ? "VPN" : "Manual"}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={statusColors[incident.status]}>
                    {statusLabels[incident.status]}
                  </Badge>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(incident.createdAt), {
                      addSuffix: true,
                      locale: ro,
                    })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
