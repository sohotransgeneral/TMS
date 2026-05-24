"use client";

import { useState, useActionState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { changeLoadStatus } from "@/actions/loads";
import { toActionState } from "@/lib/to-action-state";
import { LOAD_NEXT_STATUSES, LOAD_STATUS_LABELS } from "@/lib/validators/load";
import type { ActionResult } from "@/lib/action-helpers";

export function LoadStatusButton({
  loadId,
  current,
  canForce,
}: {
  loadId: string;
  current: string;
  canForce?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const action = toActionState(changeLoadStatus);
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(action, null);
  const allowed = LOAD_NEXT_STATUSES[current] ?? [];
  const options = canForce ? Object.keys(LOAD_STATUS_LABELS) : allowed;

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message ?? "Salvat.");
      setOpen(false);
    } else toast.error(state.error);
  }, [state]);

  if (options.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)} size="sm">
        Change Status
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Load Status</DialogTitle>
          <DialogDescription>
            Current status: {LOAD_STATUS_LABELS[current] ?? current}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="id" value={loadId} />
          <Field name="status" label="New Status" required>
            <Select
              id="status"
              name="status"
              defaultValue={options.includes(current) ? current : options[0]}
            >
              {options.map((s) => (
                <option key={s} value={s}>
                  {LOAD_STATUS_LABELS[s] ?? s}
                </option>
              ))}
            </Select>
          </Field>
          <Field name="note" label="Note (optional)">
            <Textarea id="note" name="note" rows={2} />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
