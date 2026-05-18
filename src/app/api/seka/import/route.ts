import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Bulk import endpoint for Sempral SEKA sync agent.
// Token-protected. Receives a JSON payload with arrays of clients, sites,
// contacts, and optionally historical events. Idempotent — uses upsert keyed
// on stable external IDs (Sempral primary keys) or codes.
//
// Header: x-seka-token (must match SEKA_INGEST_TOKEN)
//
// Body shape:
//   {
//     batch: "uuid",   // optional, for logging
//     clients: [{ externalId, name, email, phone?, address?, notes? }],
//     sites:   [{ externalId, externalClientId, name, code, address?, sekaAccountCode }],
//     contacts:[{ externalClientId, name, phone?, email?, role? }],
//     events:  [{ externalId, accountCode, ts, eventCode, qualifier, zone?, raw? }],
//   }

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-seka-token") || "";
  const expected = process.env.SEKA_INGEST_TOKEN || process.env.YOLO_INGEST_TOKEN || "dev-token";
  if (token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid payload" }, { status: 400 });

  // Resolve the org based on the first SekaReceiver (the agent is per-instance).
  const recv = await prisma.sekaReceiver.findFirst({ where: { active: true }, orderBy: { createdAt: "asc" } });
  if (!recv) return NextResponse.json({ error: "no SekaReceiver configured" }, { status: 412 });
  const orgId = recv.organizationId;

  const result = {
    clients: { created: 0, updated: 0 },
    sites:   { created: 0, updated: 0 },
    contacts:{ created: 0, updated: 0 },
    events:  { created: 0, skipped: 0 },
  };

  // --- Clients ---
  // External ID stored in Client.notes prefix so we can find on re-sync.
  // (Schema doesn't have an externalId field; we use a deterministic id = `sempral_${externalId}`.)
  if (Array.isArray(body.clients)) {
    for (const c of body.clients) {
      if (!c?.externalId || !c?.name) continue;
      const id = `sempral_c_${c.externalId}`;
      const existing = await prisma.client.findUnique({ where: { id } });
      const data = {
        organizationId: orgId,
        name: String(c.name).slice(0, 200),
        email: String(c.email || `${c.externalId}@sempral.local`).slice(0, 200),
        phone: c.phone ? String(c.phone).slice(0, 50) : null,
        address: c.address ? String(c.address).slice(0, 500) : null,
        notes: c.notes ? String(c.notes).slice(0, 2000) : null,
        notifyMode: "MANUAL_ONLY",
        active: true,
      };
      if (existing) {
        await prisma.client.update({ where: { id }, data });
        result.clients.updated++;
      } else {
        await prisma.client.create({ data: { id, ...data } });
        result.clients.created++;
      }
    }
  }

  // --- Sites ---
  if (Array.isArray(body.sites)) {
    for (const s of body.sites) {
      if (!s?.externalId || !s?.name || !s?.code) continue;
      const siteId = `sempral_s_${s.externalId}`;
      const clientId = s.externalClientId ? `sempral_c_${s.externalClientId}` : null;
      // Must have a valid client.
      let resolvedClientId = clientId;
      if (resolvedClientId) {
        const cli = await prisma.client.findUnique({ where: { id: resolvedClientId } });
        if (!cli) resolvedClientId = null;
      }
      if (!resolvedClientId) {
        // Fallback: any client in this org
        const fallback = await prisma.client.findFirst({ where: { organizationId: orgId } });
        if (!fallback) continue;
        resolvedClientId = fallback.id;
      }
      const data: Record<string, unknown> = {
        organizationId: orgId,
        clientId: resolvedClientId,
        name: String(s.name).slice(0, 200),
        address: s.address ? String(s.address).slice(0, 500) : null,
        sekaAccountCode: s.sekaAccountCode ? String(s.sekaAccountCode).slice(0, 40) : null,
        services: "alarma",
        active: true,
      };
      const existing = await prisma.site.findUnique({ where: { id: siteId } });
      if (existing) {
        await prisma.site.update({ where: { id: siteId }, data });
        result.sites.updated++;
      } else {
        // Ensure site code is unique globally; suffix if collision.
        let code = String(s.code).slice(0, 40);
        const codeCollision = await prisma.site.findUnique({ where: { code } });
        if (codeCollision) code = `${code}-${s.externalId}`;
        await prisma.site.create({ data: { id: siteId, code, ...data } });
        result.sites.created++;
      }
    }
  }

  // --- Contacts ---
  if (Array.isArray(body.contacts)) {
    for (const k of body.contacts) {
      if (!k?.externalClientId || !k?.name) continue;
      const clientId = `sempral_c_${k.externalClientId}`;
      const cli = await prisma.client.findUnique({ where: { id: clientId } });
      if (!cli) continue;
      // No external ID on Contact — use natural key (clientId + name + phone).
      const existing = await prisma.contact.findFirst({
        where: { clientId, name: k.name, phone: k.phone || null },
      });
      const data = {
        clientId,
        name: String(k.name).slice(0, 200),
        phone: k.phone ? String(k.phone).slice(0, 50) : null,
        email: k.email ? String(k.email).slice(0, 200) : null,
        role: k.role ? String(k.role).slice(0, 100) : null,
      };
      if (existing) {
        await prisma.contact.update({ where: { id: existing.id }, data });
        result.contacts.updated++;
      } else {
        await prisma.contact.create({ data });
        result.contacts.created++;
      }
    }
  }

  // --- Events (historical) ---
  if (Array.isArray(body.events)) {
    for (const e of body.events) {
      if (!e?.accountCode || !e?.eventCode) { result.events.skipped++; continue; }
      // Deduplicate via stable id derived from external event id.
      const id = e.externalId ? `sempral_e_${e.externalId}` : null;
      if (id) {
        const existing = await prisma.sekaEvent.findUnique({ where: { id } });
        if (existing) { result.events.skipped++; continue; }
      }
      // Map qualifier
      const qMap: Record<string, string> = { "1": "E", "3": "R", "6": "S" };
      const qualifier = qMap[String(e.qualifier)] || String(e.qualifier || "E");
      // Look up site by accountCode
      const site = await prisma.site.findFirst({
        where: { organizationId: orgId, sekaAccountCode: String(e.accountCode) },
      });
      // Look up event metadata
      const evType = "OTHER";
      const evLabel = `Cod ${e.eventCode}`;
      const evSev = "MEDIUM";
      try {
        await prisma.sekaEvent.create({
          data: {
            ...(id ? { id } : {}),
            organizationId: orgId,
            receiverId: recv.id,
            siteId: site?.id,
            accountCode: String(e.accountCode),
            eventCode: String(e.eventCode),
            eventQualifier: qualifier,
            zone: e.zone ? String(e.zone) : null,
            rawMessage: e.raw ? String(e.raw).slice(0, 500) : `${e.accountCode} ${e.eventCode}`,
            eventType: evType,
            eventLabel: evLabel,
            severity: evSev,
            status: "PROCESSED",
            processedAt: new Date(e.ts || Date.now()),
            createdAt: new Date(e.ts || Date.now()),
          },
        });
        result.events.created++;
      } catch {
        result.events.skipped++;
      }
    }
  }

  return NextResponse.json({ ok: true, result });
}
