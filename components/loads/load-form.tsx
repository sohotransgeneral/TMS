"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { AccessorialsField } from "@/components/loads/accessorials-field";
import { LoadTripMap } from "@/components/loads/load-trip-map";
import type { LatLng } from "@/lib/distance";
import { createLoad, updateLoad } from "@/actions/loads";
import { toActionState } from "@/lib/to-action-state";
import type { ActionResult } from "@/lib/action-helpers";
import {
  accessorialsTotal,
  parseAccessorials,
  type AccessorialItem,
} from "@/lib/accessorials";

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
  trackDeadhead?: boolean;
  deadheadMiles?: number | null;
  deadheadOrigin?: string | null;
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
  dispatchNotes: string | null;
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
  userName,
  companyName,
  enteredByUsers = [],
}: {
  initial?: LoadFormInitial;
  customers: Opt[];
  drivers: Opt[];
  trucks: Opt[];
  trailers: Opt[];
  driverAssignments?: DriverAssignment[];
  userName?: string;
  companyName?: string;
  enteredByUsers?: string[];
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
  const [customerId, setCustomerId] = useState(initial?.customerId ?? "");
  const [customerText, setCustomerText] = useState(() => {
    if (initial?.customerId) {
      return (
        customers.find((c) => c.id === initial.customerId)?.label ??
        initial.brokerName ??
        ""
      );
    }
    return initial?.brokerName ?? "";
  });
  const [price, setPrice] = useState(initial?.price ?? 0);
  const [accessorialAmount, setAccessorialAmount] = useState(
    initial?.accessorialAmount ?? 0,
  );
  const [accessorials, setAccessorials] = useState<AccessorialItem[]>(() =>
    parseAccessorials(initial?.accessorials ?? null),
  );

  // ── Miles ────────────────────────────────────────────────────────────────
  // Road miles are looked up from the pickup/delivery addresses as soon as both
  // are filled in. A number typed by hand always wins — the lookup never
  // overwrites it (and the server applies the same rule when saving).
  const formRef = useRef<HTMLFormElement>(null);
  const [miles, setMiles] = useState(
    initial?.estimatedDistanceKm != null ? String(initial.estimatedDistanceKm) : "",
  );
  const milesTouched = useRef(false);
  // What the user typed into the $/mi field, kept raw so "1.9" doesn't jump to
  // "1.90" mid-keystroke. Cleared whenever Rate, miles or accessorials change,
  // which hands the field back to the computed value.
  const [rpmDraft, setRpmDraft] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [deadhead, setDeadhead] = useState<{
    miles: number;
    origin: string | null;
  } | null>(
    initial?.deadheadMiles != null
      ? { miles: initial.deadheadMiles, origin: initial.deadheadOrigin ?? null }
      : null,
  );
  // Coordinates come back from the same lookup that gives us the miles, so the
  // trip can be drawn before the load exists in the database.
  const [trip, setTrip] = useState<{
    pickup: LatLng | null;
    delivery: LatLng | null;
    emptyFrom: LatLng | null;
  }>({ pickup: null, delivery: null, emptyFrom: null });
  // Closest truck to this pickup, offered while no driver is chosen.
  const [suggestion, setSuggestion] = useState<{
    driverId: string;
    driverName: string;
    miles: number;
    origin: string;
    from: LatLng;
  } | null>(null);
  // Off unless this load asks for it. Turning it on later still measures from
  // the driver's real last trip, not from the last load that had it on.
  const [trackDeadhead, setTrackDeadhead] = useState(
    initial?.trackDeadhead ?? false,
  );

  const loadId = initial?.id;
  const recalcMiles = useCallback(
    async ({ force = false }: { force?: boolean } = {}) => {
      const form = formRef.current;
      if (!form) return;
      const fd = new FormData(form);
      const get = (k: string) => ((fd.get(k) as string | null) ?? "").trim();

      const pickup = {
        address: get("pickupAddress"),
        city: get("pickupCity"),
        state: get("pickupState"),
        zip: get("pickupZip"),
        country: get("pickupCountry"),
      };
      const delivery = {
        address: get("deliveryAddress"),
        city: get("deliveryCity"),
        state: get("deliveryState"),
        zip: get("deliveryZip"),
        country: get("deliveryCountry"),
      };
      if (!pickup.address || !delivery.address) return;

      setCalculating(true);
      try {
        const res = await fetch("/api/loads/distance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pickup,
            delivery,
            driverId: get("driverId") || undefined,
            pickupDate: get("pickupDate") || undefined,
            excludeLoadId: loadId,
            deadhead: get("trackDeadhead") === "on",
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error ?? "Lookup failed");

        if (json.miles != null && (force || !milesTouched.current)) {
          setMiles(String(json.miles));
          setRpmDraft(null);
        } else if (json.miles == null && force) {
          toast.error("Could not find a route between these two addresses.");
        }
        setDeadhead(
          json.deadheadMiles != null
            ? { miles: json.deadheadMiles, origin: json.deadheadOrigin ?? null }
            : null,
        );
        setSuggestion(json.suggestion ?? null);
        setTrip({
          pickup: json.pickupPoint ?? null,
          delivery: json.deliveryPoint ?? null,
          emptyFrom: json.deadheadFrom ?? json.suggestion?.from ?? null,
        });
      } catch {
        if (force) toast.error("Mileage lookup failed. Enter the miles manually.");
      } finally {
        setCalculating(false);
      }
    },
    [loadId],
  );

  // Debounced auto-lookup, triggered when a location field loses focus.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRecalc = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void recalcMiles(), 400);
  }, [recalcMiles]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  // Looks up miles when the load opens without them, and again whenever the
  // driver changes — the empty run depends on who is taking the load.
  const skipFirstLookup = useRef(initial?.estimatedDistanceKm != null);
  useEffect(() => {
    if (skipFirstLookup.current) {
      skipFirstLookup.current = false;
      return;
    }
    void recalcMiles();
  }, [driverId, trackDeadhead, recalcMiles]);

  const accessorialTotal = accessorials.length
    ? accessorialsTotal(accessorials)
    : accessorialAmount;
  const totalRate = price + accessorialTotal;
  const milesNum = Number(miles);
  const ratePerMile = milesNum > 0 ? totalRate / milesNum : null;
  const totalMilesWithDeadhead = milesNum + (deadhead?.miles ?? 0);
  const allInRatePerMile =
    totalMilesWithDeadhead > 0 ? totalRate / totalMilesWithDeadhead : null;

  /**
   * $/mi is normally Total ÷ miles, but dispatchers negotiate in $/mi — so the
   * field is editable and works backwards: what you type sets the Rate for the
   * miles on the load. `rpmDraft` holds what you typed (so "1.9" doesn't jump
   * to "1.90" mid-keystroke) and is dropped once Rate or miles change, which
   * hands the field back to the computed value.
   */
  function handleRatePerMileChange(raw: string) {
    setRpmDraft(raw);
    const rpm = Number(raw);
    if (!raw || !Number.isFinite(rpm) || milesNum <= 0) return;
    const newPrice = rpm * milesNum - accessorialTotal;
    setPrice(Number(Math.max(0, newPrice).toFixed(2)));
  }

  function handleDriverChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setDriverId(id);
    if (!id) {
      setTruckId("");
      setTrailerId("");
    } else {
      const assignment = driverAssignments.find((a) => a.id === id);
      setTruckId(assignment?.truckId ?? "");
      setTrailerId(assignment?.trailerId ?? "");
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
    <form ref={formRef} action={formAction} className="grid gap-6">
      {editing && <input type="hidden" name="id" value={initial!.id} />}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── SHIPPER ── */}
        <section
          onBlur={scheduleRecalc}
          className="grid content-start gap-4 rounded-lg border bg-card p-6"
        >
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
        <section
          onBlur={scheduleRecalc}
          className="grid content-start gap-4 rounded-lg border bg-card p-6"
        >
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
              defaultValue={initial?.equipment ?? "Flatbed or Step Deck"}
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
              {enteredByUsers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
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
            {/* Hidden inputs — customerId for linked system customer, brokerName for free text */}
            <input type="hidden" name="customerId" value={customerId} />
            <input
              type="hidden"
              name="brokerName"
              value={customerId ? "" : customerText}
            />
            <input
              list="customer-datalist-form"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Search or type customer name…"
              value={
                customerId
                  ? (customers.find((c) => c.id === customerId)?.label ??
                    customerText)
                  : customerText
              }
              onChange={(e) => {
                const val = e.target.value;
                const match = customers.find((c) => c.label === val);
                if (match) {
                  setCustomerId(match.id);
                  setCustomerText(match.label);
                } else {
                  setCustomerId("");
                  setCustomerText(val);
                }
              }}
            />
            <datalist id="customer-datalist-form">
              {customers.map((c) => (
                <option key={c.id} value={c.label} />
              ))}
            </datalist>
            {customerId && (
              <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                ✓ Linked to system customer
              </p>
            )}
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
              onChange={(ev) => {
                setPrice(Number(ev.target.value));
                setRpmDraft(null);
              }}
              required
            />
          </Field>
          <Field
            name="accessorialAmount"
            label="Accessorial ($)"
            error={e.accessorialAmount}
          >
            {accessorials.length > 0 ? (
              <>
                <Input
                  id="accessorialAmount"
                  type="number"
                  value={accessorialTotal}
                  readOnly
                  disabled
                  className="bg-muted/60"
                />
                <input
                  type="hidden"
                  name="accessorialAmount"
                  value={accessorialTotal}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Sum of the {accessorials.length} accessorial
                  {accessorials.length > 1 ? "s" : ""} below.
                </p>
              </>
            ) : (
              <Input
                id="accessorialAmount"
                name="accessorialAmount"
                type="number"
                step="0.01"
                min="0"
                value={accessorialAmount}
                onChange={(ev) => setAccessorialAmount(Number(ev.target.value))}
              />
            )}
          </Field>
          <div className="flex items-center justify-between rounded border bg-muted/40 px-3 py-2">
            <span className="text-sm font-medium">Total</span>
            <span className="font-mono text-sm font-semibold">
              $
              {totalRate.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>

          <Field
            name="estimatedDistanceKm"
            label="Loaded Miles"
            error={e.estimatedDistanceKm}
          >
            <div className="flex gap-2">
              <Input
                id="estimatedDistanceKm"
                name="estimatedDistanceKm"
                type="number"
                step="any"
                min="0"
                placeholder="auto"
                value={miles}
                onChange={(ev) => {
                  milesTouched.current = true;
                  setMiles(ev.target.value);
                  setRpmDraft(null);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Recalculate miles from the pickup and delivery addresses"
                disabled={calculating}
                onClick={() => {
                  milesTouched.current = false;
                  void recalcMiles({ force: true });
                }}
              >
                {calculating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Calculated from the addresses on the map — edit to override.
            </p>
          </Field>

          <Field name="ratePerMile" label="Rate per mile ($/mi)">
            <Input
              id="ratePerMile"
              type="number"
              step="0.01"
              min="0"
              placeholder={milesNum > 0 ? "0.00" : "enter miles first"}
              disabled={milesNum <= 0}
              value={rpmDraft ?? (ratePerMile != null ? ratePerMile.toFixed(2) : "")}
              onChange={(ev) => handleRatePerMileChange(ev.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Total ÷ miles. Type a $/mi here and the Rate is worked back from
              it.
            </p>
          </Field>

          <label className="flex cursor-pointer items-start gap-2 rounded border px-3 py-2 text-sm">
            <input
              type="checkbox"
              name="trackDeadhead"
              className="mt-0.5"
              checked={trackDeadhead}
              onChange={(ev) => {
                setTrackDeadhead(ev.target.checked);
                if (!ev.target.checked) {
                  setDeadhead(null);
                  setSuggestion(null);
                  setTrip((t) => ({ ...t, emptyFrom: null }));
                }
              }}
            />
            <span>
              <span className="font-medium">Count empty miles</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Measures from this driver&apos;s last trip. Off by default; turn
                it on whenever you want — it always uses the real previous load.
              </span>
            </span>
          </label>

          {trackDeadhead && deadhead && (
            <div className="rounded border border-dashed px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Deadhead (empty)</span>
                <span className="font-mono font-semibold">
                  {deadhead.miles.toLocaleString("en-US")} mi
                </span>
              </div>
              {deadhead.origin && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  From {deadhead.origin}
                </p>
              )}
              {allInRatePerMile != null && (
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>All-in (loaded + empty)</span>
                  <span className="font-mono">
                    ${allInRatePerMile.toFixed(2)}/mi
                  </span>
                </div>
              )}
            </div>
          )}
          <input type="hidden" name="currency" value="USD" />
        </section>
      </div>

      {trip.pickup && trip.delivery && (
        <section className="grid gap-4 rounded-lg border bg-card p-6 sm:max-w-sm">
          <h3 className="font-semibold">Trip</h3>
          <LoadTripMap
            /* Remounts when the route changes — the map is built once on
               mount, so new coordinates need a new instance. */
            key={`${trip.pickup.lat},${trip.pickup.lng}-${trip.delivery.lat},${trip.delivery.lng}-${trip.emptyFrom?.lat ?? ""}`}
            token={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? null}
            emptyFrom={
              trip.emptyFrom
                ? {
                    ...trip.emptyFrom,
                    label:
                      deadhead?.origin ??
                      (suggestion
                        ? `${suggestion.driverName} · ${suggestion.origin}`
                        : "Previous delivery"),
                  }
                : null
            }
            pickup={{ ...trip.pickup, label: "Pickup" }}
            delivery={{ ...trip.delivery, label: "Delivery" }}
            emptyMiles={deadhead?.miles ?? suggestion?.miles ?? null}
            loadedMiles={milesNum > 0 ? milesNum : null}
            total={totalRate}
          />
          {/* Empty miles depend on whose truck this is. With a driver chosen
              they're exact; without one, the closest truck is offered so the
              dashed leg still means something instead of being absent. */}
          {!trackDeadhead ? (
            <p className="text-xs text-muted-foreground">
              Empty miles are off for this load — tick “Count empty miles” under
              Financials to measure the run in from the driver&apos;s last trip.
            </p>
          ) : deadhead ? (
            <p className="text-xs text-muted-foreground">
              Empty from {deadhead.origin} —{" "}
              <span className="font-medium text-foreground">
                {deadhead.miles.toLocaleString("en-US")} mi
              </span>{" "}
              before loading.
            </p>
          ) : suggestion ? (
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <p>
                Closest truck:{" "}
                <span className="font-medium text-foreground">
                  {suggestion.driverName}
                </span>{" "}
                —{" "}
                <span className="font-medium text-foreground">
                  {suggestion.miles.toLocaleString("en-US")} mi
                </span>{" "}
                empty from {suggestion.origin}.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setDriverId(suggestion.driverId);
                  const a = driverAssignments.find(
                    (x) => x.id === suggestion.driverId,
                  );
                  setTruckId(a?.truckId ?? "");
                  setTrailerId(a?.trailerId ?? "");
                }}
              >
                Assign {suggestion.driverName}
              </Button>
            </div>
          ) : driverId ? (
            <p className="text-xs text-muted-foreground">
              No earlier load for this driver, so there are no empty miles to
              show.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Pick a driver below to see the empty miles from their last
              delivery.
            </p>
          )}
        </section>
      )}

      <AccessorialsField
        items={accessorials}
        loadId={initial?.id}
        onChange={(items) => {
          setAccessorials(items);
          setRpmDraft(null);
        }}
        error={e.accessorials}
      />

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
        <Field
          name="dispatchNotes"
          label="Dispatch Notes"
          error={e.dispatchNotes}
        >
          <Textarea
            id="dispatchNotes"
            name="dispatchNotes"
            rows={2}
            defaultValue={initial?.dispatchNotes ?? ""}
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
