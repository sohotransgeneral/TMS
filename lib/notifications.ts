import "server-only";
import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@prisma/client";

export type NotifyArgs = {
  userId: string;
  type?: NotificationType;
  title: string;
  body?: string;
  link?: string;
  companyId?: string | null;
  meta?: Record<string, unknown>;
};

/** Create a single notification. Never throws — failures are logged. */
export async function notify(args: NotifyArgs): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: args.userId,
        type: args.type ?? "INFO",
        title: args.title,
        body: args.body,
        link: args.link,
        companyId: args.companyId ?? undefined,
        meta: args.meta as never,
      },
    });
  } catch (err) {
    console.error("[notify] failed:", err);
  }
}

/** Send the same notification to all users matching the role(s) inside a company. */
export async function notifyRoles(args: {
  companyId: string;
  roles: ("COMPANY_ADMIN" | "DISPATCHER" | "ACCOUNTANT" | "FLEET_MANAGER")[];
  type?: NotificationType;
  title: string;
  body?: string;
  link?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    const users = await prisma.user.findMany({
      where: { companyId: args.companyId, role: { in: args.roles }, active: true },
      select: { id: true },
    });
    if (users.length === 0) return;
    await prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        companyId: args.companyId,
        type: args.type ?? "INFO",
        title: args.title,
        body: args.body,
        link: args.link,
        meta: args.meta as never,
      })),
    });
  } catch (err) {
    console.error("[notifyRoles] failed:", err);
  }
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  INFO: "Informație",
  WARNING: "Avertisment",
  ERROR: "Eroare",
  SUCCESS: "Succes",
  DOCUMENT_EXPIRING: "Document expiră",
  LOAD_UPDATE: "Cursă actualizată",
  INVOICE_DUE: "Factură scadentă",
  MAINTENANCE: "Mentenanță",
};
