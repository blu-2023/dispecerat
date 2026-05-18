"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Video, Plus, Trash2, Edit3, Server } from "lucide-react";

type Camera = {
  id: string;
  name: string;
  rtspUrl: string;
  alarmType: string;
  enabled: boolean;
  yoloEnabled: boolean;
  position: number;
  monitor: number;
  channel?: number | null;
  site: { id: string; name: string; code: string };
  nvr?: { id: string; name: string } | null;
};

const ALARM_LABELS: Record<string, string> = {
  person: "Persoană",
  vehicle: "Vehicul",
  both: "Persoană + vehicul",
  motion: "Doar mișcare",
};

const BRAND_OPTIONS = [
  { value: "_", label: "Altul / URL manual" },
  { value: "hikvision", label: "Hikvision" },
  { value: "dahua", label: "Dahua" },
  { value: "uniview", label: "Uniview" },
  { value: "axis", label: "Axis" },
  { value: "hanwha", label: "Hanwha" },
];

function buildRtspUrl(brand: string, ip: string, port: number, user: string, pass: string, channel: number, stream: "main" | "sub") {
  const auth = user ? `${encodeURIComponent(user)}:${encodeURIComponent(pass || "")}@` : "";
  const host = `${ip}:${port}`;
  if (brand === "dahua") {
    return `rtsp://${auth}${host}/cam/realmonitor?channel=${channel}&subtype=${stream === "main" ? 0 : 1}`;
  }
  if (brand === "uniview") {
    return `rtsp://${auth}${host}/media/video${channel}/${stream === "main" ? "01" : "02"}`;
  }
  if (brand === "axis") {
    return `rtsp://${auth}${host}/axis-media/media.amp?camera=${channel}`;
  }
  if (brand === "hanwha") {
    return `rtsp://${auth}${host}/profile${stream === "main" ? 1 : 2}/media.smp?ch=${channel}`;
  }
  // Hikvision / fallback
  return `rtsp://${auth}${host}/Streaming/Channels/${channel}${stream === "main" ? "01" : "02"}`;
}

