"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Radio, Wifi, WifiOff, AlertTriangle, Bell, XCircle, Phone, Mail, MapPin, ExternalLink, Clock, Pause, Play } from "lucide-react";

type Contact = { id: string; name: string; phone?: string | null; email?: string | null; role?: string | null; isPrimary: boolean };
type Client = { id: string; name: string; phone?: string | null; email: string; contacts: Contact[] };
type Site = { id: string; name: string; code: string; address?: string | null; sekaAccountCode?: string | null; client: Client };
type Receiver = { id: string; name: string; ipAddress: string; port: number; status: string; lastEventAt?: string | null };
type SekaEvent = {
  id: string;
  accountCode: string;
  eventCode: string;
  eventQualifier: string;
  eventLabel: string;
  eventType: string;
  zone: string | null;
  rawMessage: string;
  severity: string;
  status: string;
  receiver: { name: string };
  site: Site | null;
  incidentId: string | null;
  createdAt: string;
  processedAt: string | null;
};

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-700 text-white border-red-400",
  HIGH: "bg-orange-700 text-white border-orange-400",
  MEDIUM: "bg-yellow-700 text-white border-yellow-400",
  LOW: "bg-blue-700 text-white border-blue-400",
};

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-900/30 text-blue-300",
  PROCESSED: "bg-green-900/30 text-green-300",
  IGNORED: "bg-slate-700 text-slate-300",
  ERROR: "bg-red-900/30 text-red-300",
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 5000) return "acum";
  if (ms < 60000) return `acum ${Math.floor(ms / 1000)}s`;
  if (ms < 3600000) return `acum ${Math.floor(ms / 60000)}min`;
  if (ms < 86400000) return `acum ${Math.floor(ms / 3600000)}h`;
  return new Date(iso).toLocaleString("ro-RO");
}

