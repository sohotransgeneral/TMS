"use client";

import { useState, useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/forms/field";
import { createDriver, updateDriver, deleteDriver } from "@/actions/drivers";
import { toActionState } from "@/lib/to-action-state";
import type { ActionResult } from "@/lib/action-helpers";

export type DriverRow = {
  id: string;
  firstName: string;
  lastName: string;
  cnp: string | null;
  licenseNumber: string | null;
  licenseCategories: string[];
  licenseExpiresAt: Date | string | null;
  tachoCardNumber: string | null;
  tachoCardExpiresAt: Date | string | null;
  status: string;
  salaryType: string | null;
  salaryPerKm: number | null;
  salaryFixedAmount: number | null;
  grossPercent: number | null;
  commissionRate: number | null;
  taxCas: number | null;
  taxCass: number | null;
  taxImpozit: number | null;
  internalNotes: string | null;
  truckId?: string | null;
  trailerId?: string | null;
  user: { id: string; email: string; phone: string | null };
};

const STATUSES = ["AVAILABLE", "ON_TRIP", "OFF_DUTY", "UNAVAILABLE"] as const;
const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  ON_TRIP: "On Trip",
  OFF_DUTY: "Off Duty",
  UNAVAILABLE: "Unavailable",
};

function toDateInput(d: Date | string | null | undefined) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

