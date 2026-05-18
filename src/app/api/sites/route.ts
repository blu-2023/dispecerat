import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    const orgId = await getOrgId();
    const search = request.nextUrl.searchParams.get("search");
    const vpn = request.nextUrl.searchParams.get("vpn");
    const clientId = request.nextUrl.searchParams.get("clientId");

    const where: Record<string, unknown> = { organizationId: orgId };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { address: { contains: search } },
      ];
    }

    if (vpn === "true") {
      where.hasVpnVideo = true;
    }

    if (clientId) {
      where.clientId = clientId;
    }

    const sites = await prisma.site.findMany({
      where,
      include: {
        client: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(sites);
  } catch {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const orgId = await getOrgId();
    const body = await request.json();
    const {
      clientId,
      name,
      code,
      address,
      hasVpnVideo,
      vpnLink,
      vpnUsername,
      vpnNotes,
      monitoringSchedule,
      services,
      notes,
    } = body;

    if (!clientId || !name || !code) {
      return NextResponse.json(
        { error: "clientId, name, and code are required" },
        { status: 400 }
      );
    }

    const site = await prisma.site.create({
      data: {
        organizationId: orgId,
        clientId,
        name,
        code,
        address,
        hasVpnVideo,
        vpnLink,
        vpnUsername,
        vpnNotes,
        monitoringSchedule,
        services,
        notes,
      },
    });

    return NextResponse.json(site, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
    }
    console.error("Failed to create site:", error);
    return NextResponse.json(
      { error: "Failed to create site" },
      { status: 500 }
    );
  }
}
