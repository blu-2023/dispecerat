"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, CheckCircle2, Clock, Wrench, AlertTriangle, Lock, MessageCircle, User, Phone, XCircle } from "lucide-react";

type Ticket = {
  id: string;
  category: string;
  priority: string;
  status: string;
  title: string;
  description: string;
  createdAt: string;
  acknowledgedAt?: string | null;
  inProgressAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  resolution?: string | null;
  createdBy: { id: string; name: string; role: string; email: string };
  assignedTo?: { id: string; name: string; role: string; email: string } | null;
  site?: { id: string; name: string; code: string; client?: { id: string; name: string; phone?: string | null } | null } | null;
  camera?: { id: string; name: string; rtspUrl: string } | null;
  nvr?: { id: string; name: string; ipAddress: string } | null;
  incident?: { id: string; description: string; status: string; site?: { name: string; code: string } | null } | null;
  comments: Array<{ id: string; body: string; statusChange?: string | null; createdAt: string; user: { id: string; name: string; role: string } }>;
};

const STATUS_FLOW: { [k: string]: { label: string; next?: string[]; icon: React.ElementType; color: string } } = {
  OPEN: { label: "Deschis", next: ["ACKNOWLEDGED", "CANCELLED"], icon: AlertTriangle, color: "text-red-300" },
  ACKNOWLEDGED: { label: "Preluat", next: ["IN_PROGRESS", "RESOLVED"], icon: Clock, color: "text-amber-300" },
  IN_PROGRESS: { label: "În lucru", next: ["RESOLVED", "OPEN"], icon: Wrench, color: "text-blue-300" },
  RESOLVED: { label: "Rezolvat", next: ["CLOSED", "IN_PROGRESS"], icon: CheckCircle2, color: "text-green-300" },
  CLOSED: { label: "Închis", next: ["IN_PROGRESS"], icon: Lock, color: "text-slate-300" },
  CANCELLED: { label: "Anulat", next: ["OPEN"], icon: XCircle, color: "text-neutral-500" },
};
const CAT_LABELS: Record<string, string> = {
  CAMERA_OFFLINE: "Cameră offline", NVR_ISSUE: "NVR/DVR",
  SEKA_ISSUE: "SEKA", NETWORK: "Rețea", VPN: "VPN",
  SOFTWARE: "Software", OTHER: "Altul",
};
const PRIO_COLORS: Record<string, string> = {
  LOW: "bg-slate-700", NORMAL: "bg-blue-700",
  HIGH: "bg-orange-700", CRITICAL: "bg-red-700",
};
const PRIO_LABELS: Record<string, string> = { LOW: "Scăzută", NORMAL: "Normală", HIGH: "Ridicată", CRITICAL: "Critică" };

