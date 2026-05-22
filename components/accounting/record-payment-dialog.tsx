"use client";

import { useActionState, useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { recordPayment } from "@/actions/payments";
import { toActionState } from "@/lib/to-action-state";
import type { ActionResult } from "@/lib/action-helpers";

const today = () => {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
};

export function RecordPaymentDialog({
  invoiceId,
  remaining,
  currency,
  trigger,
}: {
  invoiceId: string;
  remaining: number;
  currency: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const action = toActionState(recordPayment);
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(action, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message ?? "Salvat.");
      setOpen(false);
    } else toast.error(state.error);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={() => setOpen(true)}>{trigger}</div>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Remaining balance: {remaining.toFixed(2)} {currency}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <input type="hidden" name="currency" value={currency} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="amount" label="Amount" required>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={remaining.toFixed(2)}
                required
              />
            </Field>
            <Field name="paidAt" label="Payment Date" required>
              <Input
                id="paidAt"
                name="paidAt"
                type="date"
                defaultValue={today()}
                required
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="method" label="Method">
              <Select id="method" name="method" defaultValue="bank">
                <option value="bank">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field name="reference" label="Reference (wire, receipt)">
              <Input id="reference" name="reference" />
            </Field>
          </div>
          <Field name="notes" label="Notes">
            <Textarea id="notes" name="notes" rows={2} />
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
              {pending ? "Saving…" : "Record Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
