"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import SettingsForm from "@/components/settings/SettingsForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { USER_ADMIN_ROLES, roleLabels } from "@/lib/constants";

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

export default function SettingsPage() {
  const { data: session } = useSession();
  const [org, setOrg] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setOrg({
          ...data,
          email: data.email || "",
          phone: data.phone || "",
          address: data.address || "",
          smtpHost: data.smtpHost || "",
          smtpPort: data.smtpPort || "",
          smtpUser: data.smtpUser || "",
          smtpPass: data.smtpPass || "",
          smtpFrom: data.smtpFrom || "",
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6">Se încarcă...</div>;

  const role = session?.user?.role;
  const isAdmin = !!role && USER_ADMIN_ROLES.includes(role);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Setări</h1>

      <AccountSection />

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Utilizatori organizație</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Adăugare, editare rol și dezactivare conturi. Rolurile disponibile:{" "}
              {Object.values(roleLabels).join(", ")}.
            </p>
            <Link href="/users">
              <Button>Deschide management utilizatori</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {org && isAdmin && <SettingsForm org={org} />}
      {org && !isAdmin && (
        <Card>
          <CardHeader><CardTitle className="text-base">Organizație</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div><b>{org.name}</b> ({org.slug})</div>
            {org.email && <div className="text-muted-foreground">{org.email}</div>}
            <p className="text-xs text-muted-foreground mt-3">
              Configurarea organizației și SMTP este vizibilă doar pentru administratori/directori.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AccountSection() {
  const { data: session } = useSession();
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => { if (session?.user?.name) setName(session.user.name); }, [session?.user?.name]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const body: Record<string, string> = {};
    if (name && name !== session?.user?.name) body.name = name;
    if (newPassword) {
      body.newPassword = newPassword;
      body.currentPassword = currentPassword;
    }
    if (Object.keys(body).length === 0) {
      setBusy(false);
      setMsg({ kind: "err", text: "Nimic de actualizat" });
      return;
    }
    const r = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!r.ok) { setMsg({ kind: "err", text: (await r.json().catch(() => ({}))).error || "Eroare" }); return; }
    setCurrentPassword(""); setNewPassword("");
    setMsg({ kind: "ok", text: "Salvat. Modificările apar după re-login dacă ai schimbat numele." });
  }

  if (!session?.user) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Contul meu</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Email</Label>
              <Input value={session.user.email || ""} disabled />
            </div>
            <div>
              <Label>Rol</Label>
              <Input value={roleLabels[session.user.role] || session.user.role} disabled />
            </div>
          </div>
          <div>
            <Label>Nume</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="pt-3 border-t border-neutral-800 space-y-3">
            <div className="text-sm font-medium">Schimbă parola (opțional)</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Parola curentă</Label>
                <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="…" autoComplete="current-password" />
              </div>
              <div>
                <Label>Parolă nouă</Label>
                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="min 6 caractere" autoComplete="new-password" />
              </div>
            </div>
          </div>
          {msg && (
            <div className={msg.kind === "ok" ? "text-green-400 text-sm" : "text-red-400 text-sm"}>{msg.text}</div>
          )}
          <Button type="submit" disabled={busy}>{busy ? "…" : "Salvează"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
