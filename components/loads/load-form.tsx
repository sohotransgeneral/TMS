"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { createLoad, updateLoad } from "@/actions/loads";
import { toActionState } from "@/lib/to-action-state";
import type { ActionResult } from "@/lib/action-helpers";

type Opt = { id: string; label: string; pairedTrailerId?: string | null; pairedTruckId?: string | null };
type DriverAssignment = {
  id: string;
  truckId: string | null;
  trailerId: string | null;
};

export type LoadFormInitial = {
  id: string;
  customerId: string | null;
  pickupCompanyName: string | null;
  pickupAddress: string;
  pickupCity: string | null;
  pickupState: string | null;
  pickupZip: string | null;
  pickupCountry: string | null;
  pickupDate: Date | string;
  pickupWindow: string | null;
  pickupContact: string | null;
  pickupPhone: string | null;
  pickupNotes: string | null;
  deliveryCompanyName: string | null;
  deliveryAddress: string;
  deliveryCity: string | null;
  deliveryState: string | null;
  deliveryZip: string | null;
  deliveryCountry: string | null;
  deliveryDate: Date | string;
  deliveryWindow: string | null;
  deliveryContact: string | null;
  deliveryPhone: string | null;
  deliveryNotes: string | null;
  loadType: string | null;
  equipment: string | null;
  cargoDescription: string | null;
  weightKg: number | null;
  volumeM3: number | null;
  packages: number | null;
  temperature: string | null;
  isHazardous: boolean;
  price: number;
  currency: string;
  lineHaulRate: number | null;
  fuelSurcharge: number | null;
  estimatedDistanceKm: number | null;
  poNumber: string | null;
  soNumber: string | null;
  brokerName: string | null;
  brokerPhone: string | null;
  brokerEmail: string | null;
  specialInstructions: string | null;
  driverId: string | null;
  truckId: string | null;
  trailerId: string | null;
  internalNotes: string | null;
};

const toDateTimeInput = (d: Date | string | null | undefined) => {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const off = date.getTimezoneOffset();
  return new Date(date.getTime() - off * 60_000).toISOString().slice(0, 16);
};

