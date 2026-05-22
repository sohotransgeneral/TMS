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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/forms/field";
import {
  createTrailer,
  updateTrailer,
  deleteTrailer,
} from "@/actions/trailers";
import { toActionState } from "@/lib/to-action-state";
import type { ActionResult } from "@/lib/action-helpers";

export type TrailerRow = {
  id: string;
  plateNumber: string;
  type: string | null;
  capacityKg: number | null;
  volumeM3: number | null;
  axles: number | null;
  insuranceExpiresAt: Date | string | null;
  itpExpiresAt: Date | string | null;
  status: string;
};

const STATUSES = ["AVAILABLE", "ON_ROUTE", "MAINTENANCE", "INACTIVE"] as const;
const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  ON_ROUTE: "On Route",
  MAINTENANCE: "In Service",
  INACTIVE: "Inactive",
};
const TYPES = [
  "TAUTLINER",
  "FRIGORIFIC",
  "PLATFORMA",
  "CISTERNA",
  "PORT_CONTAINER",
  "BENA",
  "ALTUL",
];
const toDateInput = (d: Date | string | null | undefined) =>
  d ? (typeof d === "string" ? new Date(d) : d).toISOString().slice(0, 10) : "";

export function TrailerFormDialog({
  initial,
  trigger,
}: {
  initial?: TrailerRow;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const editing = Boolean(initial);
  const action = toActionState(editing ? updateTrailer : createTrailer);
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
      <div onClick={() => setOpen(true)}>{trigger}</div>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Trailer" : "New Trailer"}</DialogTitle>
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
            <Field name="type" label="Tip" error={e.type}>
              <Select
                id="type"
                name="type"
                defaultValue={initial?.type ?? "TAUTLINER"}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field name="capacityKg" label="Capacity (kg)" error={e.capacityKg}>
              <Input
                id="capacityKg"
                name="capacityKg"
                type="number"
                defaultValue={initial?.capacityKg ?? ""}
              />
            </Field>
            <Field name="volumeM3" label="Volume (m³)" error={e.volumeM3}>
              <Input
                id="volumeM3"
                name="volumeM3"
                type="number"
                step="0.1"
                defaultValue={initial?.volumeM3 ?? ""}
              />
            </Field>
            <Field name="axles" label="Axles" error={e.axles}>
              <Input
                id="axles"
                name="axles"
                type="number"
                defaultValue={initial?.axles ?? ""}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
              name="itpExpiresAt"
              label="ITP expiră"
              error={e.itpExpiresAt}
            >
              <Input
                id="itpExpiresAt"
                name="itpExpiresAt"
                type="date"
                defaultValue={toDateInput(initial?.itpExpiresAt)}
              />
            </Field>
          </div>

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

export function NewTrailerButton() {
  return (
    <TrailerFormDialog
      trigger={
        <Button>
          <Plus className="h-4 w-4" /> New Trailer
        </Button>
      }
    />
  );
}

export function TrailerRowActions({ trailer }: { trailer: TrailerRow }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <TrailerFormDialog
        initial={trailer}
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
        title="Delete trailer?"
        confirmLabel="Delete"
        action={async () => deleteTrailer(trailer.id)}
      />
    </div>
  );
}
