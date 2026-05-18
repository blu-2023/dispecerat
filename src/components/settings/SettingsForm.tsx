"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface OrgData {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string;
  address: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  plan: string;
}

export default function SettingsForm({ org }: { org: OrgData }) {
  const [form, setForm] = useState(org);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setMessage("Setările au fost salvate");
      } else {
        const data = await res.json();
        setMessage(data.error || "Eroare la salvare");
      }
    } catch {
      setMessage("Eroare la salvare");
    } finally {
      setSaving(false);
    }
  }

  const planColors: Record<string, string> = {
    FREE: "bg-slate-700 text-slate-300",
    PRO: "bg-blue-900/50 text-blue-400",
    ENTERPRISE: "bg-purple-900/50 text-purple-400",
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Informații organizație</CardTitle>
            <Badge className={planColors[form.plan] || planColors.FREE}>
              Plan: {form.plan}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Numele firmei</Label>
              <Input
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Slug (URL)</Label>
              <Input value={form.slug} disabled className="opacity-50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Telefon</Label>
              <Input
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Adresă</Label>
            <Input
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configurare SMTP (email)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>SMTP Host</Label>
              <Input
                value={form.smtpHost}
                onChange={(e) => update("smtpHost", e.target.value)}
                placeholder="smtp.gmail.com"
              />
            </div>
            <div className="space-y-2">
              <Label>SMTP Port</Label>
              <Input
                value={form.smtpPort}
                onChange={(e) => update("smtpPort", e.target.value)}
                placeholder="587"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>SMTP User</Label>
              <Input
                value={form.smtpUser}
                onChange={(e) => update("smtpUser", e.target.value)}
                placeholder="user@gmail.com"
              />
            </div>
            <div className="space-y-2">
              <Label>SMTP Parolă</Label>
              <Input
                type="password"
                value={form.smtpPass}
                onChange={(e) => update("smtpPass", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email expeditor (From)</Label>
            <Input
              value={form.smtpFrom}
              onChange={(e) => update("smtpFrom", e.target.value)}
              placeholder="dispecerat@firma.ro"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Se salvează..." : "Salvează setările"}
        </Button>
        {message && (
          <span className={`text-sm ${message.includes("Eroare") ? "text-red-400" : "text-green-400"}`}>
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
