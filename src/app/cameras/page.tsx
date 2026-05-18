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

export default async function CamerasPage() {
  const orgId = await getOrgId();

  const cameras = await prisma.camera.findMany({
    where: { organizationId: orgId },
    include: {
      site: { include: { client: { select: { id: true, name: true } } } },
    },
    orderBy: [{ monitor: "asc" }, { position: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Camere</h1>
          <p className="text-sm text-muted-foreground">
            Surse RTSP pentru video wall. Ordinea pe monitor o dă „Monitor / Poziție".
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/cameras/new"><Button>+ Cameră nouă</Button></Link>
          <Link href="/walls"><Button variant="outline">Pereți video</Button></Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista camerelor ({cameras.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nume</TableHead>
                <TableHead>Obiectiv</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>RTSP</TableHead>
                <TableHead>Monitor</TableHead>
                <TableHead>Poz.</TableHead>
                <TableHead>YOLO</TableHead>
                <TableHead>Activ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cameras.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Nicio cameră. <Link href="/cameras/new" className="text-blue-400 hover:underline">Adaugă una</Link>.
                  </TableCell>
                </TableRow>
              )}
              {cameras.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/cameras/${c.id}`} className="font-medium text-blue-400 hover:underline">
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/sites/${c.site.id}`} className="hover:underline">
                      [{c.site.code}] {c.site.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.site.client.name}</TableCell>
                  <TableCell className="font-mono text-xs max-w-xs truncate" title={c.rtspUrl}>
                    {c.rtspUrl}
                  </TableCell>
                  <TableCell className="font-mono">#{c.monitor}</TableCell>
                  <TableCell className="font-mono">{c.position}</TableCell>
                  <TableCell>
                    <Badge className={c.yoloEnabled ? "bg-green-900/30 text-green-400" : "bg-slate-700 text-slate-300"}>
                      {c.yoloEnabled ? "ON" : "OFF"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={c.enabled ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}>
                      {c.enabled ? "Activ" : "Oprit"}
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
