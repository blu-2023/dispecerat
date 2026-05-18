import { prisma } from "./prisma";

// Server-side helper to log an action against an incident.
// Used internally (auto-logging) and from API routes.
export async function logIncidentAction(opts: {
  incidentId: string;
  userId?: string | null;
  kind: string;
  reason?: string | null;
  payload?: unknown;
  remoteIp?: string | null;
  userAgent?: string | null;
}) {
  try {
    await prisma.incidentAction.create({
      data: {
        incidentId: opts.incidentId,
        userId: opts.userId || undefined,
        kind: opts.kind,
        reason: opts.reason || null,
        payload: opts.payload != null ? JSON.stringify(opts.payload).slice(0, 4000) : null,
        remoteIp: opts.remoteIp || null,
        userAgent: opts.userAgent ? opts.userAgent.slice(0, 200) : null,
      },
    });
  } catch (e) {
    console.error("logIncidentAction failed", e);
  }
}

// Convenience: action kinds — keep in sync with UI labels/filters.
export const ActionKind = {
  VIEW: "VIEW",                       // operator opened the incident detail page
  OPEN_STREAM: "OPEN_STREAM",         // operator opened a camera live stream
  ACK: "ACK",                         // acknowledged (saw the alert)
  STATUS_CHANGE: "STATUS_CHANGE",     // changed NEW → IN_PROGRESS → SENT → CLOSED
  ASSIGN: "ASSIGN",                   // assigned to another operator
  NOTE: "NOTE",                       // free-text note (with optional reason)
  CALL: "CALL",                       // operator marked a phone call
  EMAIL_SENT: "EMAIL_SENT",           // automatic/manual email sent
  ESCALATE: "ESCALATE",               // escalated to shift lead / police
  CLOSE: "CLOSE",                     // closed incident
  REOPEN: "REOPEN",                   // reopened a closed incident
  MUTE: "MUTE",                       // muted further alerts on this camera
  UNMUTE: "UNMUTE",
  YOLO_VERIFIED: "YOLO_VERIFIED",     // YOLO AI verification result
  SEKA_RECEIVED: "SEKA_RECEIVED",     // SEKA event ingested
  SNAPSHOT_VIEWED: "SNAPSHOT_VIEWED", // operator viewed a saved snapshot
} as const;
