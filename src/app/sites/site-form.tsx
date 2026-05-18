"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type SiteFormData = {
  id?: string;
  clientId: string;
  name: string;
  code: string;
  address?: string | null;
  hasVpnVideo: boolean;
  vpnLink?: string | null;
  vpnUsername?: string | null;
  vpnNotes?: string | null;
  monitoringSchedule?: string | null;
  services?: string | null;
  sekaAccountCode?: string | null;
  notes?: string | null;
};

export default function SiteForm({
  initial, clients, defaultClientId,
}: {
  initial?: SiteFormData;
  clients: { id: string; name: string }[];
  defaultClientId?: string;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(initial?.clientId ?? defaultClientId ?? clients[0]?.id ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [hasVpnVideo, setHasVpnVideo] = useState(initial?.hasVpnVideo ?? false);
  const [vpnLink, setVpnLink] = useState(initial?.vpnLink ?? "");
  const [vpnUsername, setVpnUsername] = useState(initial?.vpnUsername ?? "");
  const [vpnNotes, setVpnNotes] = useState(initial?.vpnNotes ?? "");
  const [monitoringSchedule, setMonitoringSchedule] = useState(initial?.monitoringSchedule ?? "");
  const [services, setServices] = useState(initial?.services ?? "");
  const [sekaAccountCode, setSekaAccountCode] = useState(initial?.sekaAccountCode ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const url = initial?.id ? `/api/sites/${initial.id}` : "/api/sites";
    const method = initial?.id ? "PUT" : "POST";
    const r = await fetch(url, {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId, name, code,
        address: address || null, hasVpnVideo,
        vpnLink: vpnLink || null, vpnUsername: vpnUsername || null, vpnNotes: vpnNotes || null,
        monitoringSchedule: monitoringSchedule || null, services: services || null,
        sekaAccountCode: sekaAccountCode || null, notes: notes || null,
      }),
    });
    setBusy(false);
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error || "Eroare"); return; }
    const s = await r.json();
    router.push(`/sites/${initial?.id ?? s.id}`);
    router.refresh();
  }

  async function remove() {
    if (!initial?.id) return;
    if (!confirm(`Ștergi obiectivul „${initial.name}"? Camerele și incidentele asociate se șterg.`)) return;
    const r = await fetch(`/api/sites/${initial.id}`, { method: "DELETE" });
    if (r.ok) { router.push("/sites"); router.refresh(); }
    else alert((await r.json().catch(() => ({}))).error || "Eroare la ștergere");
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Alege clientul" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Cod obiectiv (unic)</Label><Input value={code} onChange={e => setCode(e.target.value)} required /></div>
            <div className="md:col-span-2"><Label>Nume obiectiv</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
            <div className="md:col-span-2"><Label>Adresă</Label><Input value={address ?? ""} onChange={e => setAddress(e.target.value)} /></div>
            <div><Label>Cod cont SEKA</Label><Input value={sekaAccountCode ?? ""} onChange={e => setSekaAccountCode(e.target.value)} placeholder="ex: A1234" /></div>
            <div><Label>Servicii (text liber)</Label><Input value={services ?? ""} onChange={e => setServices(e.target.value)} placeholder="ex: alarmă, video, intervenție" /></div>
            <div className="md:col-span-2"><Label>Program monitorizare</Label><Input value={monitoringSchedule ?? ""} onChange={e => setMonitoringSchedule(e.target.value)} placeholder="ex: 24/7 sau L-V 22:00-06:00" /></div>
          </div>

          <div className="pt-3 border-t border-neutral-800 space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={hasVpnVideo} onChange={e => setHasVpnVideo(e.target.checked)} /> Are VPN video (apare pe Obiective VPN)
            </label>
            {hasVpnVideo && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Link VPN</Label><Input value={vpnLink ?? ""} onChange={e => setVpnLink(e.target.value)} /></div>
                <div><Label>Utilizator VPN</Label><Input value={vpnUsername ?? ""} onChange={e => setVpnUsername(e.target.value)} /></div>
                <div className="md:col-span-2"><Label>Notițe VPN</Label><Textarea value={vpnNotes ?? ""} onChange={e => setVpnNotes(e.target.value)} rows={2} /></div>
              </div>
            )}
          </div>

          <div><Label>Notițe generale</Label><Textarea value={notes ?? ""} onChange={e => setNotes(e.target.value)} rows={2} /></div>

          {err && <div className="text-sm text-red-400">{err}</div>}
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={busy}>{busy ? "Se salvează…" : (initial?.id ? "Salvează" : "Adaugă obiectiv")}</Button>
            {initial?.id && <Button type="button" variant="destructive" onClick={remove}>Șterge obiectivul</Button>}
            <Button type="button" variant="outline" onClick={() => router.back()}>Anulează</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
