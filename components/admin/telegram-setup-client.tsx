"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  createTelegramTopics,
  getTelegramDiagnostic,
  testTelegramTopic,
  testManualThread,
  type TopicSetupRow,
  type ChatDiagnostic,
} from "@/actions/telegram";

const TOPIC_ORDER = [
  "loads",
  "drivers",
  "invoices",
  "expenses",
  "maintenance",
  "users",
  "alerts",
] as const;

const ENV_KEYS: Record<string, string> = {
  loads: "TELEGRAM_THREAD_LOADS",
  drivers: "TELEGRAM_THREAD_DRIVERS",
  invoices: "TELEGRAM_THREAD_INVOICES",
  expenses: "TELEGRAM_THREAD_EXPENSES",
  maintenance: "TELEGRAM_THREAD_MAINTENANCE",
  users: "TELEGRAM_THREAD_USERS",
  alerts: "TELEGRAM_THREAD_ALERTS",
};

const TOPIC_LABELS: Record<string, string> = {
  loads: "🚚 Loads",
  drivers: "👤 Drivers",
  invoices: "🧾 Invoices",
  expenses: "💸 Expenses",
  maintenance: "🔧 Maintenance",
  users: "👥 Users",
  alerts: "⚠️ Alerts",
};

export function TelegramSetupClient() {
  const [chat, setChat] = useState<ChatDiagnostic | null>(null);
  const [rows, setRows] = useState<TopicSetupRow[]>([]);
  const [manual, setManual] = useState<Record<string, string>>({});

  const [diagPending, startDiag] = useTransition();
  const [createPending, startCreate] = useTransition();
  const [testPending, startTest] = useTransition();
  const [manualTestPending, startManualTest] = useTransition();

  function runDiag() {
    startDiag(async () => {
      const res = await getTelegramDiagnostic();
      if (!res.ok) { toast.error(res.error); return; }
      setChat(res.data ?? null);
    });
  }

  function runCreate() {
    startCreate(async () => {
      const res = await createTelegramTopics();
      if (!res.ok) { toast.error(res.error); return; }
      setRows(res.data?.rows ?? []);
      toast.success(res.message ?? "Done");
    });
  }

  function testTopic(topic: string) {
    startTest(async () => {
      const fd = new FormData();
      fd.set("topic", topic);
      const res = await testTelegramTopic(fd);
      if (!res.ok) toast.error(res.error);
      else toast.success(res.message ?? "Sent.");
    });
  }

  function testThread(threadId: string) {
    const id = Number(threadId);
    if (!id) { toast.error("Enter a numeric thread id first."); return; }
    startManualTest(async () => {
      const fd = new FormData();
      fd.set("threadId", String(id));
      const res = await testManualThread(fd);
      if (!res.ok) toast.error(res.error);
      else toast.success(res.message ?? "Verified.");
    });
  }

  const envLines = TOPIC_ORDER.map((topic) => {
    const envKey = ENV_KEYS[topic];
    const row = rows.find((r) => r.topic === topic);
    const id =
      row?.createdThreadId?.toString() ??
      row?.existingThreadId ??
      manual[topic] ??
      null;
    return id ? `${envKey}="${id}"` : `# ${envKey}= (not set)`;
  }).join("\n");

  return (
    <div className="space-y-6">
      {/* Step 1 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 1 — Check bot &amp; group</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={runDiag} disabled={diagPending} variant="outline" size="sm">
            {diagPending ? "Checking…" : "Check bot connection"}
          </Button>
          {chat && (
            <div className="text-sm space-y-1">
              <p>
                <span className="font-medium">Chat:</span> {chat.title ?? "—"} ({chat.type ?? "?"})
              </p>
              <p className="flex items-center gap-2">
                <span className="font-medium">Forum topics enabled:</span>
                {chat.isForum ? (
                  <Badge className="bg-green-600">Yes ✓</Badge>
                ) : (
                  <Badge variant="destructive">No — enable Topics in Telegram group settings</Badge>
                )}
              </p>
              {!chat.isForum && (
                <p className="text-xs text-muted-foreground">
                  In Telegram: open group → Edit → toggle <em>Topics</em> → Save.
                  The group must be a supergroup for topics to be available.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2a */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 2a — Auto-create topics (bot must be admin)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Make the bot a group admin with <em>Manage Topics</em> permission, then click below.
          </p>
          <Button onClick={runCreate} disabled={createPending}>
            {createPending ? "Creating…" : "Create topics"}
          </Button>

          {rows.length > 0 && (
            <ul className="space-y-2 mt-2">
              {rows.map((r) => (
                <li key={r.topic} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0 text-sm">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.name}</span>
                      {r.existingThreadId && (
                        <Badge variant="secondary">already set: {r.existingThreadId}</Badge>
                      )}
                      {r.createdThreadId && (
                        <Badge className="bg-green-600">created: {r.createdThreadId}</Badge>
                      )}
                    </div>
                    {r.error && (
                      <span className="text-xs text-red-600 break-all">⚠ {r.error}</span>
                    )}
                  </div>
                  {(r.existingThreadId || r.createdThreadId) && (
                    <Button size="sm" variant="outline" disabled={testPending} onClick={() => testTopic(r.topic)}>
                      Send test
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Step 2b */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 2b — Enter thread IDs manually</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
            <li>Create each topic manually in your Telegram group.</li>
            <li>
              Send any message inside that topic, then visit{" "}
              <a
                className="underline text-primary"
                href={`https://api.telegram.org/bot${process.env.NEXT_PUBLIC_TG_TOKEN ?? "TOKEN"}/getUpdates`}
                target="_blank"
                rel="noreferrer"
              >
                api.telegram.org/bot&lt;TOKEN&gt;/getUpdates
              </a>{" "}
              and copy the{" "}
              <code className="text-xs bg-muted px-1 rounded">message_thread_id</code>.
            </li>
            <li>Paste below, click <strong>Verify</strong> (sends a test message), then copy the env block.</li>
          </ol>

          <div className="grid gap-3">
            {TOPIC_ORDER.map((topic) => (
              <div key={topic} className="flex items-center gap-2 flex-wrap">
                <span className="w-36 text-sm shrink-0">{TOPIC_LABELS[topic]}</span>
                <Input
                  placeholder="e.g. 2"
                  className="max-w-[140px]"
                  value={manual[topic] ?? ""}
                  onChange={(e) => setManual((prev) => ({ ...prev, [topic]: e.target.value }))}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={manualTestPending}
                  onClick={() => testThread(manual[topic] ?? "")}
                >
                  Verify
                </Button>
                <code className="text-xs text-muted-foreground">{ENV_KEYS[topic]}</code>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 3 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 3 — Copy env vars</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted text-xs p-3 rounded overflow-x-auto select-all whitespace-pre-wrap">
            {envLines}
          </pre>
          <p className="mt-2 text-xs text-muted-foreground">
            Paste into <code>.env.local</code> and into Vercel → Project → Settings → Environment Variables, then redeploy.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

