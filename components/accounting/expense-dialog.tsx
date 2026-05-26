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
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import {
  createExpense,
  updateExpense,
  decideExpense,
  deleteExpense,
} from "@/actions/expenses";
import { toActionState } from "@/lib/to-action-state";
import {
  EXPENSE_TYPES,
  EXPENSE_TYPE_LABELS,
} from "@/lib/validators/accounting";
import type { ActionResult } from "@/lib/action-helpers";
import { Plus } from "lucide-react";

type Opt = { id: string; label: string };

export type ExpenseInitial = {
  id: string;
  type: string;
  amount: number;
  currency: string;
  description: string | null;
  occurredAt: Date | string;
  loadId: string | null;
  truckId: string | null;
  driverId: string | null;
  receiptUrl: string | null;
  chargedTo: string | null;
};

const toDate = (d: Date | string | null | undefined) => {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const off = date.getTimezoneOffset();
  return new Date(date.getTime() - off * 60_000).toISOString().slice(0, 10);
};

export function ExpenseFormDialog({
  initial,
  loads,
  trucks,
  drivers,
  trigger,
}: {
  initial?: ExpenseInitial;
  loads: Opt[];
  trucks: Opt[];
  drivers: Opt[];
  trigger?: React.ReactNode;
}) {
  const editing = Boolean(initial);
  const [open, setOpen] = useState(false);
  const action = toActionState(editing ? updateExpense : createExpense);
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

  const e = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={() => setOpen(true)}>
        {trigger ?? (
          <Button>
            <Plus className="mr-2 h-4 w-4" /> New Expense
          </Button>
        )}
      </div>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Expense" : "New Expense"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          {editing && <input type="hidden" name="id" value={initial!.id} />}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field name="type" label="Type" required error={e.type}>
              <Select
                id="type"
                name="type"
                defaultValue={initial?.type ?? "FUEL"}
              >
                {EXPENSE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {EXPENSE_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field name="amount" label="Amount" required error={e.amount}>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={initial?.amount ?? ""}
                required
              />
            </Field>
            <Field name="currency" label="Currency" error={e.currency}>
              <Select
                id="currency"
                name="currency"
                defaultValue={initial?.currency ?? "USD"}
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="RON">RON</option>
                <option value="MDL">MDL</option>
              </Select>
            </Field>
          </div>
          <Field
            name="occurredAt"
            label="Expense Date"
            required
            error={e.occurredAt}
          >
            <Input
              id="occurredAt"
              name="occurredAt"
              type="date"
              defaultValue={toDate(initial?.occurredAt ?? new Date())}
              required
            />
          </Field>
          <Field name="description" label="Description" error={e.description}>
            <Input
              id="description"
              name="description"
              defaultValue={initial?.description ?? ""}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field name="loadId" label="Load" error={e.loadId}>
              <Select
                id="loadId"
                name="loadId"
                defaultValue={initial?.loadId ?? ""}
              >
                <option value="">—</option>
                {loads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field name="truckId" label="Truck" error={e.truckId}>
              <Select
                id="truckId"
                name="truckId"
                defaultValue={initial?.truckId ?? ""}
              >
                <option value="">—</option>
                {trucks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field name="driverId" label="Driver" error={e.driverId}>
              <Select
                id="driverId"
                name="driverId"
                defaultValue={initial?.driverId ?? ""}
              >
                <option value="">—</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field
            name="receiptUrl"
            label="Receipt URL (optional)"
            error={e.receiptUrl}
          >
            <Input
              id="receiptUrl"
              name="receiptUrl"
              type="url"
              defaultValue={initial?.receiptUrl ?? ""}
            />
          </Field>
          <Field name="chargedTo" label="Charged to" error={e.chargedTo}>
            <Select
              id="chargedTo"
              name="chargedTo"
              defaultValue={initial?.chargedTo ?? "COMPANY"}
            >
              <option value="COMPANY">
                🏢 Company (not deducted from driver)
              </option>
              <option value="DRIVER">
                🧑‍💼 Driver (deducted from driver salary)
              </option>
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
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ExpenseDecisionButtons({ expenseId }: { expenseId: string }) {
  const action = toActionState(decideExpense);
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(action, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message ?? "Saved.");
    else toast.error(state.error);
  }, [state]);

  return (
    <div className="flex gap-2">
      <form action={formAction}>
        <input type="hidden" name="id" value={expenseId} />
        <input type="hidden" name="decision" value="APPROVED" />
        <Button type="submit" size="sm" disabled={pending}>
          Approve
        </Button>
      </form>
      <form action={formAction}>
        <input type="hidden" name="id" value={expenseId} />
        <input type="hidden" name="decision" value="REJECTED" />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          Reject
        </Button>
      </form>
    </div>
  );
}

export function DeleteExpenseButton({ expenseId }: { expenseId: string }) {
  const action = toActionState(deleteExpense);
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
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm("Delete this item?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={expenseId} />
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>
        ×
      </Button>
    </form>
  );
}
