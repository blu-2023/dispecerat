import net from "net";
import { parseContactId, getEventInfo, mapToIncidentType } from "./contact-id";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const dbPath = path.resolve(process.cwd(), "dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

interface ReceiverConfig {
  id: string;
  organizationId: string;
  ipAddress: string;
  port: number;
  protocol: string;
  pollInterval: number;
}

/**
 * Poll a single SEKA receiver via TCP
 * Connects, reads any pending data, disconnects
 */
export async function pollReceiver(receiver: ReceiverConfig): Promise<string[]> {
  return new Promise((resolve) => {
    const messages: string[] = [];
    const timeout = 5000; // 5 second timeout

    const socket = new net.Socket();
    socket.setTimeout(timeout);

    socket.connect(receiver.port, receiver.ipAddress, () => {
      // Connected — some receivers send data immediately
      // Others need a poll command — we'll handle both
    });

    socket.on("data", (data) => {
      const raw = data.toString().trim();
      if (raw) {
        // Split on newlines in case multiple events come at once
        const lines = raw.split(/\r?\n/).filter((l) => l.trim());
        messages.push(...lines);
      }
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve(messages);
    });

    socket.on("error", () => {
      socket.destroy();
      resolve(messages);
    });

    socket.on("close", () => {
      resolve(messages);
    });

    // Auto-disconnect after timeout
    setTimeout(() => {
      if (!socket.destroyed) {
        socket.destroy();
      }
    }, timeout);
  });
}

/**
 * Process raw messages from a receiver
 */
export async function processMessages(
  receiverId: string,
  organizationId: string,
  messages: string[]
) {
  const results = [];

  for (const raw of messages) {
    const parsed = parseContactId(raw);
    if (!parsed) {
      console.log(`[SEKA] Mesaj neparsabil: ${raw}`);
      continue;
    }

    const eventInfo = getEventInfo(parsed.eventCode);

    // Find site by account code
    const site = await prisma.site.findFirst({
      where: {
        organizationId,
        sekaAccountCode: parsed.accountCode,
      },
      include: { client: true },
    });

    // Create SEKA event record
    const sekaEvent = await prisma.sekaEvent.create({
      data: {
        organizationId,
        receiverId,
        siteId: site?.id || null,
        accountCode: parsed.accountCode,
        eventCode: parsed.eventCode,
        eventQualifier: parsed.qualifier,
        zone: parsed.zone !== "000" ? parsed.zone : null,
        rawMessage: raw,
        eventType: eventInfo.type,
        eventLabel: eventInfo.label,
        severity: eventInfo.severity,
        status: site ? "NEW" : "ERROR", // ERROR if no site mapping
      },
    });

    // Auto-create incident for important events (not arm/disarm, test, etc.)
    if (
      site &&
      parsed.qualifier === "E" && // Only new events, not restores
      !["ARM_DISARM", "TEST", "BYPASS"].includes(eventInfo.type)
    ) {
      // Find a system user or first admin for createdBy
      const systemUser = await prisma.user.findFirst({
        where: {
          organizationId,
          role: { in: ["ADMIN", "DIRECTOR"] },
          active: true,
        },
      });

      if (systemUser) {
        const incident = await prisma.incident.create({
          data: {
            organizationId,
            clientId: site.clientId,
            siteId: site.id,
            source: "SEKA",
            incidentType: mapToIncidentType(eventInfo.type),
            severity: eventInfo.severity,
            description: `${eventInfo.label} — Zona: ${parsed.zone || "N/A"}, Cont: ${parsed.accountCode}`,
            eventTime: new Date(),
            status: "NEW",
            createdById: systemUser.id,
          },
        });

        // Link event to incident
        await prisma.sekaEvent.update({
          where: { id: sekaEvent.id },
          data: { incidentId: incident.id, status: "PROCESSED" },
        });

        results.push({ event: sekaEvent.id, incident: incident.id });
      }
    }
  }

  return results;
}

/**
 * Update receiver status in DB
 */
export async function updateReceiverStatus(
  receiverId: string,
  status: "ONLINE" | "OFFLINE" | "ERROR",
  errorMessage?: string
) {
  await prisma.sekaReceiver.update({
    where: { id: receiverId },
    data: {
      status,
      lastPollAt: new Date(),
      errorMessage: errorMessage || null,
      ...(status === "ONLINE" ? { lastEventAt: new Date() } : {}),
    },
  });
}

/**
 * Run one poll cycle for all active receivers of an organization
 */
export async function pollAllReceivers(organizationId?: string) {
  const where: { active: boolean; organizationId?: string } = { active: true };
  if (organizationId) where.organizationId = organizationId;

  const receivers = await prisma.sekaReceiver.findMany({ where });

  for (const receiver of receivers) {
    try {
      const messages = await pollReceiver(receiver);

      if (messages.length > 0) {
        await processMessages(receiver.id, receiver.organizationId, messages);
        await updateReceiverStatus(receiver.id, "ONLINE");
      } else {
        // No data but connection OK
        await updateReceiverStatus(receiver.id, "ONLINE");
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Eroare necunoscută";
      console.error(`[SEKA] Eroare polling ${receiver.name} (${receiver.ipAddress}):`, msg);
      await updateReceiverStatus(receiver.id, "ERROR", msg);
    }
  }
}