export default function SekaLiveClient({
  initialReceivers, initialEvents, initialStats,
}: {
  initialReceivers: Receiver[];
  initialEvents: SekaEvent[];
  initialStats: { eventsToday: number; newEvents: number; errorEvents: number; onlineReceivers: number; totalReceivers: number };
}) {
  const [receivers, setReceivers] = useState(initialReceivers);
  const [events, setEvents] = useState(initialEvents);
  const [stats, setStats] = useState(initialStats);
  const [lastFetch, setLastFetch] = useState(new Date());
  const [paused, setPaused] = useState(false);
  const [tickCounter, setTickCounter] = useState(0);

  // Poll API every 3s
  useEffect(() => {
    if (paused) return;
    let cancelled = false;

    async function poll() {
      try {
        const r = await fetch(`/api/seka/live?limit=100`);
        if (!r.ok) return;
        const j = await r.json();
        if (cancelled) return;
        setEvents(j.events);
        setLastFetch(new Date());

        // Stats refresh — derive from event list (faster than a separate call)
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const eventsToday = (j.events as SekaEvent[]).filter(e => new Date(e.createdAt) >= today).length;
        const newEvents = (j.events as SekaEvent[]).filter(e => e.status === "NEW").length;
        const errorEvents = (j.events as SekaEvent[]).filter(e => e.status === "ERROR").length;
        setStats(s => ({ ...s, eventsToday, newEvents, errorEvents }));
      } catch {}
    }

    poll();
    const id = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, [paused]);

  // Refresh timestamps every second
  useEffect(() => {
    const id = setInterval(() => setTickCounter(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Group: identify TRULY new events (compared to initial render)
  const knownIds = useMemo(() => new Set(initialEvents.map(e => e.id)), []);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ = tickCounter; // force re-render every second for "acum Xs"

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Radio className={`w-7 h-7 ${stats.onlineReceivers > 0 ? "text-orange-400" : "text-slate-500"}`} />
          <div>
            <h1 className="text-2xl font-bold">SEKA — Live Feed</h1>
            <p className="text-xs text-muted-foreground">
              Auto-refresh la 3s · ultima actualizare {lastFetch.toLocaleTimeString("ro-RO")}
              {paused && <span className="ml-2 text-yellow-400">(pauză)</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPaused(p => !p)}>
            {paused ? <><Play className="w-4 h-4 mr-1" /> Reia</> : <><Pause className="w-4 h-4 mr-1" /> Pauză</>}
          </Button>
          <Link href="/seka/receivers"><Button variant="outline" size="sm">Receivers</Button></Link>
          <Link href="/seka/events"><Button variant="outline" size="sm">Istoric complet</Button></Link>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Wifi} color="green" label="Receptoare online" value={`${stats.onlineReceivers}/${stats.totalReceivers}`} />
        <StatCard icon={Bell} color="blue" label="Evenimente azi" value={stats.eventsToday} />
        <StatCard icon={AlertTriangle} color="yellow" label="Status NOU" value={stats.newEvents} />
        <StatCard icon={XCircle} color="red" label="Erori" value={stats.errorEvents} />
      </div>

      {/* Receivers status strip */}
      {receivers.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <div className="flex flex-wrap gap-3 text-xs">
              {receivers.map(r => (
                <div key={r.id} className="flex items-center gap-2 px-2 py-1 bg-neutral-900 rounded border border-neutral-800">
                  {r.status === "ONLINE" ? <Wifi className="w-3.5 h-3.5 text-green-400" /> : <WifiOff className="w-3.5 h-3.5 text-neutral-500" />}
                  <span className="font-medium">{r.name}</span>
                  <span className="text-neutral-500 font-mono">{r.ipAddress}:{r.port}</span>
                  {r.lastEventAt && <span className="text-neutral-500">· ultimul: {timeAgo(r.lastEventAt)}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live event list */}
      {events.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <Bell className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">Niciun eveniment SEKA încă. Aplicația ascultă în continuare.</p>
            <p className="text-xs text-muted-foreground">
              Configurează Sempral SEKA să forwardeze pe <code className="bg-neutral-900 px-1 py-0.5 rounded">192.168.1.108:6967</code> (ID/parolă: în setări).
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {events.map(e => {
            const isNew = !knownIds.has(e.id);
            return <EventCard key={e.id} event={e} isFresh={isNew} />;
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, color, label, value }: { icon: React.ElementType; color: string; label: string; value: string | number }) {
  const bg: Record<string, string> = {
    green: "bg-green-900/30 text-green-400", blue: "bg-blue-900/30 text-blue-400",
    yellow: "bg-yellow-900/30 text-yellow-400", red: "bg-red-900/30 text-red-400",
  };
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <div className={`p-2 rounded ${bg[color]}`}><Icon className="w-5 h-5" /></div>
        <div>
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EventCard({ event, isFresh }: { event: SekaEvent; isFresh: boolean }) {
  const sev = SEVERITY_COLORS[event.severity] || SEVERITY_COLORS.MEDIUM;
  const status = STATUS_COLORS[event.status] || STATUS_COLORS.NEW;
  const isE = event.eventQualifier === "E";

  return (
    <Card className={isFresh ? "border-yellow-500/40 ring-2 ring-yellow-500/20" : event.severity === "CRITICAL" ? "border-red-700/50" : ""}>
      <CardContent className="p-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
          {/* Time + qualifier */}
          <div className="md:col-span-2 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs text-neutral-400">
              <Clock className="w-3 h-3" />
              {timeAgo(event.createdAt)}
            </div>
            <div className="text-[10px] text-neutral-500 font-mono">
              {new Date(event.createdAt).toLocaleTimeString("ro-RO")}
            </div>
            <Badge className={isE ? "bg-red-900/30 text-red-300 w-fit" : "bg-green-900/30 text-green-300 w-fit"}>
              {isE ? "ALERTĂ" : event.eventQualifier === "R" ? "Restaurare" : "Status"}
            </Badge>
          </div>

          {/* Event details */}
          <div className="md:col-span-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded font-bold text-xs border ${sev}`}>{event.severity}</span>
              <span className="font-semibold text-lg">{event.eventLabel}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1 space-x-2">
              <span>cod <code className="font-mono">{event.eventCode}</code></span>
              {event.zone && <span>· zona <code className="font-mono">{event.zone}</code></span>}
              <span>· cont <code className="font-mono">{event.accountCode}</code></span>
            </div>
          </div>

          {/* Site + Client */}
          <div className="md:col-span-4 min-w-0">
            {event.site ? (
              <>
                <Link href={`/sites/${event.site.id}`} className="font-medium text-blue-300 hover:underline block truncate">
                  {event.site.name}
                </Link>
                <div className="text-xs text-muted-foreground space-x-2 mt-0.5">
                  <span><code className="font-mono">{event.site.code}</code></span>
                  {event.site.address && <span>· <MapPin className="inline w-3 h-3" /> {event.site.address}</span>}
                </div>
                <div className="text-xs mt-1">
                  Client: <span className="font-medium">{event.site.client.name}</span>
                </div>
              </>
            ) : (
              <div className="text-xs text-yellow-400">
                ⚠ Niciun obiectiv matchat pentru cont {event.accountCode}
              </div>
            )}
          </div>

          {/* Contacts */}
          <div className="md:col-span-2">
            {event.site?.client?.contacts && event.site.client.contacts.length > 0 ? (
              <div className="space-y-1">
                {event.site.client.contacts.slice(0, 2).map(c => (
                  <div key={c.id} className="text-xs">
                    <div className="font-medium">{c.name}{c.isPrimary && <span className="text-yellow-400 ml-1">★</span>}</div>
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-blue-300 hover:underline">
                        <Phone className="w-3 h-3" /> {c.phone}
                      </a>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-neutral-400 hover:underline truncate">
                        <Mail className="w-3 h-3" /> {c.email}
                      </a>
                    )}
                  </div>
                ))}
                {event.site.client.contacts.length > 2 && (
                  <div className="text-[10px] text-neutral-500">+{event.site.client.contacts.length - 2} alți</div>
                )}
              </div>
            ) : event.site?.client?.phone ? (
              <a href={`tel:${event.site.client.phone}`} className="flex items-center gap-1 text-blue-300 hover:underline text-xs">
                <Phone className="w-3 h-3" /> {event.site.client.phone}
              </a>
            ) : (
              <span className="text-[10px] text-neutral-500">— fără contact —</span>
            )}
          </div>
        </div>

        {/* Footer bar */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-800 text-[11px] text-neutral-500">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={status}>{event.status}</Badge>
            <span>via {event.receiver.name}</span>
            <code className="font-mono text-neutral-600">{event.rawMessage}</code>
          </div>
          {event.incidentId && (
            <Link href={`/incidents/${event.incidentId}`} className="flex items-center gap-1 text-blue-300 hover:underline">
              Sesizare creată <ExternalLink className="w-3 h-3" />
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
