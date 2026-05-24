"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  createTelegramTopics,
  testTelegramTopic,
  type TopicSetupRow,
} from "@/actions/telegram";

export function TelegramSetupClient() {
  const [rows, setRows] = useState<TopicSetupRow[]>([]);
  const [pending, start] = useTransition();
  const [testPending, startTest] = useTransition();

  async function run() {
    start(async () => {
      const res = await createTelegramTopics();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setRows(res.data?.rows ?? []);
      toast.success(res.message ?? "OK");
    });
  }

  async function testOne(topic: string) {
    startTest(async () => {
      const fd = new FormData();
      fd.set("topic", topic);
      const res = await testTelegramTopic(fd);
      if (!res.ok) toast.error(res.error);
      else toast.success(res.message ?? "Sent.");
    });
  }

  const envBlock = rows
    .map((r) => {
      const id = r.createdThreadId ?? r.existingThreadId;
      return id ? `${r.envKey}="${id}"` : `# ${r.envKey}= (not created)`;
    })
    .join("\n");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={run} disabled={pending}>
          {pending ? "Creating topics…" : "Create / detect topics"}
        </Button>
      </div>

      {rows.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <ul className="space-y-2">
              {rows.map((r) => (
                <li
                  key={r.topic}
                  className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium">{r.name}</span>
                    {r.existingThreadId && (
                      <Badge variant="secondary">
                        existing: {r.existingThreadId}
                      </Badge>
                    )}
                    {r.createdThreadId && (
                      <Badge>created: {r.createdThreadId}</Badge>
                    )}
                    {r.error && (
                      <span className="text-xs text-red-600">{r.error}</span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={testPending}
                    onClick={() => testOne(r.topic)}
                  >
                    Send test
                  </Button>
                </li>
              ))}
            </ul>

            <div className="space-y-1">
              <p className="text-sm font-medium">
                Add these to <code>.env.local</code> (and Vercel env):
              </p>
              <pre className="bg-muted text-xs p-3 rounded overflow-x-auto">
                {envBlock}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
