import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";

// Returns recent SEKA events with full join: site, client, contacts.
// Used by the live feed page (polled every 3s).
//
// Query params:
//   since=<iso>   only events newer than this timestamp (for incremental polling)
//   limit=<n>     max events to return (default 50, max 200)
//   status=NEW    optional filter
export async function GET(request: NextRequest) {
  let orgId: string;
  try { orgId = await getOrgId(); }
  catch { return NextResponse.json({ error: "Neautorizat" }, { status: 401 }); }

  const sp = request.nextUrl.searchParams;
  const since = sp.get("since");
  const limit = Math.min(Number(sp.get("limit")) || 50, 200);
  const status = sp.get("status");

  const where: Record<string, unknown> = { organizationId: orgId };
  if (since) where.createdAt = { gt: new Date(since) };
  if (status) where.status = status;

  const events = await prisma.sekaEvent.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      receiver: { select: { name: true } },
      site: {
        include: { client: { include: { contacts: true } } },
      },
    },
  });

  return NextResponse.json({
    events,
    serverTime: new Date().toISOString(),
  });
}
