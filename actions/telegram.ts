"use server";

import { requirePermission } from "@/lib/session";
import {
  createForumTopic,
  getTelegramChatInfo,
  sendTelegramMessage,
  verifyThreadId,
  TELEGRAM_TOPIC_NAMES,
  type TelegramTopic,
} from "@/lib/telegram";
import { failure, success, type ActionResult } from "@/lib/action-helpers";

const TOPIC_ORDER: Array<Exclude<TelegramTopic, "general">> = [
  "loads",
  "drivers",
  "invoices",
  "expenses",
  "maintenance",
  "users",
  "alerts",
];

const THREAD_ENV_KEY: Record<Exclude<TelegramTopic, "general">, string> = {
  loads: "TELEGRAM_THREAD_LOADS",
  drivers: "TELEGRAM_THREAD_DRIVERS",
  invoices: "TELEGRAM_THREAD_INVOICES",
  expenses: "TELEGRAM_THREAD_EXPENSES",
  maintenance: "TELEGRAM_THREAD_MAINTENANCE",
  users: "TELEGRAM_THREAD_USERS",
  alerts: "TELEGRAM_THREAD_ALERTS",
};

export type TopicSetupRow = {
  topic: Exclude<TelegramTopic, "general">;
  name: string;
  envKey: string;
  existingThreadId: string | null;
  createdThreadId: number | null;
  error?: string;
};

export type ChatDiagnostic = {
  title?: string;
  type?: string;
  isForum?: boolean;
  error?: string;
};

export async function getTelegramDiagnostic(): Promise<
  ActionResult<ChatDiagnostic>
> {
  await requirePermission("users:write");
  const info = await getTelegramChatInfo();
  if (!info.ok) return failure(info.error ?? "getChat failed");
  return success({
    title: info.title,
    type: info.type,
    isForum: info.isForum,
  });
}

export async function createTelegramTopics(): Promise<
  ActionResult<{ rows: TopicSetupRow[] }>
> {
  await requirePermission("users:write");

  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    return failure(
      "Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in env first.",
    );
  }

  const rows: TopicSetupRow[] = [];
  for (const topic of TOPIC_ORDER) {
    const envKey = THREAD_ENV_KEY[topic];
    const existing = process.env[envKey] ?? null;
    if (existing) {
      rows.push({
        topic,
        name: TELEGRAM_TOPIC_NAMES[topic],
        envKey,
        existingThreadId: existing,
        createdThreadId: null,
      });
      continue;
    }
    const res = await createForumTopic(TELEGRAM_TOPIC_NAMES[topic]);
    if ("error" in res) {
      rows.push({
        topic,
        name: TELEGRAM_TOPIC_NAMES[topic],
        envKey,
        existingThreadId: null,
        createdThreadId: null,
        error: res.error,
      });
      continue;
    }
    rows.push({
      topic,
      name: TELEGRAM_TOPIC_NAMES[topic],
      envKey,
      existingThreadId: null,
      createdThreadId: res.threadId,
    });
  }

  return success({ rows }, "Done. Copy the env vars below into .env.local.");
}

export async function testTelegramTopic(
  formData: FormData,
): Promise<ActionResult> {
  await requirePermission("users:write");
  const topic = String(formData.get("topic") ?? "") as TelegramTopic;
  if (!topic) return failure("topic missing");

  const msgId = await sendTelegramMessage({
    topic,
    text: `🔔 <b>TMS test</b>\nTopic: <code>${topic}</code>\nIf you see this, routing works.`,
  });
  if (!msgId) return failure("Send failed. Check token, chat id, thread id.");
  return success(undefined, `Sent (message id ${msgId}).`);
}

export async function testManualThread(
  formData: FormData,
): Promise<ActionResult> {
  await requirePermission("users:write");
  const threadId = Number(formData.get("threadId") ?? "");
  if (!threadId || !Number.isFinite(threadId)) return failure("Invalid thread id.");
  const err = await verifyThreadId(threadId);
  if (err) return failure(err);
  return success(undefined, `Thread ${threadId} verified — message sent.`);
}
