import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";

export async function GET() {
  try {
    const orgId = await getOrgId();
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        phone: true,
        address: true,
        plan: true,
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        smtpPass: true,
        smtpFrom: true,
      },
    });
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(org);
  } catch {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
}

export async function PUT(request: Request) {
  try {
    const orgId = await getOrgId();
    const { name, email, phone, address, smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom } =
      await request.json();

    const org = await prisma.organization.update({
      where: { id: orgId },
      data: {
        name: name || undefined,
        email: email || null,
        phone: phone || null,
        address: address || null,
        smtpHost: smtpHost || null,
        smtpPort: smtpPort || null,
        smtpUser: smtpUser || null,
        smtpPass: smtpPass || null,
        smtpFrom: smtpFrom || null,
      },
    });

    return NextResponse.json(org);
  } catch {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
}
