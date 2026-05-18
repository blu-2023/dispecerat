import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const orgId = await getOrgId();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const receivers = await prisma.sekaReceiver.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(receivers);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const orgId = await getOrgId();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, ipAddress, port, protocol, pollInterval } = body;

    const receiver = await prisma.sekaReceiver.create({
      data: {
        name,
        ipAddress,
        port,
        protocol,
        pollInterval,
        organizationId: orgId,
      },
    });

    return NextResponse.json(receiver, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
