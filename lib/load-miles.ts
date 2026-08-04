/**
 * lib/load-miles.ts
 *
 * Mileage for a load:
 *  - loaded miles   — pickup → delivery (stored in `estimatedDistanceKm`, in miles)
 *  - deadhead miles — where the driver's previous load dropped → this pickup,
 *                     i.e. how far the truck runs empty to get to this load
 */

import { prisma } from "@/lib/prisma";
import { drivingMiles, resolvePoint, type LatLng } from "@/lib/distance";

export type LocationParts = {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
};

export type DeadheadResult = {
  miles: number;
  /** Human label for where the empty run starts, e.g. "Dallas, TX · L-2026-00012" */
  origin: string;
};

/** Loaded miles between two locations, geocoding them first when needed. */
export async function loadedMiles(
  pickup: LocationParts,
  delivery: LocationParts,
): Promise<number | null> {
  const [from, to] = await Promise.all([
    resolvePoint(pickup),
    resolvePoint(delivery),
  ]);
  return drivingMiles(from, to);
}

/**
 * Empty miles the driver runs to reach this pickup: measured from the delivery
 * of their most recent load that drops off before this one loads.
 *
 * Returns null when there is no previous load, or when either end can't be
 * located — callers should clear the stored value rather than keep a stale one.
 */
export async function computeDeadhead(args: {
  companyId: string;
  driverId: string;
  pickup: LocationParts | LatLng | null;
  pickupDate: Date;
  /** The load being saved, so it never measures against itself. */
  excludeLoadId?: string;
}): Promise<DeadheadResult | null> {
  const { companyId, driverId, pickupDate, excludeLoadId } = args;
  if (!driverId || !args.pickup) return null;

  const previous = await prisma.load.findFirst({
    where: {
      companyId,
      driverId,
      status: { not: "CANCELLED" },
      deliveryDate: { lte: pickupDate },
      ...(excludeLoadId ? { id: { not: excludeLoadId } } : {}),
    },
    orderBy: { deliveryDate: "desc" },
    select: {
      referenceNumber: true,
      deliveryAddress: true,
      deliveryCity: true,
      deliveryState: true,
      deliveryZip: true,
      deliveryCountry: true,
      deliveryLat: true,
      deliveryLng: true,
    },
  });
  if (!previous) return null;

  const [from, to] = await Promise.all([
    resolvePoint({
      lat: previous.deliveryLat,
      lng: previous.deliveryLng,
      address: previous.deliveryAddress,
      city: previous.deliveryCity,
      state: previous.deliveryState,
      zip: previous.deliveryZip,
      country: previous.deliveryCountry,
    }),
    resolvePoint(args.pickup as LocationParts),
  ]);

  const miles = await drivingMiles(from, to);
  if (miles == null) return null;

  const place = [previous.deliveryCity, previous.deliveryState]
    .filter(Boolean)
    .join(", ");
  return {
    miles,
    origin: [place, previous.referenceNumber].filter(Boolean).join(" · "),
  };
}

/** Rate per mile — total pay (rate + accessorials) divided by loaded miles. */
export function ratePerMile(
  total: number | null | undefined,
  miles: number | null | undefined,
): number | null {
  if (!total || !miles || miles <= 0) return null;
  return total / miles;
}
