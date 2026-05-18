import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";
import { USER_ADMIN_ROLES } from "./constants";

export async function getSessionOrThrow() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    redirect("/login");
  }
  return session;
}

export async function getOrgId(): Promise<string> {
  const session = await getSessionOrThrow();
  return session.user.organizationId;
}

export async function getSessionUser() {
  const session = await getSessionOrThrow();
  return session.user;
}

// Throws Response-like NextResponse-friendly error if user is not allowed
// to manage other users. Use inside POST/PATCH/DELETE routes.
export async function requireUserAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error("UNAUTHORIZED");
  }
  if (!USER_ADMIN_ROLES.includes(session.user.role)) {
    throw new Error("FORBIDDEN");
  }
  return session.user;
}
