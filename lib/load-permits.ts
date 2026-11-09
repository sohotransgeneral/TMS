/**
 * lib/load-permits.ts
 *
 * Special permits (oversize, overweight…) are bought per load, not per truck.
 * They are stored on `Load.permits` as a JSON list of line items, the same way
 * accessorials are, and `Load.permitAmount` always holds their sum.
 *
 * The permit fee comes out of what the load earned: `loadTotal` is the figure
 * before permits, `loadNetOfPermits` the one after.
 */

import { PERMIT_TYPES } from "@/lib/permit-types";

export type PermitItem = {
  /** One of PERMIT_TYPES' values. */
  type: string;
  permitNumber?: string | null;
  /** State / corridor that issued it. */
  jurisdiction?: string | null;
  /** What the permit cost. */
  cost: number;
  /** Key of the uploaded permit / receipt (private storage). */
  docUrl?: string | null;
  docName?: string | null;
};

export function permitTypeLabel(type: string): string {
  return PERMIT_TYPES.find((t) => t.value === type)?.label ?? type;
}

function text(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function toItem(raw: unknown): PermitItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const type = text(o.type);
  if (!type) return null;

  const cost = Number(o.cost);
  return {
    type,
    permitNumber: text(o.permitNumber),
    jurisdiction: text(o.jurisdiction),
    cost: Number.isFinite(cost) && cost > 0 ? cost : 0,
    docUrl: text(o.docUrl),
    docName: text(o.docName),
  };
}

/** Reads the stored JSON into line items. Never throws. */
export function parsePermits(raw: string | null | undefined): PermitItem[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.map(toItem).filter((i): i is PermitItem => i !== null);
  } catch {
    return [];
  }
}

export function serializePermits(items: PermitItem[]): string {
  return JSON.stringify(items);
}

/** Sum of all permit costs — this is what `Load.permitAmount` holds. */
export function permitsTotal(items: PermitItem[]): number {
  return items.reduce((sum, i) => sum + (Number.isFinite(i.cost) ? i.cost : 0), 0);
}

/** What a load is worth once its permits are paid for. */
export function loadNetOfPermits(
  total: number,
  load: { permitAmount?: number | null },
): number {
  return total - (load.permitAmount ?? 0);
}
