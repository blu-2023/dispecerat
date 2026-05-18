import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getOrgId, requireUserAdmin } from "@/lib/session";
import { roleLabels } from "@/lib/constants";

const VALID_ROLES = Object.keys(roleLabels);

export async function GET() {
  try {
    const orgId = await getOrgId();
    const users = await prisma.user.findMany({
      where: { organizationId: orgId },
      select: {
        id: true, name: true, email: true, role: true, active: true,
        createdAt: true, updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(users);
  } catch {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireUserAdmin();
    const body = await request.json();
    const { name, email, password, role } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Nume, email și parolă sunt obligatorii" }, { status: 400 });
    }
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: "Rol invalid" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Parola trebuie să aibă minim 6 caractere" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Există deja un utilizator cu acest email" }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        organizationId: admin.organizationId,
        name, email, role,
        passwordHash: await bcrypt.hash(password, 10),
      },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true, updatedAt: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Doar admin/director pot adăuga utilizatori" }, { status: 403 });
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
    console.error("create user failed", e);
    return NextResponse.json({ error: "Eroare la crearea utilizatorului" }, { status: 500 });
  }
}
