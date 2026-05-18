import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    const orgId = await getOrgId();
    const search = request.nextUrl.searchParams.get("search");

    const clients = await prisma.client.findMany({
      where: {
        organizationId: orgId,
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { email: { contains: search } },
                { phone: { contains: search } },
              ],
            }
          : {}),
      },
      include: {
        _count: {
          select: {
            contacts: true,
            sites: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(clients);
  } catch {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const orgId = await getOrgId();
    const body = await request.json();
    const { name, email, emailSecondary, phone, address, notifyMode, notes } =
      body;

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    const client = await prisma.client.create({
      data: {
        organizationId: orgId,
        name,
        email,
        emailSecondary,
        phone,
        address,
        notifyMode,
        notes,
      },
    });

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
    }
    console.error("Failed to create client:", error);
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 }
    );
  }
}