function fmt(iso: string) { return new Date(iso).toLocaleString("ro-RO"); }
function dur(from: string, to?: string | null) {
  if (!to) return "";
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}min`;
  return `${Math.floor(ms / 3600000)}h${Math.floor((ms % 3600000) / 60000)}min`;
}

export default function TicketDetailClient({
  ticket: initial, technicians,
}: { ticket: Ticket; technicians: { id: string; name: string; role: string }[] }) {
  const router = useRouter();
  const [ticket, setTicket] = useState(initial);
  const [newComment, setNewComment] = useState("");
  const [resolution, setResolution] = useState(ticket.resolution || "");
  const [statusReason, setStatusReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [showResolve, setShowResolve] = useState(false);

  async function updateStatus(newStatus: string, reason?: string) {
    setBusy(true);
    const r = await fetch(`/api/tickets/${ticket.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus, statusReason: reason, resolution: newStatus === "RESOLVED" || newStatus === "CLOSED" ? resolution : undefined }),
    });
    setBusy(false);
    if (r.ok) router.refresh();
  }

  async function assign(toUserId: string) {
    setBusy(true);
    await fetch(`/api/tickets/${ticket.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedToId: toUserId === "_" ? null : toUserId }),
    });
    setBusy(false);
    router.refresh();
  }

  async function addComment() {
    if (!newComment.trim()) return;
    setBusy(true);
    const r = await fetch(`/api/tickets/${ticket.id}/comments`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newComment }),
    });
    setBusy(false);
    if (r.ok) {
      setNewComment("");
      router.refresh();
    }
  }

  const cur = STATUS_FLOW[ticket.status] || STATUS_FLOW.OPEN;
  const Icon = cur.icon;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/tickets"><Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Tickete</Button></Link>
        <div className="flex-1">
          <div className="text-xs text-muted-foreground">Ticket <code>#{ticket.id.slice(-6)}</code></div>
          <h1 className="text-xl font-bold">{ticket.title}</h1>
        </div>
        <Badge className={PRIO_COLORS[ticket.priority] + " text-white"}>{PRIO_LABELS[ticket.priority]}</Badge>
        <span className={`flex items-center gap-1.5 px-3 py-1 rounded font-semibold ${cur.color} bg-neutral-900`}>
          <Icon className="w-4 h-4" /> {cur.label}
        </span>
      </div>

      {/* Quick actions per status */}
      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2 items-center">
          <span className="text-xs text-muted-foreground mr-2">Schimbă status:</span>
          {(cur.next || []).map(s => {
            const next = STATUS_FLOW[s];
            const NextIcon = next.icon;
            const isResolve = s === "RESOLVED" || s === "CLOSED";
            return (
              <Button
                key={s} size="sm"
                variant={s === "RESOLVED" || s === "CLOSED" ? "default" : "outline"}
                disabled={busy}
                onClick={() => {
                  if (isResolve && !resolution) setShowResolve(true);
                  else updateStatus(s);
                }}
              >
                <NextIcon className="w-4 h-4 mr-1" /> {next.label}
              </Button>
            );
          })}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Atribuie:</span>
            <Select value={ticket.assignedTo?.id || "_"} onValueChange={assign}>
              <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Neasignat" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_">— neasignat —</SelectItem>
                {technicians.map(t => <SelectItem key={t.id} value={t.id}>{t.name} ({t.role})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Resolution box (when resolving/closing) */}
      {showResolve && (
        <Card className="border-green-700/40">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Soluție / cum a fost rezolvat?</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Textarea value={resolution} onChange={e => setResolution(e.target.value)} rows={3} placeholder="Ex: cablu rețea schimbat, port switch înlocuit, parolă cameră schimbată, etc." />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { updateStatus("RESOLVED"); setShowResolve(false); }} disabled={busy || !resolution.trim()}>
                Marchează rezolvat
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowResolve(false)}>Anulează</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Details grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Detalii</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="whitespace-pre-wrap">{ticket.description}</p>
            <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-800">
              <Badge variant="outline">{CAT_LABELS[ticket.category]}</Badge>
              {ticket.site && (
                <Badge variant="outline">📍 {ticket.site.code} — {ticket.site.name}</Badge>
              )}
              {ticket.camera && <Badge variant="outline">📷 {ticket.camera.name}</Badge>}
              {ticket.nvr && <Badge variant="outline">🖥 {ticket.nvr.name}</Badge>}
              {ticket.incident && (
                <Link href={`/incidents/${ticket.incident.id}`}>
                  <Badge className="bg-purple-900/40 text-purple-200 hover:bg-purple-900/60 cursor-pointer">
                    🔗 Incident #{ticket.incident.id.slice(-6)}
                  </Badge>
                </Link>
              )}
            </div>
            {ticket.resolution && (
              <div className="pt-2 border-t border-neutral-800">
                <div className="text-xs font-semibold text-green-400 mb-1">Rezoluție:</div>
                <p className="text-sm whitespace-pre-wrap">{ticket.resolution}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Istoric</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs">
            <TimePoint label="Creat" iso={ticket.createdAt} user={ticket.createdBy.name} />
            {ticket.acknowledgedAt && <TimePoint label="Preluat" iso={ticket.acknowledgedAt} from={ticket.createdAt} user={ticket.assignedTo?.name} />}
            {ticket.inProgressAt && <TimePoint label="În lucru" iso={ticket.inProgressAt} from={ticket.createdAt} user={ticket.assignedTo?.name} />}
            {ticket.resolvedAt && <TimePoint label="Rezolvat" iso={ticket.resolvedAt} from={ticket.createdAt} user={ticket.assignedTo?.name} good />}
            {ticket.closedAt && <TimePoint label="Închis" iso={ticket.closedAt} from={ticket.createdAt} good />}
            {ticket.site?.client && (
              <div className="pt-2 border-t border-neutral-800 mt-2">
                <div className="text-muted-foreground mb-0.5">Contact client:</div>
                <div className="font-medium">{ticket.site.client.name}</div>
                {ticket.site.client.phone && (
                  <a href={`tel:${ticket.site.client.phone}`} className="text-blue-300 hover:underline flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {ticket.site.client.phone}
                  </a>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Comments thread */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <MessageCircle className="w-4 h-4" /> Conversație ({ticket.comments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ticket.comments.length === 0 ? (
            <p className="text-xs text-muted-foreground">Niciun comentariu încă.</p>
          ) : (
            <ol className="space-y-2">
              {ticket.comments.map(c => (
                <li key={c.id} className={`p-2.5 rounded text-sm ${c.statusChange ? "bg-amber-950/30 border border-amber-900/40" : "bg-neutral-900/50 border border-neutral-800"}`}>
                  <div className="flex items-center gap-2 mb-1 text-xs">
                    <User className="w-3 h-3" /> <b>{c.user.name}</b>
                    <Badge variant="outline" className="text-[10px]">{c.user.role}</Badge>
                    {c.statusChange && <Badge className="bg-amber-900/40 text-amber-200 text-[10px]">{c.statusChange}</Badge>}
                    <span className="text-muted-foreground ml-auto">{fmt(c.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{c.body}</p>
                </li>
              ))}
            </ol>
          )}
          <div className="pt-2 border-t border-neutral-800 space-y-2">
            <Textarea placeholder="Scrie un comentariu / update…" rows={3} value={newComment} onChange={e => setNewComment(e.target.value)} />
            <Button size="sm" onClick={addComment} disabled={busy || !newComment.trim()}>
              <MessageCircle className="w-4 h-4 mr-1" /> Adaugă comentariu
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TimePoint({ label, iso, from, user, good }: { label: string; iso: string; from?: string; user?: string; good?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span>
        <span className={good ? "text-green-400" : "text-muted-foreground"}>{label}:</span> {fmt(iso)}
        {user && <span className="text-muted-foreground"> de <b>{user}</b></span>}
      </span>
      {from && <span className="text-muted-foreground">+{dur(from, iso)}</span>}
    </div>
  );
}
