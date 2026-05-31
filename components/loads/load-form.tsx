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

type Opt = {
  id: string;
  label: string;
  pairedTrailerId?: string | null;
  pairedTruckId?: string | null;
};
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
  pickupTimezone: string | null;
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
  deliveryTimezone: string | null;
  deliveryWindow: string | null;
  deliveryContact: string | null;
  deliveryPhone: string | null;
  deliveryNotes: string | null;
  loadType: string | null;
  equipment: string | null;
  commodity: string | null;
  accessorials: string | null;
  loadNumber: string | null;
  pickupNumber: string | null;
  deliveryNumber: string | null;
  enteredBy: string | null;
  invoicingCompany: string | null;
  billingMethod: string | null;
  billingType: string | null;
  loadInvoiceNumber: string | null;
  accessorialAmount: number | null;
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

const ACCESSORIALS = [
  "Detention",
  "Driver Assist",
  "Drop Trailer",
  "Fuel Surcharge",
  "Hazmat",
  "Inside Delivery",
  "Inside Pickup",
  "Layover",
  "Liftgate Delivery",
  "Liftgate Pickup",
  "Lumper",
  "Notify Before Delivery",
  "Over-Dimensional",
  "Overweight",
  "Pallet Exchange",
  "Reefer",
  "Residential Delivery",
  "Residential Pickup",
  "Reweigh",
  "Scale Ticket",
  "Sorting & Segregating",
  "Stop-off",
  "TONU (Truck Order Not Used)",
  "Tanker Endorsement",
  "Team Driver",
  "Toll Charges",
  "Unloading",
  "Wait Time",
];

