"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  sites: { id: string; label: string }[];
  initial?: {
    id: string;
    siteId: string;
    name: string;
    rtspUrl: string;
    enabled: boolean;
    yoloEnabled: boolean;
    position: number;
    monitor: number;
    notes?: string | null;
  };
};

export default function CameraForm({ sites, initial }: Props) {
  const router = useRouter();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [rtspUrl, setRtspUrl] = useState(initial?.rtspUrl ?? "");
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [yoloEnabled, setYoloEnabled] = useState(initial?.yoloEnabled ?? true);
  const [monitor, setMonitor] = useState(initial?.monitor ?? 0);
  const [position, setPosition] = useState(initial?.position ?? 0);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const payload = { siteId, name, rtspUrl, enabled, yoloEnabled, monitor: Number(monitor), position: Number(position), notes };
    const url = initial ? `/api/cameras/${initial.id}` : "/api/cameras";
    const method = initial ? "PATCH" : "POST";
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!r.ok) {
      setErr((await r.json().catch(() => ({}))).error || "Eroare");
      return;
    }
    router.push("/cameras");
    router.refresh();
  }

  async function remove() {
    if (!initial) return;
    if (!confirm("Ștergi camera?")) return;
    const r = await fetch(`/api/cameras/${initial.id}`, { method: "DELETE" });
    if (r.ok) { router.push("/cameras"); router.refresh(); }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={save} className="space-y-4">
          <div>
            <Label>Obiectiv</Label>
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger><SelectValue placeholder="Alege obiectivul" /></SelectTrigger>
              <SelectContent>
                {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nume cameră</Label>
            <Input value={name} onChange={e => setName(e.target.value)} required placeholder="ex: Intrare principală" />
          </div>
          <div>
            <Label>URL RTSP</Label>
            <Input value={rtspUrl} onChange={e => setRtspUrl(e.target.value)} required placeholder="rtsp://user:pass@10.0.0.5:554/stream1" />
            <p className="text-xs text-muted-foreground mt-1">Suportă RTSP/RTSPS. Parola nu apare ulterior decât pe acest server.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Monitor (0..N)</Label>
              <Input type="number" min={0} value={monitor} onChange={e => setMonitor(Number(e.target.value))} />
            </div>
            <div>
              <Label>Poziție în grilă</Label>
              <Input type="number" min={0} value={position} onChange={e => setPosition(Number(e.target.value))} />
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
              Activă (apare pe video wall)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={yoloEnabled} onChange={e => setYoloEnabled(e.target.checked)} />
              YOLO detection
            </label>
          </div>
          <div>
            <Label>Notițe</Label>
            <Textarea value={notes ?? ""} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
          {err && <div className="text-sm text-red-400">{err}</div>}
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={busy}>{busy ? "Se salvează…" : (initial ? "Salvează modificările" : "Adaugă camera")}</Button>
            {initial && <Button type="button" variant="destructive" onClick={remove}>Șterge</Button>}
            <Button type="button" variant="outline" onClick={() => router.push("/cameras")}>Anulează</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
