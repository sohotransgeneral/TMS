import "server-only";
import { prisma } from "@/lib/prisma";
import type { NotificationType, UserRole } from "@prisma/client";
import {
  sendTelegramMessage,
  type TelegramTopic,
} from "@/lib/telegram";

export type NotifyArgs = {
  userId: string;
  type?: NotificationType;
  title: string;
  body?: string;
  link?: string;
  companyId?: string | null;
  meta?: Record<string, unknown>;
  /** Also send a personal Telegram DM to the user (if they have a chat id). */
  telegram?: boolean;
};

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Create a single in-app notification + optional personal Telegram DM. Never throws. */
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

  if (args.telegram) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: args.userId },
        select: { telegramChatId: true },
      });
      if (user?.telegramChatId) {
        const link = args.link ? `\n${process.env.APP_URL ?? ""}${args.link}` : "";
        await sendTelegramMessage({
          chatId: user.telegramChatId,
          text: `<b>${escape(args.title)}</b>${
            args.body ? "\n" + escape(args.body) : ""
          }${link}`,
        });
      }
    } catch (err) {
      console.error("[notify telegram] failed:", err);
    }
  }
}

/** Send the same in-app notification to all users with the given role(s) in a company. */
export async function notifyRoles(args: {
  companyId: string;
  roles: UserRole[];
  type?: NotificationType;
  title: string;
  body?: string;
  link?: string;
  meta?: Record<string, unknown>;
  telegram?: boolean;
}) {
  try {
    const users = await prisma.user.findMany({
      where: { companyId: args.companyId, role: { in: args.roles }, active: true },
      select: { id: true, telegramChatId: true },
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

    if (args.telegram) {
      const link = args.link ? `\n${process.env.APP_URL ?? ""}${args.link}` : "";
      const text = `<b>${escape(args.title)}</b>${
        args.body ? "\n" + escape(args.body) : ""
      }${link}`;
      await Promise.all(
        users
          .filter((u) => u.telegramChatId)
          .map((u) => sendTelegramMessage({ chatId: u.telegramChatId!, text })),
      );
    }
  } catch (err) {
    console.error("[notifyRoles] failed:", err);
  }
}

/**
 * One-shot helper for the common pattern:
 *   1. Insert in-app notifications for the relevant role group(s).
 *   2. Notify specific user ids (and DM them on Telegram).
 *   3. Post a copy to a Telegram group forum topic so admins see the full feed.
 */
export async function notifyEvent(args: {
  companyId: string;
  topic: TelegramTopic;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  /** Roles that get an in-app + personal DM notification. */
  roles?: UserRole[];
  /** Specific user ids to notify directly (e.g. assigned driver). */
  userIds?: string[];
  /** Override the auto-generated Telegram text for the group topic. */
  telegramText?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  if (args.roles?.length) {
    await notifyRoles({
      companyId: args.companyId,
      roles: args.roles,
      type: args.type,
      title: args.title,
      body: args.body,
      link: args.link,
      telegram: true,
      meta: args.meta,
    });
  }
  if (args.userIds?.length) {
    await Promise.all(
      args.userIds.map((userId) =>
        notify({
          userId,
          type: args.type,
          title: args.title,
          body: args.body,
          link: args.link,
          companyId: args.companyId,
          telegram: true,
          meta: args.meta,
        }),
      ),
    );
  }

  const link = args.link ? `\n${process.env.APP_URL ?? ""}${args.link}` : "";
  const text =
    args.telegramText ??
    `<b>${escape(args.title)}</b>${
      args.body ? "\n" + escape(args.body) : ""
    }${link}`;
  await sendTelegramMessage({ topic: args.topic, text });
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  INFO: "Information",
  WARNING: "Warning",
  ERROR: "Error",
  SUCCESS: "Success",
  DOCUMENT_EXPIRING: "Document expiring",
  LOAD_CREATED: "Load created",
  LOAD_ASSIGNED: "Load assigned",
  LOAD_ACCEPTED: "Load accepted",
  LOAD_STATUS: "Load status",
  LOAD_UPDATE: "Load updated",
  INVOICE_DUE: "Invoice due",
  INVOICE_CREATED: "Invoice created",
  INVOICE_PAID: "Invoice paid",
  MAINTENANCE: "Maintenance",
  EXPENSE_SUBMITTED: "Expense submitted",
  EXPENSE_DECISION: "Expense decision",
  USER_CREATED: "User created",
};
