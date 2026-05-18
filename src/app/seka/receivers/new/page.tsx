"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Radio } from "lucide-react";

export default function NewReceiverPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [port, setPort] = useState(12000);
  const [protocol, setProtocol] = useState("CONTACT_ID");
  const [pollInterval, setPollInterval] = useState(5);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/seka/receivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ipAddress, port, protocol, pollInterval }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Eroare la salvare");
      }

      router.push("/seka");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Eroare la salvare";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Radio className="w-6 h-6 text-orange-400" />
        <h1 className="text-2xl font-bold">Adaug&#259; receptor SEKA</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configura&#539;ie receptor</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nume</Label>
              <Input
                id="name"
                placeholder="ex: SEKA GPRS #1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ipAddress">Adres&#259; IP</Label>
                <Input
                  id="ipAddress"
                  placeholder="ex: 192.168.1.100"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  type="number"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="protocol">Protocol</Label>
                <Select value={protocol} onValueChange={(v) => setProtocol(v ?? "CONTACT_ID")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteaz&#259; protocolul" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONTACT_ID">Contact ID</SelectItem>
                    <SelectItem value="SIA">SIA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pollInterval">
                  Interval polling (secunde)
                </Label>
                <Input
                  id="pollInterval"
                  type="number"
                  min={1}
                  value={pollInterval}
                  onChange={(e) => setPollInterval(Number(e.target.value))}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-900/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Se salveaz&#259;..." : "Salveaz&#259;"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/seka")}
              >
                Anuleaz&#259;
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
