"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Video, Server, Plus, ChevronDown, ChevronRight, ExternalLink, Trash2 } from "lucide-react";

type Camera = {
  id: string; siteId: string; nvrId?: string | null; channel?: number | null;
  name: string; rtspUrl: string;
  enabled: boolean; yoloEnabled: boolean; position: number; monitor: number;
};
type Nvr = {
  id: string; siteId: string; name: string;
  brand?: string | null; model?: string | null;
  ipAddress: string; webPort: number; rtspPort: number;
  username?: string | null; password?: string | null;
  channelsCount: number; notes?: string | null;
  _count?: { cameras: number };
};
type Site = {
  id: string; name: string; code: string; address?: string | null;
  client: { id: string; name: string };
  nvrs: Nvr[];
  cameras: Camera[];
};

export default function VideoSitesClient({ sites }: { sites: Site[] }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Video className="w-6 h-6" /> Obiective video
          </h1>
          <p className="text-sm text-muted-foreground">
            Pentru fiecare obiectiv: NVR-uri și camere IP. Adaugă, editează, configurează stream-urile pentru Video Wall.
          </p>
        </div>
        <Link href="/sites/new"><Button>+ Obiectiv nou</Button></Link>
      </div>

      {sites.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Niciun obiectiv. <Link href="/sites/new" className="text-blue-400 hover:underline">Adaugă unul</Link>.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sites.map(site => <SiteBlock key={site.id} site={site} />)}
        </div>
      )}
    </div>
  );
}

