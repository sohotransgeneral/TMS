"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from "@/actions/notifications";
import { toActionState } from "@/lib/to-action-state";
import type { ActionResult } from "@/lib/action-helpers";

export function MarkReadButton({ id }: { id: string }) {
  const action = toActionState(markNotificationRead);
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(action, null);
  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message ?? "OK");
    else toast.error(state.error);
  }, [state]);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>
        Mark as read
      </Button>
    </form>
  );
}

export function DeleteNotificationButton({ id }: { id: string }) {
  const action = toActionState(deleteNotification);
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(action, null);
  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message ?? "Deleted.");
    else toast.error(state.error);
  }, [state]);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>
        ×
      </Button>
    </form>
  );
}

export function MarkAllReadButton() {
  const action = toActionState(markAllNotificationsRead);
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(action, null);
  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message ?? "OK");
    else toast.error(state.error);
  }, [state]);
  return (
    <form action={formAction}>
      <Button type="submit" variant="outline" disabled={pending}>
        Mark all as read
      </Button>
    </form>
  );
}
