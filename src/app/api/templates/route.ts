import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/session";

export async function GET() {
  try {
    const orgId = await getOrgId();

    const templates = await prisma.emailTemplate.findMany({
      where: { organizationId: orgId },
      include: {
        client: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(templates);
  } catch {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const orgId = await getOrgId();
    const body = await request.json();
    const { clientId, type, name, subjectTemplate, bodyTemplate } = body;

    if (!type || !name || !subjectTemplate || !bodyTemplate) {
      return NextResponse.json(
        { error: "type, name, subjectTemplate, and bodyTemplate are required" },
        { status: 400 }
      );
    }

    const template = await prisma.emailTemplate.create({
      data: {
        organizationId: orgId,
        clientId,
        type,
        name,
        subjectTemplate,
        bodyTemplate,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
    }
    console.error("Failed to create template:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
