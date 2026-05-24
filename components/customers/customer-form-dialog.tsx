"use client";

import { useState, useActionState, useEffect } from "react";
import { toast } from "sonner";
import { KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/forms/field";
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  setCustomerPortalPassword,
} from "@/actions/customers";
import { toActionState } from "@/lib/to-action-state";
import type { ActionResult } from "@/lib/action-helpers";

export type CustomerRow = {
  id: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  taxId: string | null;
  registrationNumber: string | null;
  street: string | null;
  city: string | null;
  country: string | null;
  paymentTermsDays: number | null;
  creditLimit: number | null;
  notes: string | null;
  userId: string | null;
  user: { email: string } | null;
};

export function CustomerFormDialog({
  initial,
  trigger,
}: {
  initial?: CustomerRow;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const editing = Boolean(initial);
  const action = toActionState(editing ? updateCustomer : createCustomer);
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
      <div onClick={() => setOpen(true)}>{trigger}</div>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit Customer" : "New Customer"}
          </DialogTitle>
          <DialogDescription>Tax details and payment terms.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          {editing && <input type="hidden" name="id" value={initial!.id} />}

          <Field name="name" label="Name" required error={e.name}>
            <Input
              id="name"
              name="name"
              defaultValue={initial?.name ?? ""}
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="taxId" label="CUI / VAT" error={e.taxId}>
              <Input
                id="taxId"
                name="taxId"
                defaultValue={initial?.taxId ?? ""}
              />
            </Field>
            <Field
              name="registrationNumber"
              label="Trade Reg. Number"
              error={e.registrationNumber}
            >
              <Input
                id="registrationNumber"
                name="registrationNumber"
                defaultValue={initial?.registrationNumber ?? ""}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="contactPerson"
              label="Contact Person"
              error={e.contactPerson}
            >
              <Input
                id="contactPerson"
                name="contactPerson"
                defaultValue={initial?.contactPerson ?? ""}
              />
            </Field>
            <Field name="email" label="Email" error={e.email}>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={initial?.email ?? ""}
              />
            </Field>
            <Field name="phone" label="Phone" error={e.phone}>
              <Input
                id="phone"
                name="phone"
                defaultValue={initial?.phone ?? ""}
              />
            </Field>
          </div>

          <Field name="street" label="Address" error={e.street}>
            <Input
              id="street"
              name="street"
              defaultValue={initial?.street ?? ""}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="city" label="City" error={e.city}>
              <Input id="city" name="city" defaultValue={initial?.city ?? ""} />
            </Field>
            <Field name="country" label="Country" error={e.country}>
              <Input
                id="country"
                name="country"
                defaultValue={initial?.country ?? "RO"}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="paymentTermsDays"
              label="Payment Terms (days)"
              error={e.paymentTermsDays}
            >
              <Input
                id="paymentTermsDays"
                name="paymentTermsDays"
                type="number"
                defaultValue={initial?.paymentTermsDays ?? 30}
              />
            </Field>
            <Field
              name="creditLimit"
              label="Credit Limit (€)"
              error={e.creditLimit}
            >
              <Input
                id="creditLimit"
                name="creditLimit"
                type="number"
                step="0.01"
                defaultValue={initial?.creditLimit ?? ""}
              />
            </Field>
          </div>

          <Field name="notes" label="Notes" error={e.notes}>
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              defaultValue={initial?.notes ?? ""}
            />
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

export function NewCustomerButton() {
  return (
    <CustomerFormDialog
      trigger={
        <Button>
          <Plus className="h-4 w-4" /> New Customer
        </Button>
      }
    />
  );
}

export function CustomerRowActions({ customer }: { customer: CustomerRow }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <CustomerPortalDialog customer={customer} />
      <CustomerFormDialog
        initial={customer}
        trigger={
          <Button variant="ghost" size="icon" aria-label="Edit">
            <Pencil className="h-4 w-4" />
          </Button>
        }
      />
      <ConfirmDialog
        trigger={
          <Button variant="ghost" size="icon" aria-label="Delete">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        }
        title="Delete customer?"
        description="Will be blocked if there are associated loads or invoices."
        confirmLabel="Delete"
        action={async () => deleteCustomer(customer.id)}
      />
    </div>
  );
}

function CustomerPortalDialog({ customer }: { customer: CustomerRow }) {
  const [open, setOpen] = useState(false);
  const action = toActionState(setCustomerPortalPassword);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(action, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message ?? "Portal access set.");
      setOpen(false);
    } else toast.error(state.error);
  }, [state]);

  const hasPortal = Boolean(customer.userId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Portal access"
        title={hasPortal ? "Reset portal password" : "Set portal password"}
        onClick={() => setOpen(true)}
      >
        <KeyRound className={`h-4 w-4 ${hasPortal ? "text-green-600" : "text-muted-foreground"}`} />
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {hasPortal ? "Reset Portal Password" : "Enable Customer Portal"}
          </DialogTitle>
          <DialogDescription>
            {hasPortal
              ? `Current login: ${customer.user?.email ?? customer.email}`
              : customer.email
              ? `Will create a login for ${customer.email}`
              : "Add an email to the customer first."}
          </DialogDescription>
        </DialogHeader>
        {(!hasPortal && !customer.email) ? (
          <p className="text-sm text-destructive">
            This customer has no email address. Edit the customer and add one first.
          </p>
        ) : (
          <form action={formAction} className="grid gap-4">
            <input type="hidden" name="customerId" value={customer.id} />
            <Field name="password" label="New Password" required>
              <Input
                id="password"
                name="password"
                type="password"
                minLength={8}
                required
                placeholder="At least 8 characters"
              />
            </Field>
            <Field name="confirmPassword" label="Confirm Password" required>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                minLength={8}
                required
                placeholder="Repeat password"
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : hasPortal ? "Reset Password" : "Enable Portal"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
