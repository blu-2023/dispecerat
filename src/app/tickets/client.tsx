"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wrench, AlertCircle, CheckCircle2, Clock, MessageCircle, Camera as CamIcon, Server, Radio, Network, AlertTriangle, Plus } from "lucide-react";

type Ticket = {
  id: string;
  category: string;
  priority: string;
  status: string;
  title: string;
  description: string;
  createdAt: string;
  resolvedAt?: string | null;
  closedAt?: string | null;
  createdBy: { id: string; name: string };
  assignedTo?: { id: string; name: string } | null;
  site?: { id: string; name: string; code: string } | null;
  camera?: { id: string; name: string } | null;
  _count: { comments: number };
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-red-900/40 text-red-300 border-red-700",
  ACKNOWLEDGED: "bg-amber-900/40 text-amber-300 border-amber-700",
  IN_PROGRESS: "bg-blue-900/40 text-blue-300 border-blue-700",
  RESOLVED: "bg-green-900/40 text-green-300 border-green-700",
  CLOSED: "bg-slate-800 text-slate-400 border-slate-700",
  CANCELLED: "bg-neutral-800 text-neutral-500 border-neutral-700",
};
const STATUS_LABELS: Record<string, string> = {
  OPEN: "Deschis", ACKNOWLEDGED: "Preluat", IN_PROGRESS: "În lucru",
  RESOLVED: "Rezolvat", CLOSED: "Închis", CANCELLED: "Anulat",
};
const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-slate-700 text-slate-300",
  NORMAL: "bg-blue-700 text-blue-100",
  HIGH: "bg-orange-700 text-orange-100",
  CRITICAL: "bg-red-700 text-red-100",
};
const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Scăzută", NORMAL: "Normală", HIGH: "Ridicată", CRITICAL: "Critică",
};
const CATEGORY_ICON: Record<string, React.ElementType> = {
  CAMERA_OFFLINE: CamIcon, NVR_ISSUE: Server, SEKA_ISSUE: Radio,
  NETWORK: Network, VPN: Network, SOFTWARE: AlertCircle, OTHER: Wrench,
};
const CATEGORY_LABELS: Record<string, string> = {
  CAMERA_OFFLINE: "Cameră offline", NVR_ISSUE: "NVR/DVR",
  SEKA_ISSUE: "SEKA", NETWORK: "Rețea", VPN: "VPN",
  SOFTWARE: "Software", OTHER: "Altul",
};

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return Math.floor(ms / 1000) + "s";
  if (ms < 3600000) return Math.floor(ms / 60000) + "m";
  if (ms < 86400000) return Math.floor(ms / 3600000) + "h";
  return Math.floor(ms / 86400000) + "z";
}

export default function TicketsClient({ tickets: initial }: { tickets: Ticket[] }) {
  const [filter, setFilter] = useState<string>("active");
  const [category, setCategory] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let arr = initial;
    if (filter === "active") arr = arr.filter(t => !["CLOSED", "CANCELLED"].includes(t.status));
    else if (filter === "closed") arr = arr.filter(t => t.status === "CLOSED");
    else if (filter === "mine") arr = arr; // could filter by current user later
    if (category !== "ALL") arr = arr.filter(t => t.category === category);
    if (search) {
      const s = search.toLowerCase();
      arr = arr.filter(t => t.title.toLowerCase().includes(s) || t.description.toLowerCase().includes(s));
    }
    return arr;
  }, [initial, filter, category, search]);

  // Counts per status
  const counts = useMemo(() => {
    const c = { OPEN: 0, ACKNOWLEDGED: 0, IN_PROGRESS: 0, RESOLVED: 0, CLOSED: 0 };
    for (const t of initial) c[t.status as keyof typeof c] = (c[t.status as keyof typeof c] || 0) + 1;
    return c;
  }, [initial]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Wrench className="w-7 h-7 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold">Tickete tehnice</h1>
            <p className="text-sm text-muted-foreground">Solicitări către echipa tehnică · {filtered.length} afișate</p>
          </div>
        </div>
        <Link href="/tickets/new">
          <Button><Plus className="w-4 h-4 mr-1" /> Ticket nou</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Deschise" value={counts.OPEN} color="bg-red-900/30 text-red-300" icon={AlertTriangle} />
        <StatCard label="Preluate" value={counts.ACKNOWLEDGED} color="bg-amber-900/30 text-amber-300" icon={Clock} />
        <StatCard label="În lucru" value={counts.IN_PROGRESS} color="bg-blue-900/30 text-blue-300" icon={Wrench} />
        <StatCard label="Rezolvate" value={counts.RESOLVED} color="bg-green-900/30 text-green-300" icon={CheckCircle2} />
        <StatCard label="Închise" value={counts.CLOSED} color="bg-slate-700 text-slate-300" icon={CheckCircle2} />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2 items-center">
          <div className="flex gap-1">
            <Button size="sm" variant={filter === "active" ? "default" : "outline"} onClick={() => setFilter("active")}>Active</Button>
            <Button size="sm" variant={filter === "closed" ? "default" : "outline"} onClick={() => setFilter("closed")}>Închise</Button>
            <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>Toate</Button>
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Toate categoriile</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Caută în titlu / descriere…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs h-8 text-xs" />
        </CardContent>
      </Card>

      {/* List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Niciun ticket. <Link href="/tickets/new" className="text-blue-400 hover:underline">Deschide unul nou</Link>.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => {
            const Icon = CATEGORY_ICON[t.category] || Wrench;
            return (
              <Card key={t.id} className="hover:bg-neutral-900/40 transition">
                <CardContent className="p-3">
                  <Link href={`/tickets/${t.id}`} className="block">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded bg-neutral-900/50 mt-0.5">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${STATUS_COLORS[t.status]}`}>
                            {STATUS_LABELS[t.status] || t.status}
                          </span>
                          <Badge className={PRIORITY_COLORS[t.priority]}>{PRIORITY_LABELS[t.priority] || t.priority}</Badge>
                          <Badge variant="outline">{CATEGORY_LABELS[t.category] || t.category}</Badge>
                          <span className="text-xs text-muted-foreground">#{t.id.slice(-6)}</span>
                          {t._count.comments > 0 && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MessageCircle className="w-3 h-3" /> {t._count.comments}
                            </span>
                          )}
                        </div>
                        <div className="font-semibold">{t.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{t.description}</div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span>de {t.createdBy.name}</span>
                          <span>· acum {timeAgo(t.createdAt)}</span>
                          {t.site && <span>· {t.site.code} ({t.site.name})</span>}
                          {t.assignedTo && <span>· asignat: <b className="text-blue-300">{t.assignedTo.name}</b></span>}
                          {!t.assignedTo && t.status === "OPEN" && <span className="text-orange-400">· neasignat</span>}
                        </div>
                      </div>
                    </div>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, icon: Icon }: { label: string; value: number; color: string; icon: React.ElementType }) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <div className={`p-2 rounded ${color}`}><Icon className="w-4 h-4" /></div>
        <div>
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
