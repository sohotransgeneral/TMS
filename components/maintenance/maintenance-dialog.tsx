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
  createMaintenance,
  updateMaintenance,
  deleteMaintenance,
} from "@/actions/maintenance";
import { toActionState } from "@/lib/to-action-state";
import {
  MAINTENANCE_STATUSES,
  MAINTENANCE_STATUS_LABELS,
} from "@/lib/validators/maintenance";
import type { ActionResult } from "@/lib/action-helpers";
import { Plus } from "lucide-react";

type Opt = { id: string; label: string };

export type MaintenanceInitial = {
  id: string;
  truckId: string | null;
  trailerId: string | null;
  title: string;
  description: string | null;
  scheduledAt: Date | string;
  completedAt: Date | string | null;
  cost: number | null;
  currency: string;
  mileage: number | null;
  partsReplaced: string[];
  status: string;
  notes: string | null;
  documentUrl: string | null;
};

const toDate = (d: Date | string | null | undefined) => {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const off = date.getTimezoneOffset();
  return new Date(date.getTime() - off * 60_000).toISOString().slice(0, 10);
};

export function MaintenanceFormDialog({
  initial,
  trucks,
  trailers,
  trigger,
}: {
  initial?: MaintenanceInitial;
  trucks: Opt[];
  trailers: Opt[];
  trigger?: React.ReactNode;
}) {
  const editing = Boolean(initial);
  const [open, setOpen] = useState(false);
  const action = toActionState(editing ? updateMaintenance : createMaintenance);
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

  const e = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={() => setOpen(true)}>
        {trigger ?? (
          <Button>
            <Plus className="mr-2 h-4 w-4" /> New Maintenance
          </Button>
        )}
      </div>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit Maintenance" : "New Maintenance"}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          {editing && <input type="hidden" name="id" value={initial!.id} />}
          <div className="grid gap-4 sm:grid-cols-2">
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
            <Field name="trailerId" label="Trailer" error={e.trailerId}>
              <Select
                id="trailerId"
                name="trailerId"
                defaultValue={initial?.trailerId ?? ""}
              >
                <option value="">—</option>
                {trailers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field name="title" label="Title / Work" required error={e.title}>
            <Input
              id="title"
              name="title"
              defaultValue={initial?.title ?? ""}
              required
            />
          </Field>
          <Field name="description" label="Description" error={e.description}>
            <Textarea
              id="description"
              name="description"
              rows={2}
              defaultValue={initial?.description ?? ""}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              name="scheduledAt"
              label="Scheduled"
              required
              error={e.scheduledAt}
            >
              <Input
                id="scheduledAt"
                name="scheduledAt"
                type="date"
                defaultValue={toDate(initial?.scheduledAt ?? new Date())}
                required
              />
            </Field>
            <Field name="completedAt" label="Completed">
              <Input
                id="completedAt"
                name="completedAt"
                type="date"
                defaultValue={toDate(initial?.completedAt)}
              />
            </Field>
            <Field name="status" label="Status" required>
              <Select
                id="status"
                name="status"
                defaultValue={initial?.status ?? "SCHEDULED"}
              >
                {MAINTENANCE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {MAINTENANCE_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field name="cost" label="Cost">
              <Input
                id="cost"
                name="cost"
                type="number"
                step="0.01"
                min="0"
                defaultValue={initial?.cost ?? ""}
              />
            </Field>
            <Field name="currency" label="Currency">
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
            <Field name="mileage" label="Mileage">
              <Input
                id="mileage"
                name="mileage"
                type="number"
                min="0"
                defaultValue={initial?.mileage ?? ""}
              />
            </Field>
          </div>
          <Field name="partsReplaced" label="Parts Replaced (comma-separated)">
            <Input
              id="partsReplaced"
              name="partsReplaced"
              defaultValue={(initial?.partsReplaced ?? []).join(", ")}
            />
          </Field>
          <Field name="notes" label="Notes">
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

export function DeleteMaintenanceButton({ id }: { id: string }) {
  const action = toActionState(deleteMaintenance);
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(action, null);
  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message ?? "Șters.");
    else toast.error(state.error);
  }, [state]);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm("Sigur ștergi?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>
        ×
      </Button>
    </form>
  );
}
