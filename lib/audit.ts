import "server-only";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export async function logAudit(args: {
  action: string;
  userId?: string | null;
  companyId?: string | null;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    const h = await headers();
    await prisma.auditLog.create({
      data: {
        action: args.action,
        userId: args.userId ?? undefined,
        companyId: args.companyId ?? undefined,
        entityType: args.entityType,
        entityId: args.entityId,
        ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
        userAgent: h.get("user-agent") ?? undefined,
        meta: args.meta as never,
      },
    });
  } catch (err) {
    // Audit logs must never block the main flow
    console.error("[audit] failed:", err);
  }
}
