/**
 * lib/load-miles.ts
 *
 * Mileage for a load:
 *  - loaded miles   — pickup → delivery (stored in `estimatedDistanceKm`, in miles)
 *  - deadhead miles — where the driver's previous load dropped → this pickup,
 *                     i.e. how far the truck runs empty to get to this load
 */

import { prisma } from "@/lib/prisma";
import {
  drivingMiles,
  haversineMiles,
  resolvePoint,
  type LatLng,
} from "@/lib/distance";

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
  /** Where the previous load dropped — used to draw the empty leg on the map. */
  from: LatLng;
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

  // The previous trip is the one that STARTED most recently before this one —
  // its delivery point is where the truck stands empty.
  //
  // Selecting on delivery date instead looks right but isn't: dispatchers book
  // the next load while the current one is still running, so the real previous
  // load often delivers AFTER this pickup date. Filtering those out silently
  // skipped back to some much older load — a truck that dropped in PA and
  // reloads in MD (~150 mi) was being measured from a weeks-old delivery in
  // Lamont, CA (2,654 mi).
  //
  // The secondary sorts matter too: two loads starting the same day would
  // otherwise come back in whatever order the database felt like.
  const previous = await prisma.load.findFirst({
    where: {
      companyId,
      driverId,
      status: { not: "CANCELLED" },
      pickupDate: { lt: pickupDate },
      ...(excludeLoadId ? { id: { not: excludeLoadId } } : {}),
    },
    // Reference number is the last word rather than updatedAt: it follows the
    // order loads were created, so when two loads share a pickup date (usual
    // when only dates are entered, no times) the newer one wins. Sorting by
    // updatedAt would instead promote whichever old load was edited last.
    orderBy: [
      { pickupDate: "desc" },
      { deliveryDate: "desc" },
      { referenceNumber: "desc" },
    ],
    select: {
      referenceNumber: true,
      deliveryDate: true,
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
  if (miles == null || !from) return null;

  const place = [previous.deliveryCity, previous.deliveryState]
    .filter(Boolean)
    .join(", ");
  // The reference and the drop date are part of the label on purpose: they let
  // a dispatcher confirm at a glance that this really is the previous trip.
  const dropped = previous.deliveryDate
    ? previous.deliveryDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : null;
  return {
    miles,
    origin: [place, previous.referenceNumber, dropped]
      .filter(Boolean)
      .join(" · "),
    from,
  };
}

export type TruckSuggestion = {
  driverId: string;
  driverName: string;
  miles: number;
  origin: string;
  from: LatLng;
};

/**
 * Which truck is closest to this pickup, based on where each driver last
 * dropped. Answers the question a dispatcher actually has before assigning —
 * "who is nearby?" — and lets the empty leg be drawn before a driver is chosen.
 *
 * Only the best candidate gets a Directions call: everyone else is ranked by
 * straight-line distance, which is free and plenty for ordering.
 */
export async function suggestNearestTruck(args: {
  companyId: string;
  pickup: LatLng;
  pickupDate: Date;
  excludeLoadId?: string;
}): Promise<TruckSuggestion | null> {
  const { companyId, pickup, pickupDate, excludeLoadId } = args;

  const recent = await prisma.load.findMany({
    where: {
      companyId,
      driverId: { not: null },
      status: { not: "CANCELLED" },
      pickupDate: { lt: pickupDate },
      ...(excludeLoadId ? { id: { not: excludeLoadId } } : {}),
    },
    orderBy: [{ pickupDate: "desc" }, { referenceNumber: "desc" }],
    take: 200,
    select: {
      driverId: true,
      referenceNumber: true,
      deliveryDate: true,
      deliveryCity: true,
      deliveryState: true,
      deliveryLat: true,
      deliveryLng: true,
    },
  });

  // First entry per driver is that driver's latest trip — the list is already
  // in the same order computeDeadhead uses, so the two always agree.
  const latestPerDriver = new Map<string, (typeof recent)[number]>();
  for (const load of recent) {
    if (load.driverId && !latestPerDriver.has(load.driverId)) {
      latestPerDriver.set(load.driverId, load);
    }
  }

  const candidates = [...latestPerDriver.values()]
    .filter((l) => l.deliveryLat != null && l.deliveryLng != null)
    .map((l) => ({
      load: l,
      crow: haversineMiles(
        { lat: l.deliveryLat!, lng: l.deliveryLng! },
        pickup,
      ),
    }))
    .sort((a, b) => a.crow - b.crow);

  const best = candidates[0];
  if (!best) return null;

  const from = { lat: best.load.deliveryLat!, lng: best.load.deliveryLng! };
  const miles = await drivingMiles(from, pickup);
  if (miles == null) return null;

  const driver = await prisma.driverProfile.findUnique({
    where: { id: best.load.driverId! },
    select: { firstName: true, lastName: true, user: { select: { name: true } } },
  });
  if (!driver) return null;

  const place = [best.load.deliveryCity, best.load.deliveryState]
    .filter(Boolean)
    .join(", ");
  const dropped = best.load.deliveryDate
    ? best.load.deliveryDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : null;

  return {
    driverId: best.load.driverId!,
    driverName:
      driver.user?.name ?? `${driver.firstName} ${driver.lastName}`.trim(),
    miles,
    origin: [place, best.load.referenceNumber, dropped]
      .filter(Boolean)
      .join(" · "),
    from,
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
