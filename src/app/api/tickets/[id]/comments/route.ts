import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getSessionUser();
    const { id } = await params;
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket || ticket.organizationId !== me.organizationId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const body = await req.json();
    if (!body.body || !String(body.body).trim()) {
      return NextResponse.json({ error: "Comentariu gol" }, { status: 400 });
    }
    const comment = await prisma.ticketComment.create({
      data: {
        ticketId: id,
        userId: me.id,
        body: String(body.body).slice(0, 4000),
      },
      include: { user: { select: { id: true, name: true, role: true } } },
    });
    return NextResponse.json(comment, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Eroare" }, { status: 500 });
  }
}
