"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type TemplateFormData = {
  id?: string;
  type: string;
  name: string;
  subjectTemplate: string;
  bodyTemplate: string;
  clientId?: string | null;
  active?: boolean;
};

const TYPE_OPTIONS = [
  { value: "VPN_VIDEO", label: "Sesizare video" },
  { value: "MANUAL", label: "Manual" },
  { value: "SEKA", label: "Alarmă SEKA" },
];

export default function TemplateForm({
  initial, clients,
}: { initial?: TemplateFormData; clients: { id: string; name: string }[] }) {
  const router = useRouter();
  const [type, setType] = useState(initial?.type ?? "VPN_VIDEO");
  const [name, setName] = useState(initial?.name ?? "");
  const [subjectTemplate, setSubjectTemplate] = useState(initial?.subjectTemplate ?? "");
  const [bodyTemplate, setBodyTemplate] = useState(initial?.bodyTemplate ?? "");
  const [clientId, setClientId] = useState<string>(initial?.clientId ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const url = initial?.id ? `/api/templates/${initial.id}` : "/api/templates";
    const method = initial?.id ? "PUT" : "POST";
    const r = await fetch(url, {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type, name, subjectTemplate, bodyTemplate,
        clientId: clientId || null,
        active,
      }),
    });
    setBusy(false);
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error || "Eroare"); return; }
    router.push("/templates");
    router.refresh();
  }

  async function remove() {
    if (!initial?.id) return;
    if (!confirm(`Ștergi template-ul „${initial.name}"?`)) return;
    const r = await fetch(`/api/templates/${initial.id}`, { method: "DELETE" });
    if (r.ok) { router.push("/templates"); router.refresh(); }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Tip</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Aplicabil clientului (opțional)</Label>
              <Select value={clientId || "_global"} onValueChange={v => setClientId(v === "_global" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Global (toți clienții)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_global">Global (toți clienții)</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Nume template</Label><Input value={name} onChange={e => setName(e.target.value)} required placeholder="ex: Sesizare video standard" /></div>
          <div>
            <Label>Subiect</Label>
            <Input value={subjectTemplate} onChange={e => setSubjectTemplate(e.target.value)} required
              placeholder="ex: Sesizare video – {{client}} – {{obiectiv}} – {{data}}" />
            <p className="text-xs text-muted-foreground mt-1">Variabile: <code>{"{{client}}"}</code>, <code>{"{{obiectiv}}"}</code>, <code>{"{{data}}"}</code>, <code>{"{{descriere}}"}</code>, <code>{"{{tip}}"}</code>.</p>
          </div>
          <div>
            <Label>Corp email</Label>
            <Textarea value={bodyTemplate} onChange={e => setBodyTemplate(e.target.value)} required rows={10} placeholder="Bună ziua, ..." />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> Template activ (folosit la trimitere)
          </label>
          {err && <div className="text-sm text-red-400">{err}</div>}
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={busy}>{busy ? "Se salvează…" : (initial?.id ? "Salvează" : "Adaugă template")}</Button>
            {initial?.id && <Button type="button" variant="destructive" onClick={remove}>Șterge</Button>}
            <Button type="button" variant="outline" onClick={() => router.push("/templates")}>Anulează</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
