import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashSync } from "bcryptjs";

export async function POST(request: Request) {
  try {
    const { orgName, name, email, password } = await request.json();

    if (!orgName || !name || !email || !password) {
      return NextResponse.json(
        { error: "Toate câmpurile sunt obligatorii" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Parola trebuie să aibă minim 6 caractere" },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Acest email este deja înregistrat" },
        { status: 409 }
      );
    }

    // Generate slug from org name
    const slug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Check if slug exists
    const existingOrg = await prisma.organization.findUnique({
      where: { slug },
    });

    if (existingOrg) {
      return NextResponse.json(
        { error: "O organizație cu un nume similar există deja" },
        { status: 409 }
      );
    }

    // Create organization + owner user in transaction
    const org = await prisma.organization.create({
      data: {
        name: orgName,
        slug,
        email,
        users: {
          create: {
            name,
            email,
            passwordHash: hashSync(password, 10),
            role: "ADMIN",
          },
        },
        emailTemplates: {
          createMany: {
            data: [
              {
                type: "VPN_VIDEO",
                name: "Sesizare video standard",
                subjectTemplate: "Sesizare video – {{client}} – {{obiectiv}} – {{data}}",
                bodyTemplate: `Bună ziua,

Vă informăm că la obiectivul {{obiectiv}} a fost observat un incident video la data de {{dataOra}}.

Tip incident: {{tipIncident}}
Interval: {{interval}}
Detalii: {{descriere}}

Cu stimă,
Dispecerat {{organizatie}}`,
              },
              {
                type: "MANUAL",
                name: "Sesizare manuală standard",
                subjectTemplate: "Informare incident – {{client}} – {{obiectiv}}",
                bodyTemplate: `Bună ziua,

Sesizare referitoare la obiectivul {{obiectiv}}, înregistrată la {{dataOra}}.

Tip incident: {{tipIncident}}
Descriere: {{descriere}}
Măsuri: {{masuri}}

Cu stimă,
Dispecerat {{organizatie}}`,
              },
            ],
          },
        },
      },
    });

    return NextResponse.json(
      { message: "Cont creat cu succes", organizationId: org.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Eroare la crearea contului" },
      { status: 500 }
    );
  }
}