export default function CamerasClient({ cameras: initial }: { cameras: Camera[] }) {
  const router = useRouter();
  const [cameras, setCameras] = useState(initial);
  const [adding, setAdding] = useState(initial.length === 0);
  const [editingId, setEditingId] = useState<string | null>(null);

  function refresh() { router.refresh(); }

  async function remove(c: Camera) {
    if (!confirm(`Ștergi camera „${c.name}"?`)) return;
    const r = await fetch(`/api/cameras/${c.id}`, { method: "DELETE" });
    if (r.ok) {
      setCameras(cameras.filter(x => x.id !== c.id));
      refresh();
    }
  }
  async function toggleEnabled(c: Camera) {
    const r = await fetch(`/api/cameras/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !c.enabled }),
    });
    if (r.ok) {
      setCameras(cameras.map(x => x.id === c.id ? { ...x, enabled: !c.enabled } : x));
      refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Video className="w-6 h-6" /> Camere
          </h1>
          <p className="text-sm text-muted-foreground">
            Adaugă o cameră: nume + URL RTSP (sau IP/user/parolă) + tipul alertei (persoană, vehicul, etc.). Restul se face automat.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setAdding(v => !v)}>
            {adding ? "Anulează" : <><Plus className="w-4 h-4 mr-1" /> Adaugă cameră</>}
          </Button>
          <Link href="/video-sites">
            <Button variant="outline">Gestionare avansată (NVR-uri, obiective)</Button>
          </Link>
        </div>
      </div>

      {adding && (
        <CameraForm
          onCancel={() => setAdding(false)}
          onSaved={(cam) => {
            setCameras([cam, ...cameras]);
            setAdding(false);
            refresh();
          }}
        />
      )}

      {cameras.length === 0 && !adding ? (
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <Video className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">Nicio cameră încă.</p>
            <Button onClick={() => setAdding(true)}>
              <Plus className="w-4 h-4 mr-1" /> Adaugă prima cameră
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {cameras.map(c => (
            <Card key={c.id} className={!c.enabled ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base flex items-center gap-1.5">
                      <Video className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{c.name}</span>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      {c.nvr && <><Server className="w-3 h-3" /> {c.nvr.name} · </>}
                      {c.site.code} · {c.site.name}
                    </p>
                  </div>
                  <Badge className={c.enabled ? "bg-green-900/30 text-green-400" : "bg-slate-700 text-slate-300"}>
                    {c.enabled ? "ON" : "OFF"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">{ALARM_LABELS[c.alarmType] || c.alarmType}</Badge>
                  <Badge className={c.yoloEnabled ? "bg-blue-900/30 text-blue-400" : "bg-slate-700 text-slate-300"}>
                    YOLO {c.yoloEnabled ? "ON" : "OFF"}
                  </Badge>
                  {c.channel != null && <Badge variant="outline" className="font-mono">ch {c.channel}</Badge>}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono break-all line-clamp-2" title={c.rtspUrl}>
                  {c.rtspUrl}
                </div>
                {editingId === c.id ? (
                  <div className="pt-2 border-t border-neutral-800">
                    <InlineEdit camera={c} onSaved={(updated) => {
                      setCameras(cameras.map(x => x.id === c.id ? { ...x, ...updated } : x));
                      setEditingId(null); refresh();
                    }} onCancel={() => setEditingId(null)} />
                  </div>
                ) : (
                  <div className="flex gap-1.5 pt-1 flex-wrap">
                    <Link href={`/cameras/${c.id}/live`}>
                      <Button size="xs">▶ Live</Button>
                    </Link>
                    <Button size="xs" variant="outline" onClick={() => toggleEnabled(c)}>
                      {c.enabled ? "Oprește" : "Pornește"}
                    </Button>
                    <Button size="xs" variant="outline" onClick={() => setEditingId(c.id)}>
                      <Edit3 className="w-3 h-3 mr-1" /> Editează
                    </Button>
                    <Button size="xs" variant="destructive" onClick={() => remove(c)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CameraForm({ onSaved, onCancel }: { onSaved: (cam: Camera) => void; onCancel: () => void }) {
  const [mode, setMode] = useState<"url" | "build">("build");
  const [name, setName] = useState("");
  const [alarmType, setAlarmType] = useState("person");
  const [yoloEnabled, setYoloEnabled] = useState(true);

  // URL mode
  const [rtspUrl, setRtspUrl] = useState("");

  // Build mode
  const [brand, setBrand] = useState("hikvision");
  const [ip, setIp] = useState("");
  const [port, setPort] = useState(554);
  const [user, setUser] = useState("admin");
  const [pass, setPass] = useState("");
  const [channel, setChannel] = useState(1);
  const [stream, setStream] = useState<"main" | "sub">("main");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<null | { ok: boolean; ms: number; err?: string }>(null);
  const [testing, setTesting] = useState(false);

  const computedUrl = mode === "build" && ip
    ? buildRtspUrl(brand, ip, port, user, pass, channel, stream)
    : rtspUrl;

  async function testConnection() {
    if (!ip && mode === "build") { setTestResult({ ok: false, ms: 0, err: "Introdu IP-ul" }); return; }
    setTesting(true); setTestResult(null);
    const targetIp = mode === "build" ? ip : (() => {
      try { const u = new URL(rtspUrl); return u.hostname; } catch { return ""; }
    })();
    const targetPort = mode === "build" ? port : (() => {
      try { const u = new URL(rtspUrl); return Number(u.port) || 554; } catch { return 554; }
    })();
    if (!targetIp) { setTesting(false); setTestResult({ ok: false, ms: 0, err: "Nu pot extrage host din URL" }); return; }
    const r = await fetch("/api/probe-rtsp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host: targetIp, port: targetPort }),
    });
    setTesting(false);
    if (r.ok) setTestResult(await r.json());
    else setTestResult({ ok: false, ms: 0, err: "Eroare server" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr("Pune un nume camerei"); return; }
    const finalUrl = mode === "build" ? computedUrl : rtspUrl.trim();
    if (!finalUrl) { setErr("URL RTSP lipsește"); return; }
    setBusy(true); setErr(null);
    const r = await fetch("/api/cameras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        rtspUrl: finalUrl,
        alarmType,
        yoloEnabled,
        enabled: true,
      }),
    });
    setBusy(false);
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error || "Eroare"); return; }
    const cam = await r.json();
    onSaved({
      ...cam,
      site: cam.site || { id: "", name: "Locație principală", code: "MAIN" },
    });
  }

  return (
    <Card className="border-blue-700/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Cameră nouă</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Nume cameră *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} required placeholder="ex: Intrare principală" />
            </div>
            <div>
              <Label>Tip alertă *</Label>
              <Select value={alarmType} onValueChange={setAlarmType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="person">Persoană (oameni)</SelectItem>
                  <SelectItem value="vehicle">Vehicul (mașini, camioane, motociclete)</SelectItem>
                  <SelectItem value="both">Persoană + Vehicul</SelectItem>
                  <SelectItem value="motion">Doar mișcare (fără YOLO)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t border-neutral-800 pt-3">
            <div className="flex gap-2 mb-3">
              <Button type="button" size="sm" variant={mode === "build" ? "default" : "outline"} onClick={() => setMode("build")}>
                Construiește URL (IP + user + parolă)
              </Button>
              <Button type="button" size="sm" variant={mode === "url" ? "default" : "outline"} onClick={() => setMode("url")}>
                Am URL-ul RTSP gata
              </Button>
            </div>

            {mode === "build" ? (
              <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                <div className="md:col-span-2">
                  <Label className="text-xs">Brand</Label>
                  <Select value={brand} onValueChange={setBrand}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BRAND_OPTIONS.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-3">
                  <Label className="text-xs">IP cameră/NVR *</Label>
                  <Input value={ip} onChange={e => setIp(e.target.value)} required placeholder="192.168.1.50" />
                </div>
                <div>
                  <Label className="text-xs">Port</Label>
                  <Input type="number" value={port} onChange={e => setPort(Number(e.target.value))} />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">User</Label>
                  <Input value={user} onChange={e => setUser(e.target.value)} placeholder="admin" autoComplete="off" />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Parolă</Label>
                  <Input type="password" value={pass} onChange={e => setPass(e.target.value)} autoComplete="new-password" />
                </div>
                <div>
                  <Label className="text-xs">Canal</Label>
                  <Input type="number" min={1} value={channel} onChange={e => setChannel(Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">Stream</Label>
                  <Select value={stream} onValueChange={(v) => setStream(v as "main" | "sub")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="main">Main (HD)</SelectItem>
                      <SelectItem value="sub">Sub (low-res)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-6">
                  <Label className="text-xs">URL RTSP rezultat (previzualizare)</Label>
                  <div className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded font-mono text-xs break-all">
                    {computedUrl || <span className="text-muted-foreground">— completează IP-ul mai sus —</span>}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <Label>URL RTSP complet *</Label>
                <Input value={rtspUrl} onChange={e => setRtspUrl(e.target.value)} required placeholder="rtsp://user:parola@192.168.1.50:554/Streaming/Channels/101" />
                <p className="text-xs text-muted-foreground mt-1">
                  Format: <code>rtsp://USER:PAROLA@IP:PORT/CALE</code>. Acceptă RTSP/RTSPS.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3 items-center pt-2 border-t border-neutral-800">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={yoloEnabled} onChange={e => setYoloEnabled(e.target.checked)} />
              YOLO ON (alertă sonoră + vizuală)
            </label>
            <Button type="button" size="sm" variant="outline" onClick={testConnection} disabled={testing}>
              {testing ? "Test…" : "Test conexiune"}
            </Button>
            {testResult && (
              <span className={`text-xs ${testResult.ok ? "text-green-400" : "text-red-400"}`}>
                {testResult.ok ? `✓ Port deschis (${testResult.ms}ms)` : `✗ ${testResult.err || "inaccesibil"}`}
              </span>
            )}
          </div>

          {err && <div className="text-sm text-red-400">{err}</div>}
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>{busy ? "Se salvează…" : "Adaugă cameră"}</Button>
            <Button type="button" variant="outline" onClick={onCancel}>Anulează</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function InlineEdit({ camera, onSaved, onCancel }: {
  camera: Camera;
  onSaved: (c: Partial<Camera>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(camera.name);
  const [alarmType, setAlarmType] = useState(camera.alarmType);
  const [rtspUrl, setRtspUrl] = useState(camera.rtspUrl);
  const [yoloEnabled, setYoloEnabled] = useState(camera.yoloEnabled);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const r = await fetch(`/api/cameras/${camera.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, alarmType, rtspUrl, yoloEnabled }),
    });
    setBusy(false);
    if (r.ok) onSaved({ name, alarmType, rtspUrl, yoloEnabled });
    else alert("Eroare la salvare");
  }

  return (
    <div className="space-y-2 text-xs">
      <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nume" />
      <Input value={rtspUrl} onChange={e => setRtspUrl(e.target.value)} placeholder="URL RTSP" className="font-mono text-xs" />
      <Select value={alarmType} onValueChange={setAlarmType}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="person">Persoană</SelectItem>
          <SelectItem value="vehicle">Vehicul</SelectItem>
          <SelectItem value="both">Persoană + Vehicul</SelectItem>
          <SelectItem value="motion">Doar mișcare</SelectItem>
        </SelectContent>
      </Select>
      <label className="flex items-center gap-1.5"><input type="checkbox" checked={yoloEnabled} onChange={e => setYoloEnabled(e.target.checked)} /> YOLO</label>
      <div className="flex gap-1.5">
        <Button size="xs" onClick={save} disabled={busy}>{busy ? "…" : "Salvează"}</Button>
        <Button size="xs" variant="outline" onClick={onCancel}>Anulează</Button>
      </div>
    </div>
  );
}
