import { prisma } from "@/lib/prisma";
import { getSessionOrThrow } from "@/lib/session";
import { USER_ADMIN_ROLES } from "@/lib/constants";
import UsersClient from "./client";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await getSessionOrThrow();
  const canManage = USER_ADMIN_ROLES.includes(session.user.role);

  const users = await prisma.user.findMany({
    where: { organizationId: session.user.organizationId },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <UsersClient
      currentUserId={session.user.id}
      canManage={canManage}
      users={users.map(u => ({ ...u, createdAt: u.createdAt.toISOString() }))}
    />
  );
}
