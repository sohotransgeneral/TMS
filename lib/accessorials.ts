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
  "Team Driver",
  "Toll Charges",
  "Unloading",
  "Wait Time",
] as const;

function toItem(raw: unknown): AccessorialItem | null {
  // Legacy shape — just the accessorial name.
  if (typeof raw === "string") {
    const name = raw.trim();
    return name ? { name, amount: 0 } : null;
  }
  if (!raw || typeof raw !== "object") return null;

  const o = raw as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!name) return null;

  const amount = Number(o.amount);
  return {
    name,
    amount: Number.isFinite(amount) ? amount : 0,
    docUrl: typeof o.docUrl === "string" && o.docUrl ? o.docUrl : null,
    docName: typeof o.docName === "string" && o.docName ? o.docName : null,
  };
}

/** Reads the stored JSON (either shape) into line items. Never throws. */
export function parseAccessorials(
  raw: string | null | undefined,
): AccessorialItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(toItem)
      .filter((i): i is AccessorialItem => i !== null);
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
