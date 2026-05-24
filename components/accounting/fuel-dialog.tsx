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
import { Field } from "@/components/forms/field";
import {
  createFuelEntry,
  updateFuelEntry,
  deleteFuelEntry,
} from "@/actions/fuel";
import { toActionState } from "@/lib/to-action-state";
import type { ActionResult } from "@/lib/action-helpers";
import { Plus } from "lucide-react";

type Opt = { id: string; label: string };

export type FuelInitial = {
  id: string;
  truckId: string | null;
  driverId: string | null;
  loadId: string | null;
  liters: number;
  pricePerLiter: number;
  totalAmount: number;
  currency: string;
  station: string | null;
  mileage: number | null;
  occurredAt: Date | string;
  receiptUrl: string | null;
};

const toDate = (d: Date | string | null | undefined) => {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const off = date.getTimezoneOffset();
  return new Date(date.getTime() - off * 60_000).toISOString().slice(0, 10);
};

export function FuelFormDialog({
  initial,
  trucks,
  drivers,
  loads,
  trigger,
}: {
  initial?: FuelInitial;
  trucks: Opt[];
  drivers: Opt[];
  loads: Opt[];
  trigger?: React.ReactNode;
}) {
  const editing = Boolean(initial);
  const [open, setOpen] = useState(false);
  const [liters, setLiters] = useState<number>(initial?.liters ?? 0);
  const [ppl, setPpl] = useState<number>(initial?.pricePerLiter ?? 0);
  const total = +(liters * ppl).toFixed(2);

  const action = toActionState(editing ? updateFuelEntry : createFuelEntry);
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
            <Plus className="mr-2 h-4 w-4" /> New Fill-up
          </Button>
        )}
      </div>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Fill-up" : "New Fill-up"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          {editing && <input type="hidden" name="id" value={initial!.id} />}
          <div className="grid gap-4 sm:grid-cols-3">
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
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field name="liters" label="Liters" required error={e.liters}>
              <Input
                id="liters"
                name="liters"
                type="number"
                step="0.01"
                min="0"
                value={liters}
                onChange={(ev) => setLiters(Number(ev.target.value))}
                required
              />
            </Field>
            <Field
              name="pricePerLiter"
              label="Price/liter"
              required
              error={e.pricePerLiter}
            >
              <Input
                id="pricePerLiter"
                name="pricePerLiter"
                type="number"
                step="0.001"
                min="0"
                value={ppl}
                onChange={(ev) => setPpl(Number(ev.target.value))}
                required
              />
            </Field>
            <Field
              name="totalAmount"
              label={`Total (calc: ${total})`}
              error={e.totalAmount}
            >
              <Input
                id="totalAmount"
                name="totalAmount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={initial?.totalAmount ?? ""}
                placeholder={String(total)}
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
          <div className="grid gap-4 sm:grid-cols-3">
            <Field name="occurredAt" label="Date" required error={e.occurredAt}>
              <Input
                id="occurredAt"
                name="occurredAt"
                type="date"
                defaultValue={toDate(initial?.occurredAt ?? new Date())}
                required
              />
            </Field>
            <Field name="station" label="Station">
              <Input
                id="station"
                name="station"
                defaultValue={initial?.station ?? ""}
              />
            </Field>
            <Field name="mileage" label="Mileage (mi)">
              <Input
                id="mileage"
                name="mileage"
                type="number"
                min="0"
                defaultValue={initial?.mileage ?? ""}
              />
            </Field>
          </div>
          <Field name="receiptUrl" label="Receipt URL (optional)">
            <Input
              id="receiptUrl"
              name="receiptUrl"
              type="url"
              defaultValue={initial?.receiptUrl ?? ""}
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

export function DeleteFuelButton({ id }: { id: string }) {
  const action = toActionState(deleteFuelEntry);
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
        if (!confirm("Are you sure you want to delete this entry?"))
          e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>
        ×
      </Button>
    </form>
  );
}
