"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function NewWallPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [cols, setCols] = useState(5);
  const [rows, setRows] = useState(4);
  const [monitor, setMonitor] = useState(0);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/walls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, cols, rows, monitor, notes }),
    });
    setBusy(false);
    if (!r.ok) {
      setErr((await r.json().catch(() => ({}))).error || "Eroare");
      return;
    }
    const wall = await r.json();
    router.push(`/walls/${wall.id}/edit`);
  }

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-2xl font-bold">Perete video nou</h1>
      <Card>
        <CardContent className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Nume</Label>
              <Input value={name} onChange={e => setName(e.target.value)} required placeholder="ex: Wall principal — Sediu" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Coloane</Label>
                <Input type="number" min={1} max={10} value={cols} onChange={e => setCols(Number(e.target.value))} />
              </div>
              <div>
                <Label>Rânduri</Label>
                <Input type="number" min={1} max={10} value={rows} onChange={e => setRows(Number(e.target.value))} />
              </div>
              <div>
                <Label>Monitor</Label>
                <Input type="number" min={0} max={20} value={monitor} onChange={e => setMonitor(Number(e.target.value))} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{cols * rows} sloturi · pe monitorul #{monitor}</p>
            <div>
              <Label>Notițe</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
            </div>
            {err && <div className="text-sm text-red-400">{err}</div>}
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>{busy ? "Se creează…" : "Creează și deschide editorul"}</Button>
              <Button type="button" variant="outline" onClick={() => router.push("/walls")}>Anulează</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
