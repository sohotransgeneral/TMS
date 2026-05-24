import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, defaultDashboardFor, type Permission } from "@/lib/permissions";
import type { UserRole } from "@prisma/client";

/**
 * Returns the current session or null. Cached per-request.
 */
export const getSession = cache(async () => {
  return auth();
});

/**
 * Returns the current user (full DB record) or null. Cached per-request.
 */
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({
    where: { id: session.user.id },
    include: { company: true },
  });
});

/**
 * Guarantees an authenticated user; otherwise redirects to /login.
 * Cached so it's cheap to call from layouts/pages/server actions.
 */
export const requireUser = cache(async () => {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session.user;
});

/**
 * Like requireUser, but also enforces an RBAC permission.
 * Throws if missing — server actions can map to a UI error.
 * Falls back to a DB lookup if the session token is missing role (old JWT).
 */
export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  // If role is missing from JWT (old session), refresh from DB
  if (!user.role) {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, companyId: true },
    });
    if (dbUser) {
      (user as unknown as Record<string, unknown>).role = dbUser.role;
      (user as unknown as Record<string, unknown>).companyId = dbUser.companyId;
    }
  }
  if (!hasPermission(user.role as UserRole, permission)) {
    // Redirect to the user's home instead of crashing with a 500
    redirect(defaultDashboardFor(user.role as UserRole) ?? "/dashboard");
  }
  return user;
}

/**
 * Returns the user's companyId, redirecting if not set.
 * Used by all multi-tenant data queries.
 */
export async function requireCompanyId(): Promise<string> {
  const user = await requireUser();
  if (!user.companyId) {
    // SUPER_ADMIN may not be attached to a company; they pick one via UI.
    if (user.role === "SUPER_ADMIN") {
      throw new Error("SUPER_ADMIN must select a company context first.");
    }
    redirect("/login");
  }
  return user.companyId;
}
