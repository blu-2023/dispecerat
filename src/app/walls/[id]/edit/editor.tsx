"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type Camera = {
  id: string;
  name: string;
  rtspUrl: string;
  enabled: boolean;
  yoloEnabled: boolean;
  position: number;
  monitor: number;
};
type SiteRow = {
  id: string;
  name: string;
  code: string;
  client: { id: string; name: string };
  cameras: Camera[];
};
type WallSite = { id: string; siteId: string; position: number; site: SiteRow };
type Wall = {
  id: string;
  name: string;
  cols: number;
  rows: number;
  monitor: number;
  notes?: string | null;
  sites: WallSite[];
};

export default function WallEditor({
  wall: initialWall, allSites, clients,
}: {
  wall: Wall;
  allSites: { id: string; code: string; name: string; clientName: string }[];
  clients: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [wall, setWall] = useState(initialWall);
  const [, startTransition] = useTransition();
  const [savingLayout, setSavingLayout] = useState(false);
  const [showNewSite, setShowNewSite] = useState(false);
  const [showPickSite, setShowPickSite] = useState(false);
  const totalCameras = wall.sites.reduce((acc, ws) => acc + ws.site.cameras.length, 0);

  function refresh() { startTransition(() => router.refresh()); }

  async function saveLayout() {
    setSavingLayout(true);
    await fetch(`/api/walls/${wall.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: wall.name, cols: wall.cols, rows: wall.rows, monitor: wall.monitor, notes: wall.notes }),
    });
    setSavingLayout(false);
    refresh();
  }

  async function deleteWall() {
    if (!confirm(`Ștergi peretele „${wall.name}"? Camerele și locațiile NU se șterg.`)) return;
    const r = await fetch(`/api/walls/${wall.id}`, { method: "DELETE" });
    if (r.ok) router.push("/walls");
  }

  async function attachSite(siteId: string) {
    const r = await fetch(`/api/walls/${wall.id}/sites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId }),
    });
    if (r.ok) { setShowPickSite(false); window.location.reload(); }
  }

  async function detachSite(siteId: string) {
    if (!confirm("Scoți această locație de pe perete? (camerele nu se șterg)")) return;
    const r = await fetch(`/api/walls/${wall.id}/sites/${siteId}`, { method: "DELETE" });
    if (r.ok) window.location.reload();
  }

  const attachedIds = new Set(wall.sites.map(ws => ws.siteId));
  const availableSites = allSites.filter(s => !attachedIds.has(s.id));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/walls" className="text-sm text-blue-400 hover:underline">← Pereți video</Link>
          <h1 className="text-2xl font-bold mt-1">Editare perete: {wall.name}</h1>
          <p className="text-sm text-muted-foreground">
            Monitor #{wall.monitor} · {wall.cols}×{wall.rows} · {totalCameras} camere total
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/walls/${wall.id}`} target="_blank" rel="noopener">
            <Button>▶ Deschide live</Button>
          </Link>
          <Button variant="destructive" onClick={deleteWall}>Șterge peretele</Button>
        </div>
      </div>

      {/* Layout settings */}
      <Card>
        <CardHeader><CardTitle className="text-base">Setări layout</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <Label>Nume</Label>
            <Input value={wall.name} onChange={e => setWall({ ...wall, name: e.target.value })} />
          </div>
          <div>
            <Label>Coloane</Label>
            <Input type="number" min={1} max={10} value={wall.cols} onChange={e => setWall({ ...wall, cols: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Rânduri</Label>
            <Input type="number" min={1} max={10} value={wall.rows} onChange={e => setWall({ ...wall, rows: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Monitor implicit</Label>
            <Input type="number" min={0} max={20} value={wall.monitor} onChange={e => setWall({ ...wall, monitor: Number(e.target.value) })} />
          </div>
          <div className="md:col-span-4">
            <Button onClick={saveLayout} disabled={savingLayout}>{savingLayout ? "Se salvează…" : "Salvează setările"}</Button>
          </div>
        </CardContent>
      </Card>

      {/* Sites + cameras */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Locații și camere pe acest perete</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPickSite(v => !v)}>+ Atașează locație existentă</Button>
          <Button onClick={() => setShowNewSite(v => !v)}>+ Creează locație nouă</Button>
        </div>
      </div>

      {showPickSite && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label>Locații disponibile (neatașate)</Label>
            {availableSites.length === 0 ? (
              <p className="text-sm text-muted-foreground">Toate locațiile sunt deja atașate. Creează una nouă.</p>
            ) : (
              <Select onValueChange={v => v && attachSite(v)}>
                <SelectTrigger><SelectValue placeholder="Alege o locație…" /></SelectTrigger>
                <SelectContent>
                  {availableSites.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      [{s.code}] {s.name} — {s.clientName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
      )}

      {showNewSite && (
        <NewSiteInline
          clients={clients}
          wallId={wall.id}
          onDone={() => { setShowNewSite(false); window.location.reload(); }}
        />
      )}

      {wall.sites.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Niciun obiectiv încă pe acest perete. Atașează unul existent sau creează unul nou.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {wall.sites.map(ws => (
            <SiteSection
              key={ws.id}
              wallSite={ws}
              onChanged={() => window.location.reload()}
              onDetach={() => detachSite(ws.siteId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NewSiteInline({
  clients, wallId, onDone,
}: { clients: { id: string; name: string }[]; wallId: string; onDone: () => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [showNewClient, setShowNewClient] = useState(clients.length === 0);
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    let cid = clientId;
    if (showNewClient) {
      // Create client first.
      const cr = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newClientName, email: newClientEmail || `${newClientName.toLowerCase().replace(/\s+/g, ".")}@example.local` }),
      });
      if (!cr.ok) { setBusy(false); setErr((await cr.json().catch(() => ({}))).error || "Eroare client"); return; }
      cid = (await cr.json()).id;
    }
    // Create site.
    const sr = await fetch("/api/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: cid, name, code }),
    });
    if (!sr.ok) { setBusy(false); setErr((await sr.json().catch(() => ({}))).error || "Eroare obiectiv"); return; }
    const site = await sr.json();
    // Attach to wall.
    await fetch(`/api/walls/${wallId}/sites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId: site.id }),
    });
    setBusy(false);
    onDone();
  }

  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={submit} className="space-y-3">
          <div className="text-sm font-medium">Creează locație nouă și atașează-o la perete</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nume locație</Label>
              <Input value={name} onChange={e => setName(e.target.value)} required placeholder="ex: Sediu Central" />
            </div>
            <div>
              <Label>Cod obiectiv (unic)</Label>
              <Input value={code} onChange={e => setCode(e.target.value)} required placeholder="ex: SC-001" />
            </div>
          </div>
          <div>
            <Label>Client</Label>
            {!showNewClient ? (
              <div className="flex gap-2">
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Alege clientul…" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={() => setShowNewClient(true)}>+ Client nou</Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Input value={newClientName} onChange={e => setNewClientName(e.target.value)} required placeholder="Nume client" />
                <Input type="email" value={newClientEmail} onChange={e => setNewClientEmail(e.target.value)} placeholder="email@client.ro (opțional)" />
                {clients.length > 0 && <Button type="button" variant="outline" onClick={() => setShowNewClient(false)} className="col-span-2">Alege client existent</Button>}
              </div>
            )}
          </div>
          {err && <div className="text-sm text-red-400">{err}</div>}
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>{busy ? "Se creează…" : "Creează și atașează"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SiteSection({
  wallSite, onChanged, onDetach,
}: { wallSite: WallSite; onChanged: () => void; onDetach: () => void }) {
  const site = wallSite.site;
  const [showNewCam, setShowNewCam] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">
              [{site.code}] {site.name}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{site.client.name} · {site.cameras.length} camere</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setShowNewCam(v => !v)}>+ Adaugă cameră aici</Button>
            <Button size="sm" variant="outline" onClick={onDetach}>Scoate de pe perete</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {showNewCam && (
          <CameraInlineForm siteId={site.id} onDone={() => { setShowNewCam(false); onChanged(); }} />
        )}
        {site.cameras.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nicio cameră în această locație. Apasă „+ Adaugă cameră aici".</p>
        ) : (
          <ul className="space-y-1">
            {site.cameras.map(c => (
              <CameraRow key={c.id} camera={c} onChanged={onChanged} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function CameraInlineForm({ siteId, onDone, initial }: { siteId: string; onDone: () => void; initial?: Camera }) {
  const [name, setName] = useState(initial?.name || "");
  const [rtspUrl, setRtspUrl] = useState(initial?.rtspUrl || "");
  const [position, setPosition] = useState(initial?.position ?? 0);
  const [yoloEnabled, setYoloEnabled] = useState(initial?.yoloEnabled ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const url = initial ? `/api/cameras/${initial.id}` : "/api/cameras";
    const method = initial ? "PATCH" : "POST";
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId, name, rtspUrl, position: Number(position), yoloEnabled }),
    });
    setBusy(false);
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error || "Eroare"); return; }
    onDone();
  }

  return (
    <form onSubmit={submit} className="p-3 bg-neutral-900/50 border border-neutral-800 rounded-md space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
        <div className="md:col-span-2">
          <Label className="text-xs">Nume cameră</Label>
          <Input value={name} onChange={e => setName(e.target.value)} required placeholder="ex: Intrare" />
        </div>
        <div className="md:col-span-3">
          <Label className="text-xs">URL RTSP</Label>
          <Input value={rtspUrl} onChange={e => setRtspUrl(e.target.value)} required placeholder="rtsp://user:pass@10.0.0.5:554/..." />
        </div>
        <div>
          <Label className="text-xs">Poz.</Label>
          <Input type="number" min={0} value={position} onChange={e => setPosition(Number(e.target.value))} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={yoloEnabled} onChange={e => setYoloEnabled(e.target.checked)} /> YOLO human detection
      </label>
      {err && <div className="text-xs text-red-400">{err}</div>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy}>{busy ? "…" : (initial ? "Salvează" : "Adaugă cameră")}</Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>Anulează</Button>
      </div>
    </form>
  );
}

function CameraRow({ camera, onChanged }: { camera: Camera; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);

  async function remove() {
    if (!confirm(`Ștergi camera „${camera.name}"?`)) return;
    const r = await fetch(`/api/cameras/${camera.id}`, { method: "DELETE" });
    if (r.ok) onChanged();
  }

  if (editing) {
    return (
      <li>
        <CameraInlineForm
          siteId={""}
          initial={camera}
          onDone={() => { setEditing(false); onChanged(); }}
        />
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between px-3 py-2 rounded bg-neutral-900/50 border border-neutral-800">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{camera.name}</span>
          <Badge className={camera.yoloEnabled ? "bg-green-900/30 text-green-400" : "bg-slate-700 text-slate-300"}>
            YOLO {camera.yoloEnabled ? "ON" : "OFF"}
          </Badge>
          <Badge className="bg-neutral-800 text-neutral-300 font-mono">poz {camera.position}</Badge>
        </div>
        <div className="text-xs text-muted-foreground font-mono truncate" title={camera.rtspUrl}>{camera.rtspUrl}</div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Editează</Button>
        <Button size="sm" variant="destructive" onClick={remove}>Șterge</Button>
      </div>
    </li>
  );
}