function SiteBlock({ site }: { site: Site }) {
  const router = useRouter();
  const [open, setOpen] = useState(site.nvrs.length > 0 || site.cameras.length > 0);
  const [addingNvr, setAddingNvr] = useState(false);
  const [addingCam, setAddingCam] = useState(false);

  const camerasOfNvr = (nvrId: string) => site.cameras.filter(c => c.nvrId === nvrId);
  const directCameras = site.cameras.filter(c => !c.nvrId);
  const totalChannels = site.nvrs.reduce((acc, n) => acc + n.channelsCount, 0);
  const totalCams = site.cameras.length;

  function refresh() { router.refresh(); }

  return (
    <Card>
      <CardHeader className="pb-3 cursor-pointer select-none" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            <div className="min-w-0">
              <CardTitle className="text-base truncate">
                [{site.code}] {site.name}
              </CardTitle>
              <div className="text-xs text-muted-foreground truncate">
                {site.client.name}{site.address ? ` · ${site.address}` : ""}
              </div>
            </div>
          </div>
          <div className="flex gap-2 items-center flex-shrink-0">
            <Badge variant="outline">{site.nvrs.length} NVR</Badge>
            <Badge variant="outline">{totalCams} camere</Badge>
            {totalChannels > 0 && <Badge variant="outline">{totalChannels} canale</Badge>}
          </div>
        </div>
      </CardHeader>

      {open && (
        <CardContent className="space-y-4">
          {/* NVRs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Server className="w-4 h-4" /> NVR-uri
              </h3>
              <Button size="xs" onClick={() => setAddingNvr(v => !v)}>
                {addingNvr ? "Anulează" : "+ Adaugă NVR"}
              </Button>
            </div>
            {addingNvr && <NvrInlineForm siteId={site.id} onDone={() => { setAddingNvr(false); refresh(); }} />}
            {site.nvrs.length === 0 && !addingNvr && (
              <div className="text-xs text-muted-foreground italic">Niciun NVR. Adaugă unul sau adaugă camere IP direct mai jos.</div>
            )}
            <div className="space-y-2">
              {site.nvrs.map(nvr => (
                <NvrRow
                  key={nvr.id}
                  nvr={nvr}
                  cameras={camerasOfNvr(nvr.id)}
                  siteId={site.id}
                  onChanged={refresh}
                />
              ))}
            </div>
          </div>

          {/* Direct cameras (no NVR) */}
          <div className="pt-3 border-t border-neutral-800">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Video className="w-4 h-4" /> Camere IP directe (fără NVR)
              </h3>
              <Button size="xs" onClick={() => setAddingCam(v => !v)}>
                {addingCam ? "Anulează" : "+ Adaugă cameră IP"}
              </Button>
            </div>
            {addingCam && <CameraInlineForm siteId={site.id} onDone={() => { setAddingCam(false); refresh(); }} />}
            {directCameras.length === 0 && !addingCam ? (
              <div className="text-xs text-muted-foreground italic">Nicio cameră IP directă.</div>
            ) : (
              <ul className="space-y-1">
                {directCameras.map(c => <CameraRow key={c.id} camera={c} onChanged={refresh} />)}
              </ul>
            )}
          </div>

          <div className="pt-2 border-t border-neutral-800 flex gap-2">
            <Link href={`/sites/${site.id}/edit`}>
              <Button size="sm" variant="outline">Editează obiectivul</Button>
            </Link>
            <Link href={`/incidents/new?siteId=${site.id}&source=VPN_VIDEO`}>
              <Button size="sm" variant="destructive">Sesizare nouă</Button>
            </Link>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function NvrRow({
  nvr, cameras, siteId, onChanged,
}: { nvr: Nvr; cameras: Camera[]; siteId: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addingChannel, setAddingChannel] = useState(false);
  const [importing, setImporting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<null | {
    reachable: boolean;
    web: { port: number; ok: boolean; ms: number; err?: string };
    rtsp: { port: number; ok: boolean; ms: number; err?: string };
  }>(null);
  const webUrl = `http://${nvr.ipAddress}${nvr.webPort && nvr.webPort !== 80 ? `:${nvr.webPort}` : ""}`;

  async function remove() {
    if (!confirm(`Ștergi NVR-ul „${nvr.name}"? Camerele atașate rămân, doar legătura se șterge.`)) return;
    const r = await fetch(`/api/nvrs/${nvr.id}`, { method: "DELETE" });
    if (r.ok) onChanged();
  }

  async function testConnection() {
    setTesting(true); setTestResult(null);
    const r = await fetch(`/api/nvrs/${nvr.id}/test`, { method: "POST" });
    setTesting(false);
    if (r.ok) setTestResult(await r.json());
    else setTestResult({ reachable: false, web: { port: nvr.webPort, ok: false, ms: 0, err: "API error" }, rtsp: { port: nvr.rtspPort, ok: false, ms: 0, err: "API error" } });
  }

  async function importChannels() {
    const total = nvr.channelsCount || 16;
    if (!confirm(`Generează automat camere pentru canalele 1-${total}? Existente nu se duplică.`)) return;
    setImporting(true);
    const r = await fetch(`/api/nvrs/${nvr.id}/import-channels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: 1, to: total, stream: "main", yoloEnabled: true }),
    });
    setImporting(false);
    if (r.ok) {
      const { created } = await r.json();
      if (created > 0) alert(`${created} canale create.`);
      else alert("Toate canalele erau deja create.");
      onChanged();
    } else {
      alert("Eroare la import canale.");
    }
  }

  if (editing) {
    return <NvrInlineForm siteId={siteId} initial={nvr} onDone={() => { setEditing(false); onChanged(); }} />;
  }

  return (
    <div className="border border-neutral-800 rounded-md bg-neutral-900/40">
      <div className="px-3 py-2 flex items-center justify-between gap-3 cursor-pointer hover:bg-neutral-900/70" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
          <Server className="w-4 h-4 text-blue-400" />
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{nvr.name}</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {[nvr.brand, nvr.model].filter(Boolean).join(" ")} · {nvr.ipAddress}:{nvr.rtspPort}
            </div>
          </div>
        </div>
        <div className="flex gap-2 items-center flex-shrink-0">
          <Badge variant="outline">{cameras.length}/{nvr.channelsCount || "?"} canale</Badge>
        </div>
      </div>
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-2">
          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            {nvr.username && <span>user: <span className="font-mono">{nvr.username}</span></span>}
            <a href={webUrl} target="_blank" rel="noopener" className="text-blue-400 hover:underline inline-flex items-center gap-0.5">
              {webUrl} <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          {nvr.notes && <div className="text-xs text-muted-foreground">{nvr.notes}</div>}

          <div className="pt-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-muted-foreground">Canale</span>
              <Button size="xs" onClick={() => setAddingChannel(v => !v)}>{addingChannel ? "Anulează" : "+ Canal"}</Button>
            </div>
            {addingChannel && (
              <CameraInlineForm
                siteId={siteId}
                nvr={nvr}
                onDone={() => { setAddingChannel(false); onChanged(); }}
              />
            )}
            {cameras.length === 0 && !addingChannel && (
              <div className="text-[11px] italic text-muted-foreground">Niciun canal configurat.</div>
            )}
            <ul className="space-y-1">
              {cameras.map(c => <CameraRow key={c.id} camera={c} onChanged={onChanged} />)}
            </ul>
          </div>

          <div className="pt-2 border-t border-neutral-800/70 flex gap-2 flex-wrap">
            <Button size="xs" variant="outline" onClick={testConnection} disabled={testing}>
              {testing ? "Se testează…" : "Test conexiune"}
            </Button>
            <Button size="xs" variant="outline" onClick={importChannels} disabled={importing}>
              {importing ? "Se importă…" : `Importă toate canalele (1-${nvr.channelsCount || "?"})`}
            </Button>
            <Button size="xs" variant="outline" onClick={() => setEditing(true)}>Editează NVR</Button>
            <Button size="xs" variant="destructive" onClick={remove}><Trash2 className="w-3 h-3 mr-1" />Șterge</Button>
          </div>
          {testResult && (
            <div className="mt-2 text-xs space-y-0.5 p-2 rounded bg-neutral-950/70 border border-neutral-800">
              <div className={testResult.reachable ? "text-green-400" : "text-red-400"}>
                {testResult.reachable ? "✓ NVR accesibil" : "✗ NVR inaccesibil"} ({nvr.ipAddress})
              </div>
              <div className={testResult.web.ok ? "text-green-300" : "text-red-300"}>
                Web :{testResult.web.port} — {testResult.web.ok ? `OK (${testResult.web.ms}ms)` : `eșec (${testResult.web.err || ""})`}
              </div>
              <div className={testResult.rtsp.ok ? "text-green-300" : "text-red-300"}>
                RTSP :{testResult.rtsp.port} — {testResult.rtsp.ok ? `OK (${testResult.rtsp.ms}ms)` : `eșec (${testResult.rtsp.err || ""})`}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CameraRow({ camera, onChanged }: { camera: Camera; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);

  async function remove() {
    if (!confirm(`Ștergi camera „${camera.name}"?`)) return;
    const r = await fetch(`/api/cameras/${camera.id}`, { method: "DELETE" });
    if (r.ok) onChanged();
  }
  async function toggleEnabled() {
    const r = await fetch(`/api/cameras/${camera.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !camera.enabled }),
    });
    if (r.ok) onChanged();
  }

  if (editing) {
    return <li><CameraInlineForm siteId={camera.siteId} initial={camera} onDone={() => { setEditing(false); onChanged(); }} /></li>;
  }

  return (
    <li className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-neutral-950/50 border border-neutral-800">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {camera.channel != null && <Badge className="font-mono bg-neutral-800 text-neutral-300">ch {camera.channel}</Badge>}
          <span className="font-medium text-sm truncate">{camera.name}</span>
          <Badge className={camera.enabled ? "bg-green-900/30 text-green-400" : "bg-slate-700 text-slate-300"}>{camera.enabled ? "Activ" : "Oprit"}</Badge>
          <Badge className={camera.yoloEnabled ? "bg-blue-900/30 text-blue-400" : "bg-slate-700 text-slate-300"}>YOLO {camera.yoloEnabled ? "ON" : "OFF"}</Badge>
        </div>
        <div className="text-[10px] text-muted-foreground font-mono truncate" title={camera.rtspUrl}>{camera.rtspUrl}</div>
      </div>
      <div className="flex gap-1 flex-shrink-0">
        <Button size="xs" variant="outline" onClick={toggleEnabled}>{camera.enabled ? "Oprește" : "Pornește"}</Button>
        <Button size="xs" variant="outline" onClick={() => setEditing(true)}>Editează</Button>
        <Button size="xs" variant="destructive" onClick={remove}><Trash2 className="w-3 h-3" /></Button>
      </div>
    </li>
  );
}

function NvrInlineForm({
  siteId, initial, onDone,
}: { siteId: string; initial?: Nvr; onDone: () => void }) {
  const [f, setF] = useState({
    name: initial?.name ?? "",
    brand: initial?.brand ?? "",
    model: initial?.model ?? "",
    ipAddress: initial?.ipAddress ?? "",
    webPort: initial?.webPort ?? 80,
    rtspPort: initial?.rtspPort ?? 554,
    username: initial?.username ?? "",
    password: initial?.password ?? "",
    channelsCount: initial?.channelsCount ?? 16,
    notes: initial?.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string | number) => setF(s => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const url = initial ? `/api/nvrs/${initial.id}` : "/api/nvrs";
    const method = initial ? "PATCH" : "POST";
    const r = await fetch(url, {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, siteId }),
    });
    setBusy(false);
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error || "Eroare"); return; }
    onDone();
  }

  return (
    <form onSubmit={submit} className="p-3 mb-2 bg-neutral-950/60 border border-blue-900/40 rounded-md space-y-2">
      <div className="text-xs font-medium text-blue-300 mb-1">{initial ? "Editare NVR" : "NVR nou"}</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">Nume</Label>
          <Input value={f.name} onChange={e => set("name", e.target.value)} required placeholder="ex: NVR sediu" />
        </div>
        <div>
          <Label className="text-xs">Brand</Label>
          <Select value={f.brand || "_"} onValueChange={v => set("brand", v === "_" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Alege" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_">Altul / necunoscut</SelectItem>
              <SelectItem value="Hikvision">Hikvision</SelectItem>
              <SelectItem value="Dahua">Dahua</SelectItem>
              <SelectItem value="Uniview">Uniview</SelectItem>
              <SelectItem value="Axis">Axis</SelectItem>
              <SelectItem value="Milestone">Milestone</SelectItem>
              <SelectItem value="Bosch">Bosch</SelectItem>
              <SelectItem value="Hanwha">Hanwha</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Model</Label>
          <Input value={f.model} onChange={e => set("model", e.target.value)} placeholder="ex: DS-7716NI-K4" />
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs">IP (LAN sau VPN)</Label>
          <Input value={f.ipAddress} onChange={e => set("ipAddress", e.target.value)} required placeholder="10.10.0.5" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Port web</Label>
            <Input type="number" value={f.webPort} onChange={e => set("webPort", Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs">Port RTSP</Label>
            <Input type="number" value={f.rtspPort} onChange={e => set("rtspPort", Number(e.target.value))} />
          </div>
        </div>
        <div>
          <Label className="text-xs">User</Label>
          <Input value={f.username} onChange={e => set("username", e.target.value)} placeholder="admin" autoComplete="off" />
        </div>
        <div>
          <Label className="text-xs">Parolă</Label>
          <Input type="password" value={f.password} onChange={e => set("password", e.target.value)} autoComplete="new-password" />
        </div>
        <div>
          <Label className="text-xs">Total canale</Label>
          <Input type="number" min={1} max={128} value={f.channelsCount} onChange={e => set("channelsCount", Number(e.target.value))} />
        </div>
      </div>
      <div>
        <Label className="text-xs">Notițe</Label>
        <Textarea value={f.notes} onChange={e => set("notes", e.target.value)} rows={2} />
      </div>
      {err && <div className="text-xs text-red-400">{err}</div>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy}>{busy ? "…" : (initial ? "Salvează" : "Adaugă NVR")}</Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>Anulează</Button>
      </div>
    </form>
  );
}

function CameraInlineForm({
  siteId, nvr, initial, onDone,
}: {
  siteId: string;
  nvr?: Nvr;
  initial?: Camera;
  onDone: () => void;
}) {
  // If we have NVR context, auto-build the RTSP URL based on common templates.
  const initialChannel = initial?.channel ?? (nvr ? (nvr._count?.cameras ?? 0) + 1 : null);
  function suggestRtsp(channel: number | null) {
    if (!nvr || channel == null) return initial?.rtspUrl ?? "";
    const auth = nvr.username ? `${encodeURIComponent(nvr.username)}:${encodeURIComponent(nvr.password || "")}@` : "";
    // Hikvision: /Streaming/Channels/{ch}01 ; Dahua: /cam/realmonitor?channel=N&subtype=0
    if ((nvr.brand || "").toLowerCase() === "dahua") {
      return `rtsp://${auth}${nvr.ipAddress}:${nvr.rtspPort}/cam/realmonitor?channel=${channel}&subtype=0`;
    }
    return `rtsp://${auth}${nvr.ipAddress}:${nvr.rtspPort}/Streaming/Channels/${channel}01`;
  }

  const [name, setName] = useState(initial?.name ?? "");
  const [channel, setChannel] = useState<number | null>(initialChannel);
  const [rtspUrl, setRtspUrl] = useState(initial?.rtspUrl ?? suggestRtsp(initialChannel));
  const [yoloEnabled, setYoloEnabled] = useState(initial?.yoloEnabled ?? true);
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [position, setPosition] = useState(initial?.position ?? 0);
  const [monitor, setMonitor] = useState(initial?.monitor ?? 0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function applyChannel(ch: number) {
    setChannel(ch);
    if (nvr) setRtspUrl(suggestRtsp(ch));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const url = initial ? `/api/cameras/${initial.id}` : "/api/cameras";
    const method = initial ? "PATCH" : "POST";
    const r = await fetch(url, {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId, nvrId: nvr?.id ?? initial?.nvrId ?? null,
        channel, name, rtspUrl, enabled, yoloEnabled,
        position, monitor,
      }),
    });
    setBusy(false);
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error || "Eroare"); return; }
    onDone();
  }

  return (
    <form onSubmit={submit} className="p-3 mb-2 bg-neutral-950/60 border border-blue-900/30 rounded-md space-y-2">
      <div className="text-xs font-medium text-blue-300 mb-1">
        {initial ? "Editare cameră" : nvr ? `Adaugă canal la ${nvr.name}` : "Adaugă cameră IP directă"}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
        <div className="md:col-span-2">
          <Label className="text-xs">Nume cameră</Label>
          <Input value={name} onChange={e => setName(e.target.value)} required placeholder="ex: Intrare" />
        </div>
        {nvr && (
          <div>
            <Label className="text-xs">Canal NVR</Label>
            <Input type="number" min={1} max={nvr.channelsCount || 64} value={channel ?? ""} onChange={e => applyChannel(Number(e.target.value))} />
          </div>
        )}
        <div className={nvr ? "md:col-span-3" : "md:col-span-4"}>
          <Label className="text-xs">URL RTSP</Label>
          <Input value={rtspUrl} onChange={e => setRtspUrl(e.target.value)} required placeholder="rtsp://user:pass@ip:554/..." />
        </div>
        <div>
          <Label className="text-xs">Poz. wall</Label>
          <Input type="number" min={0} value={position} onChange={e => setPosition(Number(e.target.value))} />
        </div>
        <div>
          <Label className="text-xs">Monitor</Label>
          <Input type="number" min={0} value={monitor} onChange={e => setMonitor(Number(e.target.value))} />
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        <label className="flex items-center gap-1"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> Activă</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={yoloEnabled} onChange={e => setYoloEnabled(e.target.checked)} /> YOLO</label>
      </div>
      {err && <div className="text-xs text-red-400">{err}</div>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy}>{busy ? "…" : (initial ? "Salvează" : "Adaugă")}</Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>Anulează</Button>
      </div>
    </form>
  );
}
