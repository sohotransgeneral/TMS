"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { changeInvoiceStatus, deleteInvoice } from "@/actions/invoices";
import { toActionState } from "@/lib/to-action-state";
import type { ActionResult } from "@/lib/action-helpers";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/forms/field";
import {
  INVOICE_STATUSES,
  INVOICE_STATUS_LABELS,
} from "@/lib/validators/accounting";

export function InvoiceStatusDialog({
  invoiceId,
  current,
  trigger,
}: {
  invoiceId: string;
  current: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const action = toActionState(changeInvoiceStatus);
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(action, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message ?? "Saved.");
      setOpen(false);
    } else toast.error(state.error);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={() => setOpen(true)}>{trigger}</div>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change invoice status</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="id" value={invoiceId} />
          <Field name="status" label="Status" required>
            <Select id="status" name="status" defaultValue={current}>
              {INVOICE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {INVOICE_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
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

export function DeleteInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const action = toActionState(deleteInvoice);
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(action, null);

  useEffect(() => {
    if (!state) return;
    if (!state.ok) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm("Delete this invoice?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={invoiceId} />
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Deleting…" : "Delete"}
      </Button>
    </form>
  );
}
