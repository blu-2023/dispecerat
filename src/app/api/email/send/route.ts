import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { getOrgId } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const orgId = await getOrgId();
    const { incidentId, toEmail, subject, body } = await request.json();

    if (!incidentId || !toEmail || !subject || !body) {
      return NextResponse.json(
        { error: "incidentId, toEmail, subject, and body are required" },
        { status: 400 }
      );
    }

    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
    });

    if (!incident || incident.organizationId !== orgId) {
      return NextResponse.json(
        { error: "Incident not found" },
        { status: 404 }
      );
    }

    const emailRecord = await prisma.incidentEmail.create({
      data: {
        incidentId,
        toEmail,
        subject,
        body,
        sentStatus: "PENDING",
      },
    });

    const result = await sendEmail({ to: toEmail, subject, body });

    if (result.success) {
      await prisma.incidentEmail.update({
        where: { id: emailRecord.id },
        data: { sentStatus: "SENT", sentAt: new Date() },
      });

      await prisma.incident.update({
        where: { id: incidentId },
        data: { status: "SENT" },
      });

      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        emailId: emailRecord.id,
      });
    } else {
      await prisma.incidentEmail.update({
        where: { id: emailRecord.id },
        data: { sentStatus: "FAILED", errorMessage: result.error },
      });

      return NextResponse.json(
        { error: "Failed to send email", details: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
    }
    console.error("Failed to send email:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
