/**
 * lib/distance.ts
 *
 * Road distance between two points, in MILES.
 *
 * The whole app stores US mileage in `Load.estimatedDistanceKm` / `actualDistanceKm`
 * (the field names are historical — driver pay, reports and the UI all read them as
 * miles), so every helper here returns miles.
 *
 * Uses the Mapbox Directions API with the same token as lib/geocode.ts.
 * Returns null when the route can't be determined — never a guess, because these
 * numbers feed driver pay and $/mile.
 */

import { geocodeAddress } from "@/lib/geocode";

export type LatLng = { lat: number; lng: number };

const METERS_PER_MILE = 1609.344;

/** Straight-line distance in miles — only used for sanity checks, never stored. */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const R = 3958.7613; // Earth radius in miles
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function isValidPoint(p: LatLng | null | undefined): p is LatLng {
  return (
    !!p &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180
  );
}

/**
 * Driving distance in miles between two coordinates.
 * Returns null if there is no token, no route, or the request fails.
 */
export async function drivingMiles(
  from: LatLng | null | undefined,
  to: LatLng | null | undefined,
): Promise<number | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || !isValidPoint(from) || !isValidPoint(to)) return null;

  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
    `?access_token=${token}&overview=false&alternatives=false&geometries=geojson`;

  try {
    const res = await fetch(url, { next: { revalidate: 86_400 } });
    if (!res.ok) return null;
    const json = await res.json();
    const meters = json?.routes?.[0]?.distance;
    if (typeof meters !== "number" || !Number.isFinite(meters)) return null;
    return Math.round(meters / METERS_PER_MILE);
  } catch {
    return null;
  }
}

/** Joins address parts the way the geocoder expects them. */
export function addressLine(parts: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
}): string {
  return [parts.address, parts.city, parts.state, parts.zip, parts.country]
    .filter(Boolean)
    .join(", ");
}

/**
 * Resolves a location to coordinates: uses the given lat/lng when present,
 * otherwise geocodes the address parts.
 */
export async function resolvePoint(loc: {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
}): Promise<LatLng | null> {
  if (loc.lat != null && loc.lng != null && isValidPoint({ lat: loc.lat, lng: loc.lng })) {
    return { lat: loc.lat, lng: loc.lng };
  }
  const line = addressLine(loc);
  if (!line) return null;
  return geocodeAddress(line);
}