export function LoadForm({
  initial,
  customers,
  drivers,
  trucks,
  trailers,
  driverAssignments = [],
}: {
  initial?: LoadFormInitial;
  customers: Opt[];
  drivers: Opt[];
  trucks: Opt[];
  trailers: Opt[];
  driverAssignments?: DriverAssignment[];
}) {
  const editing = Boolean(initial);
  const router = useRouter();
  const action = toActionState(editing ? updateLoad : createLoad);
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(action, null);

  const [driverId, setDriverId] = useState(initial?.driverId ?? "");
  const [truckId, setTruckId] = useState(initial?.truckId ?? "");
  const [trailerId, setTrailerId] = useState(initial?.trailerId ?? "");

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

  function handleTruckChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setTruckId(id);
    if (!id) {
      setTrailerId("");
    } else {
      const truck = trucks.find((t) => t.id === id);
      if (truck?.pairedTrailerId) setTrailerId(truck.pairedTrailerId);
    }
  }

  function handleTrailerChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setTrailerId(id);
    if (!id) {
      setTruckId("");
    } else {
      const trailer = trailers.find((t) => t.id === id);
      if (trailer?.pairedTruckId) setTruckId(trailer.pairedTruckId);
    }
  }

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message ?? "Saved.");
      const id = (state.data as { id?: string } | undefined)?.id ?? initial?.id;
      if (id) router.push(`/dispatch/loads/${id}`);
      else router.push("/dispatch/loads");
    } else toast.error(state.error);
  }, [state, router, initial?.id]);

  const e = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} className="grid gap-6">
      {editing && <input type="hidden" name="id" value={initial!.id} />}

      <section className="grid gap-4 rounded-lg border bg-card p-6">
        <h3 className="font-semibold">Customer</h3>
        <Field name="customerId" label="Customer" error={e.customerId}>
          <Select
            id="customerId"
            name="customerId"
            defaultValue={initial?.customerId ?? ""}
          >
            <option value="">— spot / no customer —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
      </section>

      <section className="grid gap-4 rounded-lg border bg-card p-6">
        <h3 className="font-semibold">Pickup</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="pickupCompanyName"
            label="Shipper Company"
            error={e.pickupCompanyName}
          >
            <Input
              id="pickupCompanyName"
              name="pickupCompanyName"
              placeholder="ABC Manufacturing Inc."
              defaultValue={initial?.pickupCompanyName ?? ""}
            />
          </Field>
          <Field
            name="pickupAddress"
            label="Address"
            required
            error={e.pickupAddress}
          >
            <Input
              id="pickupAddress"
              name="pickupAddress"
              defaultValue={initial?.pickupAddress ?? ""}
              required
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field name="pickupCity" label="City" error={e.pickupCity}>
            <Input
              id="pickupCity"
              name="pickupCity"
              defaultValue={initial?.pickupCity ?? ""}
            />
          </Field>
          <Field name="pickupState" label="State" error={e.pickupState}>
            <Input
              id="pickupState"
              name="pickupState"
              placeholder="TX"
              maxLength={10}
              defaultValue={initial?.pickupState ?? ""}
            />
          </Field>
          <Field name="pickupZip" label="ZIP" error={e.pickupZip}>
            <Input
              id="pickupZip"
              name="pickupZip"
              defaultValue={initial?.pickupZip ?? ""}
            />
          </Field>
          <Field name="pickupCountry" label="Country" error={e.pickupCountry}>
            <Input
              id="pickupCountry"
              name="pickupCountry"
              defaultValue={initial?.pickupCountry ?? "US"}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="pickupDate"
            label="Date & Time"
            required
            error={e.pickupDate}
          >
            <Input
              id="pickupDate"
              name="pickupDate"
              type="datetime-local"
              defaultValue={toDateTimeInput(initial?.pickupDate)}
              required
            />
          </Field>
        </div>
        <Field name="pickupWindow" label="Pickup Window" error={e.pickupWindow}>
          <Input
            id="pickupWindow"
            name="pickupWindow"
            placeholder="FCFS 08:00-15:00 / By Appt / ASAP"
            defaultValue={initial?.pickupWindow ?? ""}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="pickupContact"
            label="Contact Person"
            error={e.pickupContact}
          >
            <Input
              id="pickupContact"
              name="pickupContact"
              defaultValue={initial?.pickupContact ?? ""}
            />
          </Field>
          <Field name="pickupPhone" label="Phone" error={e.pickupPhone}>
            <Input
              id="pickupPhone"
              name="pickupPhone"
              defaultValue={initial?.pickupPhone ?? ""}
            />
          </Field>
        </div>
        <Field name="pickupNotes" label="Pickup Notes" error={e.pickupNotes}>
          <Textarea
            id="pickupNotes"
            name="pickupNotes"
            rows={2}
            defaultValue={initial?.pickupNotes ?? ""}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="pickupLat" label="Lat (optional)">
            <Input
              id="pickupLat"
              name="pickupLat"
              type="number"
              step="0.000001"
            />
          </Field>
          <Field name="pickupLng" label="Lng (optional)">
            <Input
              id="pickupLng"
              name="pickupLng"
              type="number"
              step="0.000001"
            />
          </Field>
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border bg-card p-6">
        <h3 className="font-semibold">Delivery</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="deliveryCompanyName"
            label="Receiver Company"
            error={e.deliveryCompanyName}
          >
            <Input
              id="deliveryCompanyName"
              name="deliveryCompanyName"
              placeholder="XYZ Distribution Center"
              defaultValue={initial?.deliveryCompanyName ?? ""}
            />
          </Field>
          <Field
            name="deliveryAddress"
            label="Address"
            required
            error={e.deliveryAddress}
          >
            <Input
              id="deliveryAddress"
              name="deliveryAddress"
              defaultValue={initial?.deliveryAddress ?? ""}
              required
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field name="deliveryCity" label="City" error={e.deliveryCity}>
            <Input
              id="deliveryCity"
              name="deliveryCity"
              defaultValue={initial?.deliveryCity ?? ""}
            />
          </Field>
          <Field name="deliveryState" label="State" error={e.deliveryState}>
            <Input
              id="deliveryState"
              name="deliveryState"
              placeholder="CA"
              maxLength={10}
              defaultValue={initial?.deliveryState ?? ""}
            />
          </Field>
          <Field name="deliveryZip" label="ZIP" error={e.deliveryZip}>
            <Input
              id="deliveryZip"
              name="deliveryZip"
              defaultValue={initial?.deliveryZip ?? ""}
            />
          </Field>
          <Field
            name="deliveryCountry"
            label="Country"
            error={e.deliveryCountry}
          >
            <Input
              id="deliveryCountry"
              name="deliveryCountry"
              defaultValue={initial?.deliveryCountry ?? ""}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="deliveryDate"
            label="Date & Time"
            required
            error={e.deliveryDate}
          >
            <Input
              id="deliveryDate"
              name="deliveryDate"
              type="datetime-local"
              defaultValue={toDateTimeInput(initial?.deliveryDate)}
              required
            />
          </Field>
        </div>
        <Field
          name="deliveryWindow"
          label="Delivery Window"
          error={e.deliveryWindow}
        >
          <Input
            id="deliveryWindow"
            name="deliveryWindow"
            placeholder="FCFS 08:00-15:00 / By Appt / ASAP"
            defaultValue={initial?.deliveryWindow ?? ""}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="deliveryContact"
            label="Contact Person"
            error={e.deliveryContact}
          >
            <Input
              id="deliveryContact"
              name="deliveryContact"
              defaultValue={initial?.deliveryContact ?? ""}
            />
          </Field>
          <Field name="deliveryPhone" label="Phone" error={e.deliveryPhone}>
            <Input
              id="deliveryPhone"
              name="deliveryPhone"
              defaultValue={initial?.deliveryPhone ?? ""}
            />
          </Field>
        </div>
        <Field
          name="deliveryNotes"
          label="Delivery Notes"
          error={e.deliveryNotes}
        >
          <Textarea
            id="deliveryNotes"
            name="deliveryNotes"
            rows={2}
            defaultValue={initial?.deliveryNotes ?? ""}
          />
        </Field>
      </section>

      <section className="grid gap-4 rounded-lg border bg-card p-6">
        <h3 className="font-semibold">Cargo</h3>
        <Field
          name="cargoDescription"
          label="Cargo Description"
          error={e.cargoDescription}
        >
          <Input
            id="cargoDescription"
            name="cargoDescription"
            defaultValue={initial?.cargoDescription ?? ""}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field name="weightKg" label="Weight (lbs)" error={e.weightKg}>
            <Input
              id="weightKg"
              name="weightKg"
              type="number"
              step="any"
              min="0"
              defaultValue={initial?.weightKg ?? ""}
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
          <Field name="packages" label="Packages" error={e.packages}>
            <Input
              id="packages"
              name="packages"
              type="number"
              defaultValue={initial?.packages ?? ""}
            />
          </Field>
          <Field name="temperature" label="Temperature" error={e.temperature}>
            <Input
              id="temperature"
              name="temperature"
              placeholder="e.g.: +2/+6"
              defaultValue={initial?.temperature ?? ""}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isHazardous"
            defaultChecked={initial?.isHazardous ?? false}
            className="rounded border-input"
          />
          Hazardous Cargo (ADR)
        </label>
      </section>

      <section className="grid gap-4 rounded-lg border bg-card p-6">
        <h3 className="font-semibold">Load Details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="loadType" label="Load Type" error={e.loadType}>
            <Select
              id="loadType"
              name="loadType"
              defaultValue={initial?.loadType ?? ""}
            >
              <option value="">—</option>
              <option value="FTL">Full Truckload (FTL)</option>
              <option value="LTL">Less Than Truckload (LTL)</option>
              <option value="PTL">Partial Truckload (PTL)</option>
              <option value="FLATBED">Flatbed</option>
              <option value="REEFER">Reefer</option>
              <option value="HAZMAT">Hazmat</option>
            </Select>
          </Field>
          <Field name="equipment" label="Equipment" error={e.equipment}>
            <Input
              id="equipment"
              name="equipment"
              placeholder="53' Dry Van, Reefer, Flatbed…"
              defaultValue={initial?.equipment ?? ""}
            />
          </Field>
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border bg-card p-6">
        <h3 className="font-semibold">Commercial</h3>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field name="price" label="Total Pay" required error={e.price}>
            <Input
              id="price"
              name="price"
              type="number"
              step="0.01"
              defaultValue={initial?.price ?? ""}
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
              <option value="GBP">GBP</option>
            </Select>
          </Field>
          <Field name="lineHaulRate" label="Line Haul" error={e.lineHaulRate}>
            <Input
              id="lineHaulRate"
              name="lineHaulRate"
              type="number"
              step="0.01"
              min="0"
              placeholder="1950.00"
              defaultValue={initial?.lineHaulRate ?? ""}
            />
          </Field>
          <Field
            name="fuelSurcharge"
            label="Fuel Surcharge"
            error={e.fuelSurcharge}
          >
            <Input
              id="fuelSurcharge"
              name="fuelSurcharge"
              type="number"
              step="0.01"
              min="0"
              placeholder="250.00"
              defaultValue={initial?.fuelSurcharge ?? ""}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            name="estimatedDistanceKm"
            label="Miles"
            error={e.estimatedDistanceKm}
          >
            <Input
              id="estimatedDistanceKm"
              name="estimatedDistanceKm"
              type="number"
              step="any"
              min="0"
              defaultValue={initial?.estimatedDistanceKm ?? ""}
            />
          </Field>
          <Field name="poNumber" label="PO Number" error={e.poNumber}>
            <Input
              id="poNumber"
              name="poNumber"
              placeholder="PO# 450076"
              defaultValue={initial?.poNumber ?? ""}
            />
          </Field>
          <Field name="soNumber" label="SO Number" error={e.soNumber}>
            <Input
              id="soNumber"
              name="soNumber"
              placeholder="SO# 987654"
              defaultValue={initial?.soNumber ?? ""}
            />
          </Field>
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border bg-card p-6">
        <h3 className="font-semibold">Broker</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field name="brokerName" label="Broker Name" error={e.brokerName}>
            <Input
              id="brokerName"
              name="brokerName"
              defaultValue={initial?.brokerName ?? ""}
            />
          </Field>
          <Field name="brokerPhone" label="Phone" error={e.brokerPhone}>
            <Input
              id="brokerPhone"
              name="brokerPhone"
              defaultValue={initial?.brokerPhone ?? ""}
            />
          </Field>
          <Field name="brokerEmail" label="Email" error={e.brokerEmail}>
            <Input
              id="brokerEmail"
              name="brokerEmail"
              type="email"
              defaultValue={initial?.brokerEmail ?? ""}
            />
          </Field>
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border bg-card p-6">
        <h3 className="font-semibold">Assignment (optional)</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field name="driverId" label="Driver" error={e.driverId}>
            <Select
              id="driverId"
              name="driverId"
              value={driverId}
              onChange={handleDriverChange}
            >
              <option value="">—</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field name="truckId" label="Truck" error={e.truckId}>
            <Select
              id="truckId"
              name="truckId"
              value={truckId}
              onChange={handleTruckChange}
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
              value={trailerId}
              onChange={handleTrailerChange}
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
        <Field
          name="specialInstructions"
          label="Special Instructions"
          error={e.specialInstructions}
        >
          <Textarea
            id="specialInstructions"
            name="specialInstructions"
            rows={3}
            placeholder="Check call requirements, TONU policy, detention rules…"
            defaultValue={initial?.specialInstructions ?? ""}
          />
        </Field>
        <Field
          name="internalNotes"
          label="Internal Notes"
          error={e.internalNotes}
        >
          <Textarea
            id="internalNotes"
            name="internalNotes"
            rows={2}
            defaultValue={initial?.internalNotes ?? ""}
          />
        </Field>
      </section>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : editing ? "Save" : "Create Load"}
        </Button>
      </div>
    </form>
  );
}