function AccessorialsField({
  initial,
  error,
}: {
  initial: string | null;
  error?: string[];
}) {
  const [selected, setSelected] = useState<string[]>(() => {
    try {
      return initial ? JSON.parse(initial) : [];
    } catch {
      return [];
    }
  });
  const toggle = (item: string) =>
    setSelected((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item],
    );
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">Accessorials</label>
      <input
        type="hidden"
        name="accessorials"
        value={JSON.stringify(selected)}
      />
      <div className="flex flex-wrap gap-2">
        {ACCESSORIALS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => toggle(a)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${selected.includes(a) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-primary hover:text-primary"}`}
          >
            {a}
          </button>
        ))}
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error[0]}</p>}
    </div>
  );
}

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
  userName,
  companyName,
}: {
  initial?: LoadFormInitial;
  customers: Opt[];
  drivers: Opt[];
  trucks: Opt[];
  trailers: Opt[];
  driverAssignments?: DriverAssignment[];
  userName?: string;
  companyName?: string;
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
  const [price, setPrice] = useState(initial?.price ?? 0);
  const [accessorialAmount, setAccessorialAmount] = useState(
    initial?.accessorialAmount ?? 0,
  );

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
      setDriverId("");
    } else {
      const truck = trucks.find((t) => t.id === id);
      if (truck?.pairedTrailerId) setTrailerId(truck.pairedTrailerId);
      const assignment = driverAssignments.find((a) => a.truckId === id);
      if (assignment) setDriverId(assignment.id);
    }
  }

  function handleTrailerChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setTrailerId(id);
    if (!id) {
      setTruckId("");
      setDriverId("");
    } else {
      const trailer = trailers.find((t) => t.id === id);
      if (trailer?.pairedTruckId) setTruckId(trailer.pairedTruckId);
      const assignment = driverAssignments.find((a) => a.trailerId === id);
      if (assignment) setDriverId(assignment.id);
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

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── SHIPPER ── */}
        <section className="grid content-start gap-4 rounded-lg border bg-card p-6">
          <h3 className="font-semibold">Shipper</h3>
          <Field
            name="pickupCompanyName"
            label="Company"
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
          <div className="grid grid-cols-4 gap-2">
            <div className="col-span-2">
              <Field name="pickupCity" label="City" error={e.pickupCity}>
                <Input
                  id="pickupCity"
                  name="pickupCity"
                  defaultValue={initial?.pickupCity ?? ""}
                />
              </Field>
            </div>
            <Field name="pickupState" label="St." error={e.pickupState}>
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
          </div>
          <Field name="pickupCountry" label="Country" error={e.pickupCountry}>
            <Input
              id="pickupCountry"
              name="pickupCountry"
              defaultValue={initial?.pickupCountry ?? "US"}
            />
          </Field>
          <div className="grid grid-cols-3 gap-2 items-end">
            <div className="col-span-2">
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
            <Field name="pickupTimezone" label="TZ" error={e.pickupTimezone}>
              <Select
                id="pickupTimezone"
                name="pickupTimezone"
                defaultValue={initial?.pickupTimezone ?? ""}
              >
                <option value="">—</option>
                <option value="ET">ET</option>
                <option value="CT">CT</option>
                <option value="MT">MT</option>
                <option value="PT">PT</option>
                <option value="AKT">AKT</option>
                <option value="HT">HT</option>
                <option value="UTC">UTC</option>
              </Select>
            </Field>
          </div>
          <Field
            name="pickupWindow"
            label="Pickup Window"
            error={e.pickupWindow}
          >
            <Input
              id="pickupWindow"
              name="pickupWindow"
              placeholder="FCFS 08:00-15:00 / By Appt / ASAP"
              defaultValue={initial?.pickupWindow ?? ""}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field name="pickupContact" label="Contact" error={e.pickupContact}>
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
          <Field name="pickupNotes" label="Notes" error={e.pickupNotes}>
            <Textarea
              id="pickupNotes"
              name="pickupNotes"
              rows={2}
              defaultValue={initial?.pickupNotes ?? ""}
            />
          </Field>
        </section>

        {/* ── RECEIVER ── */}
        <section className="grid content-start gap-4 rounded-lg border bg-card p-6">
          <h3 className="font-semibold">Receiver</h3>
          <Field
            name="deliveryCompanyName"
            label="Company"
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
          <div className="grid grid-cols-4 gap-2">
            <div className="col-span-2">
              <Field name="deliveryCity" label="City" error={e.deliveryCity}>
                <Input
                  id="deliveryCity"
                  name="deliveryCity"
                  defaultValue={initial?.deliveryCity ?? ""}
                />
              </Field>
            </div>
            <Field name="deliveryState" label="St." error={e.deliveryState}>
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
          </div>
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
          <div className="grid grid-cols-3 gap-2 items-end">
            <div className="col-span-2">
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
              name="deliveryTimezone"
              label="TZ"
              error={e.deliveryTimezone}
            >
              <Select
                id="deliveryTimezone"
                name="deliveryTimezone"
                defaultValue={initial?.deliveryTimezone ?? ""}
              >
                <option value="">—</option>
                <option value="ET">ET</option>
                <option value="CT">CT</option>
                <option value="MT">MT</option>
                <option value="PT">PT</option>
                <option value="AKT">AKT</option>
                <option value="HT">HT</option>
                <option value="UTC">UTC</option>
              </Select>
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
          <div className="grid grid-cols-2 gap-2">
            <Field
              name="deliveryContact"
              label="Contact"
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
          <Field name="deliveryNotes" label="Notes" error={e.deliveryNotes}>
            <Textarea
              id="deliveryNotes"
              name="deliveryNotes"
              rows={2}
              defaultValue={initial?.deliveryNotes ?? ""}
            />
          </Field>
        </section>
      </div>

      {/* ── 3-COLUMN: Load/Equipment | Groups/Billing | Financials ── */}
      <div className="grid gap-4 xl:grid-cols-3 lg:grid-cols-2">
        {/* Col 1 – Load and Equipment */}
        <section className="grid content-start gap-3 rounded-lg border bg-card p-6">
          <h3 className="font-semibold">Load and Equipment</h3>
          <Field name="loadNumber" label="Load Number" error={e.loadNumber}>
            <Input
              id="loadNumber"
              name="loadNumber"
              defaultValue={initial?.loadNumber ?? ""}
            />
          </Field>
          <Field
            name="pickupNumber"
            label="Pickup Number"
            error={e.pickupNumber}
          >
            <Input
              id="pickupNumber"
              name="pickupNumber"
              defaultValue={initial?.pickupNumber ?? ""}
            />
          </Field>
          <Field
            name="deliveryNumber"
            label="Delivery Number"
            error={e.deliveryNumber}
          >
            <Input
              id="deliveryNumber"
              name="deliveryNumber"
              defaultValue={initial?.deliveryNumber ?? ""}
            />
          </Field>
          <Field name="commodity" label="Commodity" error={e.commodity}>
            <Select
              id="commodity"
              name="commodity"
              defaultValue={initial?.commodity ?? ""}
            >
              <option value="">—</option>
              {[
                "A+ Slabs",
                "Air Filtration Product",
                "Aluminium Coils",
                "Aluminum Cans",
                "Aluminum Wheels",
                "Appliances",
                "Auto Parts",
                "Baled Cardboard",
                "Baled Paper",
                "Batteries",
                "Beer",
                "Berries",
                "Beverage Machinery",
                "Beverages",
                "Bolts",
                "Books",
                "Bottled Water",
                "Bottles",
                "Brackets",
                "Brass",
                "Brick",
                "Building Materials",
                "Cable Trays",
                "Candies",
                "Canned Goods",
                "Car Parts",
                "Carbon",
                "Cardboard",
                "Cargo Restraint Products",
                "Chemicals",
                "Clothing",
                "Coffee",
                "Computer Equipment",
                "Construction Materials",
                "Consumer Electronics",
                "Copper",
                "Cosmetics",
                "Dairy Products",
                "Dry Goods",
                "Electronics",
                "Fertilizer",
                "Flooring",
                "Food Products",
                "Freight",
                "Fresh Produce",
                "Frozen Food",
                "Furniture",
                "Glass",
                "Grain",
                "Hardware",
                "Heavy Machinery",
                "Industrial Equipment",
                "Iron",
                "Landscaping Materials",
                "Lumber",
                "Machinery Parts",
                "Medical Equipment",
                "Medical Supplies",
                "Metal Parts",
                "Metal Scrap",
                "Military Equipment",
                "Motorcycle Parts",
                "Packaging Materials",
                "Paint",
                "Paper Products",
                "Pharmaceuticals",
                "Pipes",
                "Plastic",
                "Plumbing Supplies",
                "Plastics (Tubing, PVC Pipes, etc.)",
                "Poultry",
                "Produce",
                "Recycled Materials",
                "Refrigerated Goods",
                "Retail Goods",
                "Rubber",
                "Salt",
                "Seafood",
                "Seeds",
                "Sheet Metal",
                "Shoes",
                "Soft Drinks",
                "Solar Panels",
                "Steel",
                "Steel Coils",
                "Steel Pipes",
                "Stone",
                "Textiles",
                "Tires",
                "Tools",
                "Vegetables",
                "Water",
                "Wine",
                "Wire",
                "Wood",
                "Wood Products",
              ].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
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
          <Field name="equipment" label="Equipment Type" error={e.equipment}>
            <Select
              id="equipment"
              name="equipment"
              defaultValue={initial?.equipment ?? "Dry Van"}
            >
              <option value="">—</option>
              <option value="Dry Van">Dry Van</option>
              <option value="Reefer">Reefer</option>
              <option value="Flatbed">Flatbed</option>
              <option value="Step Deck">Step Deck</option>
              <option value="Flatbed or Step Deck">Flatbed or Step Deck</option>
              <option value="Conestoga">Conestoga</option>
              <option value="Power Only">Power Only</option>
              <option value="RGN">RGN (Removable Gooseneck)</option>
              <option value="Lowboy">Lowboy</option>
              <option value="Tanker">Tanker</option>
              <option value="Auto Carrier">Auto Carrier</option>
              <option value="Double Drop">Double Drop</option>
              <option value="Hotshot">Hotshot</option>
              <option value="Sprinter Van">Sprinter Van</option>
              <option value="Box Truck">Box Truck</option>
            </Select>
          </Field>
        </section>

        {/* Col 2 – Groups and Billing */}
        <section className="grid content-start gap-3 rounded-lg border bg-card p-6">
          <h3 className="font-semibold">Groups and Billing</h3>
          <Field name="enteredBy" label="Entered By" error={e.enteredBy}>
            <Select
              id="enteredBy"
              name="enteredBy"
              defaultValue={initial?.enteredBy ?? userName ?? ""}
            >
              <option value="">—</option>
              {userName && <option value={userName}>{userName}</option>}
              <option value="Dispatcher">Dispatcher</option>
              <option value="Accountant">Accountant</option>
              <option value="Manager">Manager</option>
              <option value="General">General</option>
            </Select>
          </Field>
          <Field
            name="invoicingCompany"
            label="Invoicing Company"
            error={e.invoicingCompany}
          >
            <Input
              id="invoicingCompany"
              name="invoicingCompany"
              defaultValue={initial?.invoicingCompany ?? companyName ?? ""}
            />
          </Field>
          <Field
            name="customerId"
            label="Bill-to Customer"
            error={e.customerId}
          >
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
          <Field
            name="billingMethod"
            label="Billing Method"
            error={e.billingMethod}
          >
            <Select
              id="billingMethod"
              name="billingMethod"
              defaultValue={initial?.billingMethod ?? "Collect"}
            >
              <option value="">—</option>
              <option value="Collect">Collect</option>
              <option value="Prepaid">Prepaid</option>
              <option value="3rd Party">3rd Party</option>
            </Select>
          </Field>
          <Field name="billingType" label="Billing Type" error={e.billingType}>
            <Select
              id="billingType"
              name="billingType"
              defaultValue={initial?.billingType ?? "Factoring"}
            >
              <option value="">—</option>
              <option value="Factoring">Factoring</option>
              <option value="Direct">Direct</option>
              <option value="Broker">Broker</option>
            </Select>
          </Field>
          <Field
            name="loadInvoiceNumber"
            label="Invoice #"
            error={e.loadInvoiceNumber}
          >
            <Input
              id="loadInvoiceNumber"
              name="loadInvoiceNumber"
              defaultValue={initial?.loadInvoiceNumber ?? ""}
            />
          </Field>
        </section>

        {/* Col 3 – Financials */}
        <section className="grid content-start gap-3 rounded-lg border bg-card p-6">
          <h3 className="font-semibold">Financials and Miles</h3>
          <Field name="price" label="Rate" required error={e.price}>
            <Input
              id="price"
              name="price"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(ev) => setPrice(Number(ev.target.value))}
              required
            />
          </Field>
          <Field
            name="accessorialAmount"
            label="Accessorial ($)"
            error={e.accessorialAmount}
          >
            <Input
              id="accessorialAmount"
              name="accessorialAmount"
              type="number"
              step="0.01"
              min="0"
              value={accessorialAmount}
              onChange={(ev) => setAccessorialAmount(Number(ev.target.value))}
            />
          </Field>
          <div className="flex items-center justify-between rounded border bg-muted/40 px-3 py-2">
            <span className="text-sm font-medium">Total</span>
            <span className="font-mono text-sm font-semibold">
              $
              {(price + accessorialAmount).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
          <input type="hidden" name="currency" value="USD" />
        </section>
      </div>

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
