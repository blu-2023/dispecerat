"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type ClientFormData = {
  id?: string;
  name: string;
  email: string;
  emailSecondary?: string | null;
  phone?: string | null;
  address?: string | null;
  notifyMode?: string;
  notes?: string | null;
};

export default function ClientForm({ initial }: { initial?: ClientFormData }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [emailSecondary, setEmailSecondary] = useState(initial?.emailSecondary ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [notifyMode, setNotifyMode] = useState(initial?.notifyMode ?? "MANUAL_ONLY");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const url = initial?.id ? `/api/clients/${initial.id}` : "/api/clients";
    const method = initial?.id ? "PUT" : "POST";
    const r = await fetch(url, {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, emailSecondary: emailSecondary || null, phone: phone || null, address: address || null, notifyMode, notes: notes || null }),
    });
    setBusy(false);
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error || "Eroare"); return; }
    const c = await r.json();
    router.push(initial?.id ? `/clients/${initial.id}` : `/clients/${c.id}`);
    router.refresh();
  }

  async function remove() {
    if (!initial?.id) return;
    if (!confirm(`Ștergi clientul „${initial.name}"? Obiectivele și incidentele asociate se șterg și ele.`)) return;
    const r = await fetch(`/api/clients/${initial.id}`, { method: "DELETE" });
    if (r.ok) { router.push("/clients"); router.refresh(); }
    else alert((await r.json().catch(() => ({}))).error || "Eroare la ștergere");
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Nume firmă</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
            <div><Label>Email principal</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
            <div><Label>Email secundar</Label><Input type="email" value={emailSecondary ?? ""} onChange={e => setEmailSecondary(e.target.value)} /></div>
            <div><Label>Telefon</Label><Input value={phone ?? ""} onChange={e => setPhone(e.target.value)} /></div>
            <div className="md:col-span-2"><Label>Adresă</Label><Input value={address ?? ""} onChange={e => setAddress(e.target.value)} /></div>
            <div>
              <Label>Mod notificare</Label>
              <Select value={notifyMode} onValueChange={setNotifyMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL_ONLY">Manual (confirmare dispecer)</SelectItem>
                  <SelectItem value="AUTO_ASSISTED">Auto-asistat (trimite cu draft)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Notițe</Label><Textarea value={notes ?? ""} onChange={e => setNotes(e.target.value)} rows={3} /></div>
          {err && <div className="text-sm text-red-400">{err}</div>}
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={busy}>{busy ? "Se salvează…" : (initial?.id ? "Salvează" : "Adaugă client")}</Button>
            {initial?.id && <Button type="button" variant="destructive" onClick={remove}>Șterge clientul</Button>}
            <Button type="button" variant="outline" onClick={() => router.back()}>Anulează</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
