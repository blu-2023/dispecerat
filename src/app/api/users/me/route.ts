import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getSessionUser } from "@/lib/session";

// PATCH /api/users/me — current user updates own profile (name + password change).
// Password change requires currentPassword to be supplied.
export async function PATCH(request: NextRequest) {
  try {
    const me = await getSessionUser();
    const body = await request.json();
    const { name, currentPassword, newPassword } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined && name.trim()) data.name = name.trim();

    if (newPassword) {
      if (!currentPassword) return NextResponse.json({ error: "Parola curentă este obligatorie" }, { status: 400 });
      if (newPassword.length < 6) return NextResponse.json({ error: "Parola nouă: minim 6 caractere" }, { status: 400 });
      const user = await prisma.user.findUnique({ where: { id: me.id } });
      if (!user) return NextResponse.json({ error: "Cont inexistent" }, { status: 404 });
      const ok = bcrypt.compareSync(currentPassword, user.passwordHash);
      if (!ok) return NextResponse.json({ error: "Parola curentă greșită" }, { status: 400 });
      data.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nimic de actualizat" }, { status: 400 });
    }
    const updated = await prisma.user.update({
      where: { id: me.id },
      data,
      select: { id: true, name: true, email: true, role: true },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
}
