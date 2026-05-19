"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Activity, Eye, Video, Phone, Mail, MessageSquare, AlertTriangle, CheckCircle2,
  RotateCcw, UserPlus, Clock, Radio, Camera, Bell, Lock, Unlock, Wrench,
} from "lucide-react";

type Action = {
  id: string;
  kind: string;
  reason?: string | null;
  payload?: Record<string, unknown> | string | null;
  remoteIp?: string | null;
  userAgent?: string | null;
  createdAt: string;
  user?: { id: string; name: string; email: string; role: string } | null;
};
type SekaEvent = {
  id: string; accountCode: string; eventCode: string; eventLabel: string;
  severity: string; status: string; createdAt: string; rawMessage: string;
};
type CameraDetection = {
  id: string; label: string; confidence: number; createdAt: string;
  snapshotPath?: string | null;
  camera: { id: string; name: string };
};

type Replay = {
  incident: {
    id: string; status: string; severity: string; eventTime: string;
    description: string; incidentType: string;
    site?: { id: string; name: string; code: string } | null;
    client?: { id: string; name: string } | null;
    assignedTo?: { id: string; name: string } | null;
  };
  actions: Action[];
  sekaEvents: SekaEvent[];
  cameraDetections: CameraDetection[];
};

const KIND_ICONS: Record<string, React.ElementType> = {
  VIEW: Eye, OPEN_STREAM: Video, ACK: CheckCircle2, STATUS_CHANGE: Activity,
  ASSIGN: UserPlus, NOTE: MessageSquare, CALL: Phone, EMAIL_SENT: Mail,
  ESCALATE: AlertTriangle, CLOSE: Lock, REOPEN: Unlock, MUTE: Bell,
  UNMUTE: Bell, YOLO_VERIFIED: Camera, SEKA_RECEIVED: Radio,
  SNAPSHOT_VIEWED: Eye,
  TICKET_OPENED: Wrench, TICKET_RESOLVED: CheckCircle2, TICKET_CLOSED: Lock, TICKET_UPDATE: Wrench,
};
const KIND_COLORS: Record<string, string> = {
  VIEW: "text-neutral-400", OPEN_STREAM: "text-blue-300",
  ACK: "text-green-300", STATUS_CHANGE: "text-amber-300",
  ASSIGN: "text-purple-300", NOTE: "text-cyan-300",
  CALL: "text-pink-300", EMAIL_SENT: "text-orange-300",
  ESCALATE: "text-red-300", CLOSE: "text-slate-300", REOPEN: "text-yellow-300",
  YOLO_VERIFIED: "text-green-400", SEKA_RECEIVED: "text-orange-400",
  TICKET_OPENED: "text-blue-400", TICKET_RESOLVED: "text-green-400",
  TICKET_CLOSED: "text-slate-400", TICKET_UPDATE: "text-blue-300",
};
const KIND_LABELS: Record<string, string> = {
  VIEW: "Vizualizare", OPEN_STREAM: "Deschis stream cameră",
  ACK: "Confirmat", STATUS_CHANGE: "Schimbare status",
  ASSIGN: "Atribuit", NOTE: "Notiță", CALL: "Apel telefonic",
  EMAIL_SENT: "Email trimis", ESCALATE: "Escaladare",
  CLOSE: "Închis", REOPEN: "Redeschis",
  MUTE: "Mute camera", UNMUTE: "Unmute camera",
  YOLO_VERIFIED: "AI confirmat", SEKA_RECEIVED: "Alarmă SEKA primită",
  SNAPSHOT_VIEWED: "Vizualizat snapshot",
  TICKET_OPENED: "Ticket tehnic deschis", TICKET_RESOLVED: "Ticket rezolvat",
  TICKET_CLOSED: "Ticket închis", TICKET_UPDATE: "Update ticket",
};
const STATUS_OPTIONS = ["NEW", "IN_PROGRESS", "SENT", "CONFIRMED", "CLOSED", "CANCELLED"];

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("ro-RO", { hour: "2-digit", minute: "2-digit", second: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
}
function timeDelta(from: string, to: string) {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (ms < 1000) return "0s";
  if (ms < 60000) return Math.floor(ms / 1000) + "s";
  if (ms < 3600000) return Math.floor(ms / 60000) + "min";
  return Math.floor(ms / 3600000) + "h" + Math.floor((ms % 3600000) / 60000) + "min";
}

export default function IncidentTimeline({ incidentId }: { incidentId: string }) {
  const [data, setData] = useState<Replay | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [callPhone, setCallPhone] = useState("");
  const [callOutcome, setCallOutcome] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [showCall, setShowCall] = useState(false);
  const [statusReason, setStatusReason] = useState("");

  async function refresh() {
    try {
      const r = await fetch(`/api/incidents/${incidentId}/replay`);
      if (r.ok) {
        const j = await r.json();
        setData(j);
      }
    } finally {
      setLoading(false);
    }
  }

  // Auto-log VIEW on mount
  useEffect(() => {
    fetch(`/api/incidents/${incidentId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "VIEW", reason: "Operator a deschis incidentul" }),
    });
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidentId]);

  async function postAction(kind: string, reason?: string, payload?: unknown) {
    setBusy(true);
    try {
      const r = await fetch(`/api/incidents/${incidentId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, reason, payload }),
      });
      if (r.ok) refresh();
    } finally { setBusy(false); }
  }

  // Merge actions + seka events + camera detections into one timeline
  const timeline = useMemo(() => {
    if (!data) return [] as Array<{ at: string; kind: string; source: "action" | "seka" | "yolo"; data: unknown }>;
    const items: Array<{ at: string; kind: string; source: "action" | "seka" | "yolo"; data: unknown }> = [];
    for (const a of data.actions) items.push({ at: a.createdAt, kind: a.kind, source: "action", data: a });
    for (const e of data.sekaEvents) items.push({ at: e.createdAt, kind: "SEKA_RECEIVED", source: "seka", data: e });
    for (const d of data.cameraDetections) items.push({ at: d.createdAt, kind: "YOLO_VERIFIED", source: "yolo", data: d });
    items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    return items;
  }, [data]);

  if (loading) return <div className="text-sm text-muted-foreground">Se încarcă timeline-ul…</div>;
  if (!data) return <div className="text-sm text-red-400">Eroare la încărcare</div>;

  return (
    <div className="space-y-4">
      {/* Quick actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4" /> Acțiuni rapide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => postAction("ACK", "Operator a luat la cunoștință")} disabled={busy}>
              <CheckCircle2 className="w-4 h-4 mr-1" /> Acknowledge
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCall(s => !s)} disabled={busy}>
              <Phone className="w-4 h-4 mr-1" /> Marchează apel
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowNote(s => !s)} disabled={busy}>
              <MessageSquare className="w-4 h-4 mr-1" /> Notiță
            </Button>
            <Button size="sm" variant="outline" onClick={() => postAction("ESCALATE", "Escaladat către șeful de tură")} disabled={busy}>
              <AlertTriangle className="w-4 h-4 mr-1" /> Escaladează
            </Button>
            <Link href={`/tickets/new?incidentId=${incidentId}&category=SEKA_ISSUE&title=${encodeURIComponent("Incident " + incidentId.slice(-6) + " — necesită echipa tehnică")}`}>
              <Button size="sm" variant="outline" disabled={busy}>
                <Wrench className="w-4 h-4 mr-1" /> Solicită echipa tehnică
              </Button>
            </Link>
            <Button size="sm" variant="outline" onClick={() => postAction("CLOSE", "Închis după rezolvare")} disabled={busy}>
              <Lock className="w-4 h-4 mr-1" /> Închide
            </Button>
            <Select onValueChange={(v) => postAction("STATUS_CHANGE", statusReason || `Schimbat status la ${v}`, { from: data.incident.status, to: v })}>
              <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Schimbă status…" /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {showCall && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-3 rounded bg-neutral-900/40 border border-neutral-800">
              <Input placeholder="Telefon sunat" value={callPhone} onChange={e => setCallPhone(e.target.value)} />
              <Input placeholder="Rezultat (răspuns/nu, motiv)" value={callOutcome} onChange={e => setCallOutcome(e.target.value)} />
              <div className="flex gap-1">
                <Button size="sm" onClick={() => {
                  postAction("CALL", `Apel către ${callPhone}: ${callOutcome}`, { phone: callPhone, outcome: callOutcome });
                  setCallPhone(""); setCallOutcome(""); setShowCall(false);
                }} disabled={busy || !callPhone.trim()}>Salvează</Button>
                <Button size="sm" variant="outline" onClick={() => setShowCall(false)}>Anulează</Button>
              </div>
            </div>
          )}

          {showNote && (
            <div className="space-y-2 p-3 rounded bg-neutral-900/40 border border-neutral-800">
              <Textarea placeholder="Ce ai observat / făcut / vorbit cu clientul…" value={noteText} onChange={e => setNoteText(e.target.value)} rows={3} />
              <div className="flex gap-1">
                <Button size="sm" onClick={() => {
                  postAction("NOTE", noteText, { text: noteText });
                  setNoteText(""); setShowNote(false);
                }} disabled={busy || !noteText.trim()}>Adaugă</Button>
                <Button size="sm" variant="outline" onClick={() => setShowNote(false)}>Anulează</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> Timeline ({timeline.length} evenimente)</span>
            <span className="text-xs text-muted-foreground">Replay complet · auto-refresh la 5s</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">Niciun eveniment înregistrat încă.</p>
          ) : (
            <ol className="relative border-l-2 border-neutral-800 ml-3 space-y-3">
              {timeline.map((it, idx) => {
                const Icon = KIND_ICONS[it.kind] || Activity;
                const color = KIND_COLORS[it.kind] || "text-neutral-400";
                const label = KIND_LABELS[it.kind] || it.kind;
                const prev = idx > 0 ? timeline[idx - 1] : null;
                return (
                  <li key={`${it.source}-${idx}`} className="ml-5 relative">
                    <div className={`absolute -left-[31px] top-0 w-6 h-6 rounded-full bg-neutral-950 border-2 border-neutral-700 flex items-center justify-center ${color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="pb-1">
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        <span className="font-medium">{label}</span>
                        {it.source === "action" && (it.data as Action).user && (
                          <span className="text-xs text-muted-foreground">
                            de <b>{(it.data as Action).user!.name}</b>
                          </span>
                        )}
                        {it.source !== "action" && (
                          <Badge className="bg-neutral-800 text-neutral-400 text-[10px]">sistem</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {fmtTime(it.at)}
                        {prev && <span className="ml-2">(+{timeDelta(prev.at, it.at)})</span>}
                      </div>
                      {/* Reason */}
                      {it.source === "action" && (it.data as Action).reason && (
                        <p className="text-sm mt-1 italic">{(it.data as Action).reason}</p>
                      )}
                      {/* Source-specific details */}
                      {it.source === "seka" && (
                        <div className="text-xs text-muted-foreground mt-1">
                          cod <code className="font-mono">{(it.data as SekaEvent).eventCode}</code> · {(it.data as SekaEvent).eventLabel} · cont {(it.data as SekaEvent).accountCode}
                        </div>
                      )}
                      {it.source === "yolo" && (
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                          <span>{(it.data as CameraDetection).camera.name}</span>
                          <span>· {(it.data as CameraDetection).label} ({((it.data as CameraDetection).confidence * 100).toFixed(0)}%)</span>
                        </div>
                      )}
                      {it.source === "action" && (it.data as Action).payload && (
                        <details className="text-[10px] text-neutral-500 mt-1">
                          <summary className="cursor-pointer">Detalii tehnice</summary>
                          <pre className="bg-black/40 p-2 rounded mt-1 overflow-x-auto">
                            {JSON.stringify((it.data as Action).payload, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
