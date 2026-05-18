import { prisma } from "./prisma";

// Ensures a default Client + Site exist for the org so the user can add
// cameras without first navigating client/site creation flows.
//
// We create:
//   Client "Locație implicită" (email = org email)
//   Site "Locație principală" with code "MAIN-{orgSlug}"
//
// Idempotent — returns the existing pair on second call.
export async function ensureDefaultSite(orgId: string): Promise<{ clientId: string; siteId: string }> {
  // Reuse any existing site as the default fallback.
  const anySite = await prisma.site.findFirst({
    where: { organizationId: orgId },
    orderBy: { createdAt: "asc" },
    select: { id: true, clientId: true },
  });
  if (anySite) return { clientId: anySite.clientId, siteId: anySite.id };

  // Reuse client if any.
  let client = await prisma.client.findFirst({
    where: { organizationId: orgId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!client) {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    client = await prisma.client.create({
      data: {
        organizationId: orgId,
        name: "Locație implicită",
        email: org?.email || `dispecerat@${org?.slug || "org"}.local`,
        notifyMode: "MANUAL_ONLY",
      },
      select: { id: true },
    });
  }

  // Find a unique code (Site.code is globally unique).
  const baseCode = "MAIN";
  let code = baseCode;
  for (let i = 0; ; i++) {
    const candidate = i === 0 ? baseCode : `${baseCode}-${i}`;
    const exists = await prisma.site.findUnique({ where: { code: candidate }, select: { id: true } });
    if (!exists) { code = candidate; break; }
    if (i > 1000) throw new Error("Cannot generate unique site code");
  }

  const site = await prisma.site.create({
    data: {
      organizationId: orgId,
      clientId: client.id,
      name: "Locație principală",
      code,
    },
    select: { id: true },
  });

  return { clientId: client.id, siteId: site.id };
}
