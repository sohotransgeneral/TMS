import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { TelegramSetupClient } from "@/components/admin/telegram-setup-client";

export const metadata = { title: "Telegram setup" };

export default async function TelegramSetupPage() {
  await requirePermission("users:write");

  const hasToken = Boolean(process.env.TELEGRAM_BOT_TOKEN);
  const hasChat = Boolean(process.env.TELEGRAM_CHAT_ID);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Telegram setup"
        description="Create forum topics in your supergroup and route notifications by category."
      />

      <Card>
        <CardContent className="p-4 space-y-2 text-sm">
          <p>
            <strong>Status:</strong>{" "}
            <span className={hasToken ? "text-green-600" : "text-red-600"}>
              TELEGRAM_BOT_TOKEN {hasToken ? "OK" : "MISSING"}
            </span>{" "}
            ·{" "}
            <span className={hasChat ? "text-green-600" : "text-red-600"}>
              TELEGRAM_CHAT_ID {hasChat ? "OK" : "MISSING"}
            </span>
          </p>
          <p className="text-muted-foreground">
            Requirements: bot is an admin of the group with{" "}
            <em>Manage Topics</em> permission, and the group is a{" "}
            <em>forum-style supergroup</em> (enable topics in group settings).
          </p>
          <p className="text-muted-foreground">
            If auto-create fails, you can manually create topics in Telegram,
            then read the <code>message_thread_id</code> from{" "}
            <code>https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code>{" "}
            and paste them into the matching env vars below.
          </p>
        </CardContent>
      </Card>

      <TelegramSetupClient />
    </div>
  );
}
