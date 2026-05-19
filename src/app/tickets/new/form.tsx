"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function NewTicketForm({
  sites, technicians, defaults,
}: {
  sites: { id: string; name: string; code: string }[];
  technicians: { id: string; name: string; role: string }[];
  defaults: { incidentId?: string; siteId?: string; cameraId?: string; nvrId?: string; category?: string; title?: string };
}) {
  const router = useRouter();
  const [category, setCategory] = useState(defaults.category || "OTHER");
  const [priority, setPriority] = useState("NORMAL");
  const [title, setTitle] = useState(defaults.title || "");
  const [description, setDescription] = useState("");
  const [siteId, setSiteId] = useState(defaults.siteId || "_");
  const [assignedToId, setAssignedToId] = useState("_");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const r = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category, priority, title, description,
        siteId: siteId === "_" ? null : siteId,
        assignedToId: assignedToId === "_" ? null : assignedToId,
        incidentId: defaults.incidentId,
        cameraId: defaults.cameraId,
        nvrId: defaults.nvrId,
      }),
    });
    setBusy(false);
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error || "Eroare"); return; }
    const t = await r.json();
    router.push(`/tickets/${t.id}`);
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Categorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CAMERA_OFFLINE">Cameră offline / nu transmite</SelectItem>
                  <SelectItem value="NVR_ISSUE">NVR / DVR — defect / cădere</SelectItem>
                  <SelectItem value="SEKA_ISSUE">SEKA — alarme nu vin / receptor</SelectItem>
                  <SelectItem value="NETWORK">Rețea — switch / LAN</SelectItem>
                  <SelectItem value="VPN">VPN — tunel căzut / lent</SelectItem>
                  <SelectItem value="SOFTWARE">Software dispecerat</SelectItem>
                  <SelectItem value="OTHER">Altul</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioritate</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Scăzută</SelectItem>
                  <SelectItem value="NORMAL">Normală</SelectItem>
                  <SelectItem value="HIGH">Ridicată (afectează operarea)</SelectItem>
                  <SelectItem value="CRITICAL">Critică (sistem down)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Titlu</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} required placeholder="ex: Camera Preciziei canal 7 nu transmite" />
            </div>
            <div className="md:col-span-2">
              <Label>Descriere detaliată</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} required rows={5}
                placeholder="Ce s-a întâmplat, când, ce ai încercat, mesaje de eroare, observații…" />
            </div>
            <div>
              <Label>Obiectiv afectat (opțional)</Label>
              <Select value={siteId} onValueChange={setSiteId}>
                <SelectTrigger><SelectValue placeholder="Niciunul / general" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_">— niciunul —</SelectItem>
                  {sites.map(s => <SelectItem key={s.id} value={s.id}>[{s.code}] {s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Atribuie tehnicianului (opțional)</Label>
              <Select value={assignedToId} onValueChange={setAssignedToId}>
                <SelectTrigger><SelectValue placeholder="Neasignat — îl preia oricine" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_">— neasignat —</SelectItem>
                  {technicians.map(t => <SelectItem key={t.id} value={t.id}>{t.name} ({t.role})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {defaults.incidentId && (
            <div className="text-xs text-muted-foreground p-2 rounded bg-blue-950/30 border border-blue-900/40">
              ↳ Ticket asociat incidentului <code>#{defaults.incidentId.slice(-6)}</code> — va apărea în timeline-ul incidentului.
            </div>
          )}

          {err && <div className="text-sm text-red-400">{err}</div>}
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>{busy ? "Se creează…" : "Deschide ticket"}</Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>Anulează</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
