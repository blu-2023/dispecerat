"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { incidentTypes, severityOptions } from "@/lib/constants";

interface ClientOption {
  id: string;
  name: string;
}

interface SiteOption {
  id: string;
  name: string;
  code: string;
  clientId: string;
}

export default function NewIncidentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const prefilledSiteId = searchParams.get("siteId") || "";
  const prefilledSource = searchParams.get("source") || "";

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [loading, setLoading] = useState(false);

  const [clientId, setClientId] = useState("");
  const [siteId, setSiteId] = useState(prefilledSiteId);
  const [source, setSource] = useState(prefilledSource || "VPN_VIDEO");
  const [incidentType, setIncidentType] = useState("");
  const [severity, setSeverity] = useState("MEDIUM");
  const [eventTime, setEventTime] = useState("");
  const [timeRange, setTimeRange] = useState("");
  const [description, setDescription] = useState("");
  const [measures, setMeasures] = useState("");

  // Load clients on mount
  useEffect(() => {
    fetch("/api/clients")
      .then((res) => res.json())
      .then((data) => setClients(data))
      .catch(console.error);
  }, []);

  // If prefilled siteId, resolve its clientId
  useEffect(() => {
    if (prefilledSiteId && clients.length > 0) {
      fetch(`/api/sites?clientId=`)
        .then((res) => res.json())
        .then((allSites: SiteOption[]) => {
          const target = allSites.find((s) => s.id === prefilledSiteId);
          if (target) {
            setClientId(target.clientId);
          }
        })
        .catch(console.error);
    }
  }, [prefilledSiteId, clients]);

  // Load sites when clientId changes
  useEffect(() => {
    if (clientId) {
      fetch(`/api/sites?clientId=${clientId}`)
        .then((res) => res.json())
        .then((data) => {
          setSites(data);
          // Keep prefilled siteId if it belongs to this client
          if (prefilledSiteId) {
            const match = data.find(
              (s: SiteOption) => s.id === prefilledSiteId
            );
            if (match) {
              setSiteId(prefilledSiteId);
            }
          }
        })
        .catch(console.error);
    } else {
      setSites([]);
    }
  }, [clientId, prefilledSiteId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          siteId,
          source,
          incidentType,
          severity,
          description,
          eventTime,
          timeRange: timeRange || undefined,
          measures: measures || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Eroare la crearea sesizării");
        return;
      }

      const incident = await res.json();
      router.push(`/incidents/${incident.id}`);
    } catch {
      alert("Eroare la crearea sesizării");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Sesizare nouă</h1>

      <Card>
        <CardHeader>
          <CardTitle>Completează datele sesizării</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="client">Client</Label>
              <Select value={clientId} onValueChange={(v) => setClientId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Selectează clientul" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="site">Obiectiv</Label>
              <Select
                value={siteId}
                onValueChange={(v) => setSiteId(v ?? "")}
                disabled={!clientId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selectează obiectivul" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Sursă</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="source"
                    value="VPN_VIDEO"
                    checked={source === "VPN_VIDEO"}
                    onChange={(e) => setSource(e.target.value)}
                    className="accent-blue-600"
                  />
                  <span>VPN Video</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="source"
                    value="MANUAL"
                    checked={source === "MANUAL"}
                    onChange={(e) => setSource(e.target.value)}
                    className="accent-blue-600"
                  />
                  <span>Manual</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="incidentType">Tip incident</Label>
              <Select value={incidentType} onValueChange={(v) => setIncidentType(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Selectează tipul" />
                </SelectTrigger>
                <SelectContent>
                  {incidentTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="severity">Severitate</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v ?? "MEDIUM")}>
                <SelectTrigger>
                  <SelectValue placeholder="Selectează severitatea" />
                </SelectTrigger>
                <SelectContent>
                  {severityOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="eventTime">Data și ora evenimentului</Label>
              <Input
                id="eventTime"
                type="datetime-local"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeRange">Interval orar (opțional)</Label>
              <Input
                id="timeRange"
                placeholder="ex: 14:00 - 14:30"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descriere</Label>
              <Textarea
                id="description"
                placeholder="Descrieți evenimentul..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="measures">Măsuri luate (opțional)</Label>
              <Textarea
                id="measures"
                placeholder="Descrieți măsurile luate..."
                value={measures}
                onChange={(e) => setMeasures(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Anulează
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Se salvează..." : "Creează sesizare"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
