/**
 * lib/accessorials.ts
 *
 * A load's accessorials are stored on `Load.accessorials` as a JSON string.
 *
 * Historically that was a plain array of names (`["Detention","Lumper"]`).
 * It is now a list of line items — each with its own charge and an optional
 * supporting document (lumper receipt, detention log, scale ticket…) so anyone
 * looking at the load can tell what the extra charge was for.
 *
 * `parseAccessorials` reads both shapes, so old loads keep working.
 */

export type AccessorialItem = {
  name: string;
  amount: number;
  /** URL of the uploaded proof document (image or PDF). */
  docUrl?: string | null;
  /** Original file name, shown as the link label. */
  docName?: string | null;
};

export const ACCESSORIAL_TYPES = [
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
  "Partial",
  "Reefer",
  "Residential Delivery",
  "Residential Pickup",
  "Reweigh",
  "Scale Ticket",
  "Sorting & Segregating",
  "Stop-off",
  "TONU (Truck Order Not Used)",
  "Tanker Endorsement",
  "Tarp",
  "Team Driver",
  "Toll Charges",
  "Unloading",
  "Wait Time",
] as const;

/**
 * Matches a free-form name to the canonical spelling ("tarp" → "Tarp") so
 * names coming from AI extraction line up with the picker. Anything unknown is
 * kept as written rather than dropped — losing a charge is worse than an
 * off-list name.
 */
function canonicalName(name: string): string {
  const needle = name.trim().toLowerCase();
  const exact = ACCESSORIAL_TYPES.find((t) => t.toLowerCase() === needle);
  if (exact) return exact;
  const partial = ACCESSORIAL_TYPES.find(
    (t) => t.toLowerCase().startsWith(`${needle} `) || t.toLowerCase() === `${needle}s`,
  );
  return partial ?? name.trim();
}

function toItem(raw: unknown): AccessorialItem | null {
  // Legacy shape — just the accessorial name.
  if (typeof raw === "string") {
    const name = raw.trim();
    return name ? { name: canonicalName(name), amount: 0 } : null;
  }
  if (!raw || typeof raw !== "object") return null;

  const o = raw as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!name) return null;

  const amount = Number(o.amount);
  return {
    name: canonicalName(name),
    amount: Number.isFinite(amount) ? amount : 0,
    docUrl: typeof o.docUrl === "string" && o.docUrl ? o.docUrl : null,
    docName: typeof o.docName === "string" && o.docName ? o.docName : null,
  };
}

/** Reads a raw array (e.g. straight from AI extraction) into line items. */
export function coerceAccessorials(value: unknown): AccessorialItem[] {
  if (!Array.isArray(value)) return [];
  const items = value
    .map(toItem)
    .filter((i): i is AccessorialItem => i !== null);
  // One row per accessorial — the picker keys on the name.
  return items.filter(
    (item, i) => items.findIndex((x) => x.name === item.name) === i,
  );
}

/** Reads the stored JSON (either shape) into line items. Never throws. */
export function parseAccessorials(
  raw: string | null | undefined,
): AccessorialItem[] {
  if (!raw) return [];
  try {
    return coerceAccessorials(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function serializeAccessorials(items: AccessorialItem[]): string {
  return JSON.stringify(items);
}

/** Sum of all accessorial charges — this is what `Load.accessorialAmount` holds. */
export function accessorialsTotal(items: AccessorialItem[]): number {
  return items.reduce((sum, i) => sum + (Number.isFinite(i.amount) ? i.amount : 0), 0);
}

/**
 * What a load is worth: the rate plus its accessorials.
 *
 * The two are stored separately, so anywhere that shows a single figure for a
 * load has to add them. Showing `price` alone quietly understates every load
 * carrying a lumper, detention or tarp charge — a $6,000 load with $50 of
 * accessorials read as $6,000 on the dashboard while its own page said $6,050.
 */
export function loadTotal(load: {
  price: number | null;
  accessorialAmount?: number | null;
}): number {
  return (load.price ?? 0) + (load.accessorialAmount ?? 0);
}
