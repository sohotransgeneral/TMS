import "server-only";

/**
 * Telegram Bot integration.
 *
 * Required env vars:
 *   TELEGRAM_BOT_TOKEN       - bot token from @BotFather
 *   TELEGRAM_CHAT_ID         - default group/supergroup chat id (can be negative for groups)
 *
 * Optional per-topic thread IDs (Telegram supergroup forum topics).
 * Create a forum-style supergroup, then create topics and set these env vars
 * to each topic's `message_thread_id`. Easiest way to find a topic id:
 *   1) Send a test message in the topic.
 *   2) Visit https://api.telegram.org/bot<TOKEN>/getUpdates
 *   3) Look at `message.message_thread_id`.
 *
 * If a thread id is not set, the message will go to the General topic.
 *
 *   TELEGRAM_THREAD_LOADS
 *   TELEGRAM_THREAD_DRIVERS
 *   TELEGRAM_THREAD_INVOICES
 *   TELEGRAM_THREAD_EXPENSES
 *   TELEGRAM_THREAD_MAINTENANCE
 *   TELEGRAM_THREAD_USERS
 *   TELEGRAM_THREAD_ALERTS
 */

export type TelegramTopic =
  | "loads"
  | "drivers"
  | "invoices"
  | "expenses"
  | "maintenance"
  | "users"
  | "alerts"
  | "general";

const THREAD_ENV: Record<Exclude<TelegramTopic, "general">, string> = {
  loads: "TELEGRAM_THREAD_LOADS",
  drivers: "TELEGRAM_THREAD_DRIVERS",
  invoices: "TELEGRAM_THREAD_INVOICES",
  expenses: "TELEGRAM_THREAD_EXPENSES",
  maintenance: "TELEGRAM_THREAD_MAINTENANCE",
  users: "TELEGRAM_THREAD_USERS",
  alerts: "TELEGRAM_THREAD_ALERTS",
};

function token(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN ?? null;
}

function defaultChat(): string | null {
  return process.env.TELEGRAM_CHAT_ID ?? null;
}

function threadIdFor(topic: TelegramTopic): number | undefined {
  if (topic === "general") return undefined;
  const raw = process.env[THREAD_ENV[topic]];
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export type TelegramSendOptions = {
  chatId?: string | number | null;
  topic?: TelegramTopic;
  text: string;
  /** When true (default), interprets the text as already-HTML; otherwise escapes it. */
  isHtml?: boolean;
  /** Override the auto-derived message_thread_id. */
  threadId?: number;
  /** Disable link previews. */
  disableLinkPreview?: boolean;
};

/**
 * Send a Telegram message. Never throws; failures are logged.
 * Returns the message id on success.
 */
export async function sendTelegramMessage(
  opts: TelegramSendOptions,
): Promise<number | null> {
  const t = token();
  if (!t) return null;

  const chatId = opts.chatId ?? defaultChat();
  if (!chatId) return null;

  const isHtml = opts.isHtml ?? true;
  const text = isHtml ? opts.text : escapeHtml(opts.text);

  const threadId =
    opts.threadId ?? (opts.topic ? threadIdFor(opts.topic) : undefined);

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: opts.disableLinkPreview ?? true,
  };
  if (threadId) body.message_thread_id = threadId;

  try {
    const res = await fetch(`https://api.telegram.org/bot${t}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[telegram] sendMessage failed:", res.status, errText);
      return null;
    }
    const data = (await res.json()) as {
      ok: boolean;
      result?: { message_id: number };
    };
    return data.result?.message_id ?? null;
  } catch (err) {
    console.error("[telegram] sendMessage error:", err);
    return null;
  }
}

/**
 * Create a new forum topic in the configured supergroup.
 * Bot must be an administrator with "Manage Topics" permission.
 *
 * Returns the new topic's `message_thread_id` or an error string.
 */
export async function createForumTopic(
  name: string,
  iconColor?: number,
): Promise<{ threadId: number; name: string } | { error: string }> {
  const t = token();
  const chatId = defaultChat();
  if (!t) return { error: "TELEGRAM_BOT_TOKEN not set" };
  if (!chatId) return { error: "TELEGRAM_CHAT_ID not set" };

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${t}/createForumTopic`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          name,
          icon_color: iconColor,
        }),
        cache: "no-store",
      },
    );
    const data = (await res.json()) as {
      ok: boolean;
      result?: { message_thread_id: number; name: string };
      description?: string;
      error_code?: number;
    };
    if (!data.ok || !data.result) {
      const desc = data.description ?? `Error ${data.error_code ?? res.status}`;
      console.error("[telegram] createForumTopic failed:", desc);
      return { error: desc };
    }
    return { threadId: data.result.message_thread_id, name: data.result.name };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[telegram] createForumTopic error:", msg);
    return { error: msg };
  }
}

/**
 * Fetch basic info about the configured chat so we can check if it's a forum.
 */
export async function getTelegramChatInfo(): Promise<{
  ok: boolean;
  title?: string;
  type?: string;
  isForum?: boolean;
  error?: string;
}> {
  const t = token();
  const chatId = defaultChat();
  if (!t) return { ok: false, error: "TELEGRAM_BOT_TOKEN not set" };
  if (!chatId) return { ok: false, error: "TELEGRAM_CHAT_ID not set" };

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${t}/getChat?chat_id=${encodeURIComponent(chatId)}`,
      { cache: "no-store" },
    );
    const data = (await res.json()) as {
      ok: boolean;
      result?: { title?: string; type?: string; is_forum?: boolean };
      description?: string;
    };
    if (!data.ok || !data.result) {
      return { ok: false, error: data.description ?? "getChat failed" };
    }
    return {
      ok: true,
      title: data.result.title,
      type: data.result.type,
      isForum: data.result.is_forum ?? false,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Send a test message to a specific thread id to verify it exists.
 * Returns null on success or an error string.
 */
export async function verifyThreadId(
  threadId: number,
): Promise<string | null> {
  const msgId = await sendTelegramMessage({
    threadId,
    text: `✅ <b>TMS</b> — thread <code>${threadId}</code> verified.`,
  });
  return msgId ? null : "Send failed — check thread id and bot permissions";
}

/**
 * Convenience builder for rich messages with a title + key/value lines.
 */
export function fmtTelegram(args: {
  title: string;
  emoji?: string;
  lines?: Array<[string, string | number | null | undefined]>;
  link?: { label: string; url: string };
}): string {
  const head = `${args.emoji ?? ""} <b>${escapeHtml(args.title)}</b>`.trim();
  const body =
    args.lines
      ?.filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `• <b>${escapeHtml(k)}:</b> ${escapeHtml(String(v))}`)
      .join("\n") ?? "";
  const link = args.link
    ? `\n<a href="${args.link.url}">${escapeHtml(args.link.label)}</a>`
    : "";
  return [head, body].filter(Boolean).join("\n") + link;
}

export const TELEGRAM_TOPIC_NAMES: Record<
  Exclude<TelegramTopic, "general">,
  string
> = {
  loads: "🚚 Loads",
  drivers: "👤 Drivers",
  invoices: "🧾 Invoices",
  expenses: "💸 Expenses",
  maintenance: "🔧 Maintenance",
  users: "👥 Users",
  alerts: "⚠️ Alerts",
};
