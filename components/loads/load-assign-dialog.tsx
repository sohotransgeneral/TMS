"use client";

import { useState, useActionState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/forms/field";
import { assignLoad } from "@/actions/loads";
import { toActionState } from "@/lib/to-action-state";
import type { ActionResult } from "@/lib/action-helpers";

type Opt = { id: string; label: string };
type DriverAssignment = {
  id: string;
  truckId: string | null;
  trailerId: string | null;
};

export function LoadAssignDialog({
  loadId,
  current,
  drivers,
  trucks,
  trailers,
  driverAssignments = [],
  trigger,
}: {
  loadId: string;
  current: {
    driverId?: string | null;
    truckId?: string | null;
    trailerId?: string | null;
  };
  drivers: Opt[];
  trucks: Opt[];
  trailers: Opt[];
  driverAssignments?: DriverAssignment[];
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [driverId, setDriverId] = useState(current.driverId ?? "");
  const [truckId, setTruckId] = useState(current.truckId ?? "");
  const [trailerId, setTrailerId] = useState(current.trailerId ?? "");

  const action = toActionState(assignLoad);
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

  // Reset to current values when dialog opens
  useEffect(() => {
    if (open) {
      setDriverId(current.driverId ?? "");
      setTruckId(current.truckId ?? "");
      setTrailerId(current.trailerId ?? "");
    }
  }, [open, current.driverId, current.truckId, current.trailerId]);

  function handleDriverChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setDriverId(id);
    if (id) {
      const assignment = driverAssignments.find((a) => a.id === id);
      if (assignment) {
        setTruckId(assignment.truckId ?? "");
        setTrailerId(assignment.trailerId ?? "");
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={() => setOpen(true)}>{trigger}</div>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Resources</DialogTitle>
          <DialogDescription>
            Select driver, truck and trailer.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="id" value={loadId} />
          <Field name="driverId" label="Driver">
            <Select
              id="driverId"
              name="driverId"
              value={driverId}
              onChange={handleDriverChange}
            >
              <option value="">— no driver —</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field name="truckId" label="Truck">
            <Select
              id="truckId"
              name="truckId"
              value={truckId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setTruckId(e.target.value)
              }
            >
              <option value="">— no truck —</option>
              {trucks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field name="trailerId" label="Trailer">
            <Select
              id="trailerId"
              name="trailerId"
              value={trailerId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setTrailerId(e.target.value)
              }
            >
              <option value="">— no trailer —</option>
              {trailers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
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
              {pending ? "Saving…" : "Assign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type Opt = { id: string; label: string };

export function LoadAssignDialog({
  loadId,
  current,
  drivers,
  trucks,
  trailers,
  trigger,
}: {
  loadId: string;
  current: {
    driverId?: string | null;
    truckId?: string | null;
    trailerId?: string | null;
  };
  drivers: Opt[];
  trucks: Opt[];
  trailers: Opt[];
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const action = toActionState(assignLoad);
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
          <DialogTitle>Assign Resources</DialogTitle>
          <DialogDescription>
            Select driver, truck and trailer.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="id" value={loadId} />
          <Field name="driverId" label="Driver">
            <Select
              id="driverId"
              name="driverId"
              defaultValue={current.driverId ?? ""}
            >
              <option value="">— no driver —</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field name="truckId" label="Truck">
            <Select
              id="truckId"
              name="truckId"
              defaultValue={current.truckId ?? ""}
            >
              <option value="">— no truck —</option>
              {trucks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field name="trailerId" label="Trailer">
            <Select
              id="trailerId"
              name="trailerId"
              defaultValue={current.trailerId ?? ""}
            >
              <option value="">— no trailer —</option>
              {trailers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
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
              {pending ? "Saving…" : "Assign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
