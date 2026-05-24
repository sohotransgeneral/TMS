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
import { createTruck, updateTruck, deleteTruck } from "@/actions/trucks";
import { toActionState } from "@/lib/to-action-state";
import type { ActionResult } from "@/lib/action-helpers";

export type TruckRow = {
  id: string;
  plateNumber: string;
  vin: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  mileage: number | null;
  avgConsumption: number | null;
  itpExpiresAt: Date | string | null;
  insuranceExpiresAt: Date | string | null;
  vignetteExpiresAt: Date | string | null;
  tachographExpiresAt: Date | string | null;
  status: string;
  notes: string | null;
};

const STATUSES = ["AVAILABLE", "ON_TRIP", "IN_SERVICE", "UNAVAILABLE"] as const;
const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  ON_TRIP: "On Trip",
  IN_SERVICE: "In Service",
  UNAVAILABLE: "Unavailable",
};

const toDateInput = (d: Date | string | null | undefined) =>
  d ? (typeof d === "string" ? new Date(d) : d).toISOString().slice(0, 10) : "";

export function TruckFormDialog({
  initial,
  trigger,
}: {
  initial?: TruckRow;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const editing = Boolean(initial);
  const action = toActionState(editing ? updateTruck : createTruck);
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
            {editing ? "Edit Truck" : "New Truck"}
          </DialogTitle>
          <DialogDescription>
            Technical details and document expiry dates.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          {editing && <input type="hidden" name="id" value={initial!.id} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="plateNumber"
              label="Plate Number"
              required
              error={e.plateNumber}
            >
              <Input
                id="plateNumber"
                name="plateNumber"
                defaultValue={initial?.plateNumber ?? ""}
                required
              />
            </Field>
            <Field name="vin" label="VIN" error={e.vin}>
              <Input id="vin" name="vin" defaultValue={initial?.vin ?? ""} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field name="make" label="Make" error={e.make}>
              <Input id="make" name="make" defaultValue={initial?.make ?? ""} />
            </Field>
            <Field name="model" label="Model" error={e.model}>
              <Input
                id="model"
                name="model"
                defaultValue={initial?.model ?? ""}
              />
            </Field>
            <Field name="year" label="Year" error={e.year}>
              <Input
                id="year"
                name="year"
                type="number"
                defaultValue={initial?.year ?? ""}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field name="mileage" label="Mileage (mi)" error={e.mileage}>
              <Input
                id="mileage"
                name="mileage"
                type="number"
                defaultValue={initial?.mileage ?? ""}
              />
            </Field>
            <Field
              name="avgConsumption"
              label="Consumption (mpg)"
              error={e.avgConsumption}
            >
              <Input
                id="avgConsumption"
                name="avgConsumption"
                type="number"
                step="0.01"
                defaultValue={initial?.avgConsumption ?? ""}
              />
            </Field>
            <Field name="status" label="Status" error={e.status}>
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
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="itpExpiresAt"
              label="ITP Expires"
              error={e.itpExpiresAt}
            >
              <Input
                id="itpExpiresAt"
                name="itpExpiresAt"
                type="date"
                defaultValue={toDateInput(initial?.itpExpiresAt)}
              />
            </Field>
            <Field
              name="insuranceExpiresAt"
              label="Insurance Expires"
              error={e.insuranceExpiresAt}
            >
              <Input
                id="insuranceExpiresAt"
                name="insuranceExpiresAt"
                type="date"
                defaultValue={toDateInput(initial?.insuranceExpiresAt)}
              />
            </Field>
            <Field
              name="vignetteExpiresAt"
              label="Vignette Expires"
              error={e.vignetteExpiresAt}
            >
              <Input
                id="vignetteExpiresAt"
                name="vignetteExpiresAt"
                type="date"
                defaultValue={toDateInput(initial?.vignetteExpiresAt)}
              />
            </Field>
            <Field
              name="tachographExpiresAt"
              label="Tachograph Expires"
              error={e.tachographExpiresAt}
            >
              <Input
                id="tachographExpiresAt"
                name="tachographExpiresAt"
                type="date"
                defaultValue={toDateInput(initial?.tachographExpiresAt)}
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

export function NewTruckButton() {
  return (
    <TruckFormDialog
      trigger={
        <Button>
          <Plus className="h-4 w-4" /> New Truck
        </Button>
      }
    />
  );
}

export function TruckRowActions({ truck }: { truck: TruckRow }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <TruckFormDialog
        initial={truck}
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
        title="Delete truck?"
        description="This action is irreversible."
        confirmLabel="Delete"
        action={async () => deleteTruck(truck.id)}
      />
    </div>
  );
}
