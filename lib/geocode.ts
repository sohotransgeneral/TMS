/**
 * Geocodes an address string using the Mapbox Geocoding API.
 * Returns { lat, lng } or null if geocoding fails.
 * Uses NEXT_PUBLIC_MAPBOX_TOKEN (safe to use server-side too).
 */
export async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || !address.trim()) return null;

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${token}&limit=1`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const json = await res.json();
    const [lng, lat] = json.features?.[0]?.center ?? [];
    if (lng == null || lat == null) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
