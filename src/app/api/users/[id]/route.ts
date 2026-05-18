import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireUserAdmin } from "@/lib/session";
import { roleLabels } from "@/lib/constants";

const VALID_ROLES = Object.keys(roleLabels);

async function loadOwn(id: string, orgId: string) {
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u || u.organizationId !== orgId) return null;
  return u;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireUserAdmin();
    const { id } = await params;
    const u = await loadOwn(id, admin.organizationId);
    if (!u) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { passwordHash: _ph, ...safe } = u;
    return NextResponse.json(safe);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Interzis" }, { status: 403 });
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireUserAdmin();
    const { id } = await params;
    const u = await loadOwn(id, admin.organizationId);
    if (!u) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const { name, role, active, password } = body;

    if (role !== undefined && !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: "Rol invalid" }, { status: 400 });
    }
    if (password !== undefined && password.length < 6) {
      return NextResponse.json({ error: "Parola trebuie să aibă minim 6 caractere" }, { status: 400 });
    }

    // Safety: can't demote or deactivate the last admin/director of the org.
    if ((active === false || (role !== undefined && role === "DISPECERAT")) && (u.role === "ADMIN" || u.role === "DIRECTOR")) {
      const otherAdmins = await prisma.user.count({
        where: {
          organizationId: admin.organizationId,
          role: { in: ["ADMIN", "DIRECTOR"] },
          active: true,
          NOT: { id: u.id },
        },
      });
      if (otherAdmins === 0) {
        return NextResponse.json(
          { error: "Nu poți retrograda/dezactiva singurul administrator." },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(role !== undefined && { role }),
        ...(active !== undefined && { active }),
        ...(password !== undefined && { passwordHash: await bcrypt.hash(password, 10) }),
      },
      select: { id: true, name: true, email: true, role: true, active: true, updatedAt: true },
    });
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Doar admin/director pot edita utilizatori" }, { status: 403 });
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
    console.error("update user failed", e);
    return NextResponse.json({ error: "Eroare la actualizare" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireUserAdmin();
    const { id } = await params;
    const u = await loadOwn(id, admin.organizationId);
    if (!u) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (u.id === admin.id) {
      return NextResponse.json({ error: "Nu te poți șterge pe tine însuți" }, { status: 400 });
    }
    if (u.role === "ADMIN" || u.role === "DIRECTOR") {
      const otherAdmins = await prisma.user.count({
        where: {
          organizationId: admin.organizationId,
          role: { in: ["ADMIN", "DIRECTOR"] },
          active: true,
          NOT: { id: u.id },
        },
      });
      if (otherAdmins === 0) {
        return NextResponse.json({ error: "Nu poți șterge singurul administrator." }, { status: 400 });
      }
    }
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Doar admin/director pot șterge utilizatori" }, { status: 403 });
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
    console.error("delete user failed", e);
    return NextResponse.json({ error: "Eroare la ștergere" }, { status: 500 });
  }
}
