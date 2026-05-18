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

const typeLabels: Record<string, string> = {
  VPN_VIDEO: "VPN Video",
  MANUAL: "Manual",
  ALARM: "Alarmă",
};

export default async function TemplatesPage() {
  const orgId = await getOrgId();

  const templates = await prisma.emailTemplate.findMany({
    where: { organizationId: orgId },
    include: {
      client: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Template-uri email</h1>
        <Link href="/templates/new"><Button>+ Adaugă template</Button></Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista template-urilor</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nume</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Subiect</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nu există template-uri.
                  </TableCell>
                </TableRow>
              )}
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">
                    <Link href={`/templates/${template.id}/edit`} className="text-blue-400 hover:underline">
                      {template.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {typeLabels[template.type] || template.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {template.client ? template.client.name : "Global"}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                    {template.subjectTemplate}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        template.active
                          ? "bg-green-900/30 text-green-400"
                          : "bg-slate-700 text-slate-300"
                      }
                    >
                      {template.active ? "Activ" : "Inactiv"}
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