export function DriverFormDialog({
  initial,
  trucks = [],
  trailers = [],
  trigger,
}: {
  initial?: DriverRow;
  trucks?: { id: string; label: string }[];
  trailers?: { id: string; label: string }[];
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const editing = Boolean(initial);
  const action = toActionState(editing ? updateDriver : createDriver);
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(action, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message ?? "Saved.");
      setOpen(false);
    } else {
      const fieldSummary =
        state.fieldErrors && Object.keys(state.fieldErrors).length > 0
          ? ` (${Object.entries(state.fieldErrors)
              .map(([f, errs]) => `${f}: ${(errs as string[]).join(", ")}`)
              .join(" | ")})`
          : "";
      toast.error(state.error + fieldSummary);
    }
  }, [state]);

  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={() => setOpen(true)}>{trigger}</div>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Driver" : "New Driver"}</DialogTitle>
          <DialogDescription>
            Driver details and mobile app access credentials.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          {editing && <input type="hidden" name="id" value={initial!.id} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="firstName"
              label="First Name"
              required
              error={errors.firstName}
            >
              <Input
                id="firstName"
                name="firstName"
                defaultValue={initial?.firstName ?? ""}
                required
              />
            </Field>
            <Field
              name="lastName"
              label="Last Name"
              required
              error={errors.lastName}
            >
              <Input
                id="lastName"
                name="lastName"
                defaultValue={initial?.lastName ?? ""}
                required
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="email"
              label="Email"
              required={!editing}
              error={errors.email}
            >
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={initial?.user.email ?? ""}
                required={!editing}
              />
            </Field>
            <Field name="phone" label="Phone" error={errors.phone}>
              <Input
                id="phone"
                name="phone"
                defaultValue={initial?.user.phone ?? ""}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="cnp" label="CNP" error={errors.cnp}>
              <Input id="cnp" name="cnp" defaultValue={initial?.cnp ?? ""} />
            </Field>
            <Field
              name="password"
              label={editing ? "New Password" : "Password"}
              required={!editing}
              error={errors.password}
            >
              <Input
                id="password"
                name="password"
                type="password"
                minLength={8}
                required={!editing}
                placeholder={
                  editing
                    ? "Leave blank to keep current"
                    : "At least 8 characters"
                }
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="licenseNumber"
              label="License Number"
              error={errors.licenseNumber}
            >
              <Input
                id="licenseNumber"
                name="licenseNumber"
                defaultValue={initial?.licenseNumber ?? ""}
              />
            </Field>
            <Field
              name="licenseCategories"
              label="Categories (B, C, CE…)"
              error={errors.licenseCategories}
            >
              <Input
                id="licenseCategories"
                name="licenseCategories"
                defaultValue={(initial?.licenseCategories ?? []).join(",")}
                placeholder="ex: B,C,CE"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="licenseIssuedAt"
              label="License Issued"
              error={errors.licenseIssuedAt}
            >
              <Input id="licenseIssuedAt" name="licenseIssuedAt" type="date" />
            </Field>
            <Field
              name="licenseExpiresAt"
              label="License Expires"
              error={errors.licenseExpiresAt}
            >
              <Input
                id="licenseExpiresAt"
                name="licenseExpiresAt"
                type="date"
                defaultValue={toDateInput(initial?.licenseExpiresAt)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="tachoCardNumber"
              label="Tachograph Card"
              error={errors.tachoCardNumber}
            >
              <Input
                id="tachoCardNumber"
                name="tachoCardNumber"
                defaultValue={initial?.tachoCardNumber ?? ""}
              />
            </Field>
            <Field
              name="tachoCardExpiresAt"
              label="Tachograph Expires"
              error={errors.tachoCardExpiresAt}
            >
              <Input
                id="tachoCardExpiresAt"
                name="tachoCardExpiresAt"
                type="date"
                defaultValue={toDateInput(initial?.tachoCardExpiresAt)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field name="status" label="Status" error={errors.status}>
              <Select
                id="status"
                name="status"
                defaultValue={initial?.status ?? "AVAILABLE"}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field name="salaryType" label="Salary Type">
              <Select
                id="salaryType"
                name="salaryType"
                defaultValue={initial?.salaryType ?? "PER_MI"}
              >
                <option value="PER_MI">Per Mile</option>
                <option value="PERCENT_GROSS">% of Gross</option>
                <option value="FIXED_WEEKLY">Fixed — per week</option>
                <option value="FIXED">Fixed — per month</option>
              </Select>
            </Field>
            <Field
              name="salaryPerKm"
              label="Rate per mile (if Per Mile)"
              error={errors.salaryPerKm}
            >
              <Input
                id="salaryPerKm"
                name="salaryPerKm"
                type="number"
                step="0.001"
                defaultValue={initial?.salaryPerKm ?? ""}
              />
            </Field>
            <Field
              name="grossPercent"
              label="% of Gross (e.g. 90)"
              error={errors.grossPercent}
            >
              <Input
                id="grossPercent"
                name="grossPercent"
                type="number"
                step="0.1"
                min="0"
                max="100"
                defaultValue={initial?.grossPercent ?? ""}
              />
            </Field>
            <Field
              name="salaryFixedAmount"
              label="Fixed amount (month or week)"
              error={errors.salaryFixedAmount}
            >
              <Input
                id="salaryFixedAmount"
                name="salaryFixedAmount"
                type="number"
                step="1"
                defaultValue={initial?.salaryFixedAmount ?? ""}
              />
            </Field>
            <Field
              name="commissionRate"
              label="Commission bonus (%)"
              error={errors.commissionRate}
            >
              <Input
                id="commissionRate"
                name="commissionRate"
                type="number"
                step="0.01"
                defaultValue={initial?.commissionRate ?? ""}
              />
            </Field>
            <div className="col-span-full border-t pt-2">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Tax rates (%)
              </p>
              <div className="grid grid-cols-3 gap-3">
                <Field
                  name="taxCas"
                  label="CAS (pension)"
                  error={errors.taxCas}
                >
                  <Input
                    id="taxCas"
                    name="taxCas"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="25"
                    defaultValue={initial?.taxCas ?? ""}
                  />
                </Field>
                <Field
                  name="taxCass"
                  label="CASS (health)"
                  error={errors.taxCass}
                >
                  <Input
                    id="taxCass"
                    name="taxCass"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="10"
                    defaultValue={initial?.taxCass ?? ""}
                  />
                </Field>
                <Field
                  name="taxImpozit"
                  label="Income tax"
                  error={errors.taxImpozit}
                >
                  <Input
                    id="taxImpozit"
                    name="taxImpozit"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="10"
                    defaultValue={initial?.taxImpozit ?? ""}
                  />
                </Field>
              </div>
            </div>
          </div>

          <Field
            name="internalNotes"
            label="Internal notes"
            error={errors.internalNotes}
          >
            <Textarea
              id="internalNotes"
              name="internalNotes"
              rows={3}
              defaultValue={initial?.internalNotes ?? ""}
            />
          </Field>

          {/* Vehicle assignment */}
          <div className="grid gap-4 sm:grid-cols-2 border-t pt-4">
            <Field name="truckId" label="Assigned Truck" error={errors.truckId}>
              <Select
                id="truckId"
                name="truckId"
                defaultValue={initial?.truckId ?? ""}
              >
                <option value="">— none —</option>
                {trucks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              name="trailerId"
              label="Assigned Trailer"
              error={errors.trailerId}
            >
              <Select
                id="trailerId"
                name="trailerId"
                defaultValue={initial?.trailerId ?? ""}
              >
                <option value="">— none —</option>
                {trailers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

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

export function NewDriverButton({
  trucks = [],
  trailers = [],
}: {
  trucks?: { id: string; label: string }[];
  trailers?: { id: string; label: string }[];
}) {
  return (
    <DriverFormDialog
      trucks={trucks}
      trailers={trailers}
      trigger={
        <Button>
          <Plus className="h-4 w-4" /> New Driver
        </Button>
      }
    />
  );
}

export function DriverRowActions({
  driver,
  trucks = [],
  trailers = [],
}: {
  driver: DriverRow;
  trucks?: { id: string; label: string }[];
  trailers?: { id: string; label: string }[];
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <DriverFormDialog
        initial={driver}
        trucks={trucks}
        trailers={trailers}
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
        title="Delete driver?"
        description="This action is irreversible. Historical loads will retain the deleted driver's name."
        confirmLabel="Delete"
        action={async () => deleteDriver(driver.id)}
      />
    </div>
  );
}
