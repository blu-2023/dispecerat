"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { roleLabels, roleOptions } from "@/lib/constants";

type User = { id: string; name: string; email: string; role: string; active: boolean; createdAt: string };

export default function UsersClient({
  users: initial, currentUserId, canManage,
}: { users: User[]; currentUserId: string; canManage: boolean }) {
  const router = useRouter();
  const [users, setUsers] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  function refresh() { router.refresh(); }

  async function toggleActive(u: User) {
    const verb = u.active ? "dezactivezi" : "reactivezi";
    if (!confirm(`Sigur ${verb} contul „${u.name}"?`)) return;
    const r = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !u.active }),
    });
    if (!r.ok) { alert((await r.json().catch(() => ({}))).error || "Eroare"); return; }
    setUsers(users.map(x => x.id === u.id ? { ...x, active: !u.active } : x));
    refresh();
  }

  async function remove(u: User) {
    if (!confirm(`Ștergi DEFINITIV contul „${u.name}"?`)) return;
    const r = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    if (!r.ok) { alert((await r.json().catch(() => ({}))).error || "Eroare"); return; }
    setUsers(users.filter(x => x.id !== u.id));
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Utilizatori</h1>
        {canManage && (
          <Button onClick={() => setAdding(v => !v)}>{adding ? "Anulează" : "+ Adaugă utilizator"}</Button>
        )}
      </div>

      {adding && (
        <AddUserForm
          onCancel={() => setAdding(false)}
          onCreated={(u) => { setUsers([u, ...users]); setAdding(false); refresh(); }}
        />
      )}

      <Card>
        <CardHeader><CardTitle>Lista utilizatorilor ({users.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nume</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="text-right">Acțiuni</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.name}
                    {u.id === currentUserId && <Badge className="ml-2 bg-blue-900/30 text-blue-400">tu</Badge>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    {editingId === u.id ? (
                      <RoleEditor user={u} onSaved={(role) => {
                        setUsers(users.map(x => x.id === u.id ? { ...x, role } : x));
                        setEditingId(null); refresh();
                      }} onCancel={() => setEditingId(null)} />
                    ) : (
                      <Badge variant="outline">{roleLabels[u.role] || u.role}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={u.active ? "bg-green-900/30 text-green-400" : "bg-slate-700 text-slate-300"}>
                      {u.active ? "Activ" : "Inactiv"}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="flex gap-1.5 justify-end">
                        <Button size="xs" variant="outline" onClick={() => setEditingId(editingId === u.id ? null : u.id)}>
                          {editingId === u.id ? "Anulează" : "Rol"}
                        </Button>
                        <Button size="xs" variant="outline" onClick={() => setResettingId(resettingId === u.id ? null : u.id)}>
                          Parolă
                        </Button>
                        {u.id !== currentUserId && (
                          <>
                            <Button size="xs" variant="outline" onClick={() => toggleActive(u)}>
                              {u.active ? "Dezactivează" : "Reactivează"}
                            </Button>
                            <Button size="xs" variant="destructive" onClick={() => remove(u)}>Șterge</Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {resettingId && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <PasswordReset userId={resettingId} onDone={() => { setResettingId(null); refresh(); }} />
                  </TableCell>
                </TableRow>
              )}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canManage ? 5 : 4} className="text-center text-muted-foreground">
                    Niciun utilizator.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function AddUserForm({ onCreated, onCancel }: { onCreated: (u: User) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("DISPECERAT");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const r = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });
    setBusy(false);
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error || "Eroare"); return; }
    const u = await r.json();
    onCreated(u);
  }

  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div><Label>Nume</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
          <div>
            <Label>Parolă inițială</Label>
            <Input type="text" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="min 6 caractere" />
          </div>
          <div>
            <Label>Rol</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {roleOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>{busy ? "…" : "Adaugă"}</Button>
            <Button type="button" variant="outline" onClick={onCancel}>Anulează</Button>
          </div>
          {err && <div className="md:col-span-5 text-sm text-red-400">{err}</div>}
        </form>
      </CardContent>
    </Card>
  );
}

function RoleEditor({ user, onSaved, onCancel }: { user: User; onSaved: (role: string) => void; onCancel: () => void }) {
  const [role, setRole] = useState(user.role);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const r = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setBusy(false);
    if (!r.ok) { alert((await r.json().catch(() => ({}))).error || "Eroare"); return; }
    onSaved(role);
  }

  return (
    <div className="flex gap-1.5 items-center">
      <Select value={role} onValueChange={setRole}>
        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
        <SelectContent>
          {roleOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button size="xs" onClick={save} disabled={busy || role === user.role}>{busy ? "…" : "Salvează"}</Button>
      <Button size="xs" variant="outline" onClick={onCancel}>X</Button>
    </div>
  );
}

function PasswordReset({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const r = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error || "Eroare"); return; }
    alert("Parolă resetată. Comunic-o utilizatorului — va trebui s-o schimbe.");
    onDone();
  }

  return (
    <form onSubmit={submit} className="flex gap-2 items-end p-2 bg-neutral-900/50 rounded">
      <div className="flex-1 max-w-md">
        <Label className="text-xs">Parolă nouă</Label>
        <Input type="text" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="min 6 caractere" />
      </div>
      <Button type="submit" size="sm" disabled={busy}>{busy ? "…" : "Resetează parola"}</Button>
      <Button type="button" size="sm" variant="outline" onClick={onDone}>Anulează</Button>
      {err && <div className="text-sm text-red-400">{err}</div>}
    </form>
  );
}
