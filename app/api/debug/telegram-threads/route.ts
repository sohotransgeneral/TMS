import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/session";

export async function GET() {
  try {
    await requirePermission("settings:write");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 500 });
  }

  // Get last 100 updates to find thread ids
  const res = await fetch(
    `https://api.telegram.org/bot${token}/getUpdates?limit=100&allowed_updates=["message","channel_post"]`,
    { cache: "no-store" },
  );

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `Telegram API error: ${text}` }, { status: 500 });
  }

  const data = await res.json();

  // Extract unique chat_id + thread combos with topic name if available
  const seen = new Map<string, { chatId: number | string; threadId: number | undefined; text: string; date: number }>();
  for (const update of data.result ?? []) {
    const msg = update.message ?? update.channel_post;
    if (!msg) continue;
    const chatId = msg.chat?.id;
    const threadId = msg.message_thread_id;
    const key = `${chatId}-${threadId ?? "none"}`;
    if (!seen.has(key)) {
      seen.set(key, {
        chatId,
        threadId,
        text: msg.text?.slice(0, 60) ?? msg.forum_topic_created?.name ?? "(no text)",
        date: msg.date,
      });
    }
  }

  const threads = [...seen.values()].sort((a, b) => (a.threadId ?? 0) - (b.threadId ?? 0));

  return NextResponse.json({
    chatId: process.env.TELEGRAM_CHAT_ID,
    configuredThreads: {
      loads: process.env.TELEGRAM_THREAD_LOADS,
      drivers: process.env.TELEGRAM_THREAD_DRIVERS,
      invoices: process.env.TELEGRAM_THREAD_INVOICES,
      expenses: process.env.TELEGRAM_THREAD_EXPENSES,
      maintenance: process.env.TELEGRAM_THREAD_MAINTENANCE,
      users: process.env.TELEGRAM_THREAD_USERS,
      alerts: process.env.TELEGRAM_THREAD_ALERTS,
    },
    threadsFoundInUpdates: threads,
    raw: data.result?.slice(0, 5),
  });
}
