/**
 * Minimal bootstrap seed: creates the production organization and the first
 * admin user. Run with `npm run seed` after `prisma db push` on a fresh
 * database. Idempotent — if the org/user exists, nothing is created.
 *
 * Override defaults with env vars:
 *   SEED_ORG_NAME, SEED_ORG_SLUG, SEED_ORG_EMAIL
 *   SEED_ADMIN_EMAIL, SEED_ADMIN_NAME, SEED_ADMIN_PASSWORD
 */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashSync } from "bcryptjs";
import path from "path";

const dbPath = path.resolve(process.cwd(), "dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

const ORG_NAME = process.env.SEED_ORG_NAME ?? "Interguard Group";
const ORG_SLUG = process.env.SEED_ORG_SLUG ?? "interguard";
const ORG_EMAIL = process.env.SEED_ORG_EMAIL ?? "office@interguard.ro";

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@interguard.ro";
const ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? "Administrator";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!2026";

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    update: {},
    create: {
      name: ORG_NAME,
      slug: ORG_SLUG,
      email: ORG_EMAIL,
      plan: "PRO",
      smtpFrom: `dispecerat@${ORG_SLUG}.ro`,
    },
  });

  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!existing) {
    await prisma.user.create({
      data: {
        organizationId: org.id,
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        passwordHash: hashSync(ADMIN_PASSWORD, 10),
        role: "ADMIN",
      },
    });
    console.log(`Admin created: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
    console.log("Schimbă parola din Setări la prima logare.");
  } else {
    console.log(`Admin ${ADMIN_EMAIL} already exists — skipping.`);
  }

  console.log(`Org: ${org.name} (${org.slug})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
