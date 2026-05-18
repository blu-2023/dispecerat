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
import { renderTemplate } from "@/lib/email";
import EmailSendDialog from "@/components/incidents/EmailSendDialog";

export const dynamic = "force-dynamic";

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await getOrgId();

  const incident = await prisma.incident.findUnique({
    where: { id, organizationId: orgId },
    include: {
      client: true,
      site: true,
      createdBy: { select: { id: true, name: true, email: true, role: true } },
      assignedTo: { select: { id: true, name: true, email: true, role: true } },
      emails: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!incident) {
    notFound();
  }

  // Load templates for this incident's source type
  const templates = await prisma.emailTemplate.findMany({
    where: {
      organizationId: orgId,
      active: true,
      OR: [
        { clientId: incident.clientId },
        { clientId: null },
      ],
      type: incident.source,
    },
    orderBy: { createdAt: "desc" },
  });

  // Prepare template variables
  const templateVars: Record<string, string> = {
    clientName: incident.client.name,
    siteName: incident.site.name,
    siteCode: incident.site.code,
    siteAddress: incident.site.address || "",
    incidentType: incidentTypeLabels[incident.incidentType] || incident.incidentType,
    severity: severityLabels[incident.severity] || incident.severity,
    description: incident.description,
    eventTime: format(new Date(incident.eventTime), "dd.MM.yyyy HH:mm", { locale: ro }),
    timeRange: incident.timeRange || "",
    measures: incident.measures || "",
    operatorName: incident.createdBy.name,
    date: format(new Date(), "dd.MM.yyyy", { locale: ro }),
  };

  // Render the first available template for the email dialog defaults
  const defaultTemplate = templates[0];
  const renderedSubject = defaultTemplate
    ? renderTemplate(defaultTemplate.subjectTemplate, templateVars)
    : `Sesizare: ${incidentTypeLabels[incident.incidentType] || incident.incidentType} - ${incident.site.name}`;
  const renderedBody = defaultTemplate
    ? renderTemplate(defaultTemplate.bodyTemplate, templateVars)
    : `Sesizare ${incidentTypeLabels[incident.incidentType] || incident.incidentType}\n\nObiectiv: ${incident.site.name}\nData: ${templateVars.eventTime}\n\nDescriere:\n${incident.description}\n\nMăsuri: ${incident.measures || "—"}`;

  const emailStatusLabels: Record<string, string> = {
    PENDING: "În așteptare",
    SENT: "Trimis",
    FAILED: "Eșuat",
  };

  const emailStatusColors: Record<string, string> = {
    PENDING: "bg-yellow-900/30 text-yellow-400",
    SENT: "bg-green-900/30 text-green-400",
    FAILED: "bg-red-900/30 text-red-400",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {incidentTypeLabels[incident.incidentType] || incident.incidentType}
          </h1>
          <p className="text-muted-foreground">
            {incident.site.name} ({incident.site.code})
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/incidents">
            <Button variant="outline">Înapoi</Button>
          </Link>
          <EmailSendDialog
            incidentId={incident.id}
            defaultTo={incident.client.email}
            defaultSubject={renderedSubject}
            defaultBody={renderedBody}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Detalii sesizare</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Badge className={severityColors[incident.severity]}>
                {severityLabels[incident.severity] || incident.severity}
              </Badge>
              <Badge className={statusColors[incident.status]}>
                {statusLabels[incident.status] || incident.status}
              </Badge>
              <Badge variant="outline">
                {incident.source === "VPN_VIDEO" ? "VPN Video" : "Manual"}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tip incident</p>
              <p className="font-medium">
                {incidentTypeLabels[incident.incidentType] || incident.incidentType}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Data evenimentului</p>
              <p className="font-medium">
                {format(new Date(incident.eventTime), "dd.MM.yyyy HH:mm", {
                  locale: ro,
                })}
              </p>
            </div>
            {incident.timeRange && (
              <div>
                <p className="text-sm text-muted-foreground">Interval orar</p>
                <p className="font-medium">{incident.timeRange}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Descriere</p>
              <p className="font-medium whitespace-pre-wrap">{incident.description}</p>
            </div>
            {incident.measures && (
              <div>
                <p className="text-sm text-muted-foreground">Măsuri luate</p>
                <p className="font-medium whitespace-pre-wrap">{incident.measures}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Creat la</p>
              <p className="font-medium">
                {format(new Date(incident.createdAt), "dd.MM.yyyy HH:mm:ss", {
                  locale: ro,
                })}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Client și obiectiv</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Client</p>
                <Link
                  href={`/clients/${incident.client.id}`}
                  className="font-medium text-blue-400 hover:underline"
                >
                  {incident.client.name}
                </Link>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email client</p>
                <p className="font-medium">{incident.client.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Obiectiv</p>
                <Link
                  href={`/sites/${incident.site.id}`}
                  className="font-medium text-blue-400 hover:underline"
                >
                  {incident.site.name} ({incident.site.code})
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Operator</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Creat de</p>
                <p className="font-medium">{incident.createdBy.name}</p>
              </div>
              {incident.assignedTo && (
                <div>
                  <p className="text-sm text-muted-foreground">Atribuit la</p>
                  <p className="font-medium">{incident.assignedTo.name}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Emailuri trimise ({incident.emails.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {incident.emails.length === 0 ? (
            <p className="text-muted-foreground">
              Nu a fost trimis niciun email pentru această sesizare.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Destinatar</TableHead>
                  <TableHead>Subiect</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trimis la</TableHead>
                  <TableHead>Eroare</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incident.emails.map((email) => (
                  <TableRow key={email.id}>
                    <TableCell>{email.toEmail}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {email.subject}
                    </TableCell>
                    <TableCell>
                      <Badge className={emailStatusColors[email.sentStatus]}>
                        {emailStatusLabels[email.sentStatus] || email.sentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {email.sentAt
                        ? format(new Date(email.sentAt), "dd.MM.yyyy HH:mm", {
                            locale: ro,
                          })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-red-400 text-sm max-w-xs truncate">
                      {email.errorMessage || "—"}
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
