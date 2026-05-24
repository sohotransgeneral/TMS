/**
 * One-shot script to geocode all existing loads that are missing lat/lng.
 * Run with: node scripts/geocode-loads.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

if (!TOKEN) {
  console.error("Missing NEXT_PUBLIC_MAPBOX_TOKEN");
  process.exit(1);
}

async function geocode(address) {
  if (!address?.trim()) return null;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${TOKEN}&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const [lng, lat] = json.features?.[0]?.center ?? [];
    if (lng == null) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const loads = await prisma.load.findMany({
    where: {
      OR: [
        { pickupLat: null },
        { pickupLng: null },
        { deliveryLat: null },
        { deliveryLng: null },
      ],
    },
    select: {
      id: true,
      referenceNumber: true,
      pickupAddress: true,
      pickupCity: true,
      pickupCountry: true,
      pickupLat: true,
      pickupLng: true,
      deliveryAddress: true,
      deliveryCity: true,
      deliveryCountry: true,
      deliveryLat: true,
      deliveryLng: true,
    },
  });

  console.log(`Found ${loads.length} loads missing coords.`);

  let updated = 0;
  for (const load of loads) {
    const patch = {};

    if (!load.pickupLat || !load.pickupLng) {
      const addr = [load.pickupAddress, load.pickupCity, load.pickupCountry]
        .filter(Boolean)
        .join(", ");
      const geo = await geocode(addr);
      if (geo) {
        patch.pickupLat = geo.lat;
        patch.pickupLng = geo.lng;
        console.log(`  ✅ Pickup  [${load.referenceNumber}] ${addr} → ${geo.lat},${geo.lng}`);
      } else {
        console.warn(`  ⚠️  Pickup  [${load.referenceNumber}] no result for: ${addr}`);
      }
    }

    if (!load.deliveryLat || !load.deliveryLng) {
      const addr = [load.deliveryAddress, load.deliveryCity, load.deliveryCountry]
        .filter(Boolean)
        .join(", ");
      const geo = await geocode(addr);
      if (geo) {
        patch.deliveryLat = geo.lat;
        patch.deliveryLng = geo.lng;
        console.log(`  ✅ Delivery [${load.referenceNumber}] ${addr} → ${geo.lat},${geo.lng}`);
      } else {
        console.warn(`  ⚠️  Delivery [${load.referenceNumber}] no result for: ${addr}`);
      }
    }

    if (Object.keys(patch).length > 0) {
      await prisma.load.update({ where: { id: load.id }, data: patch });
      updated++;
    }

    await sleep(120); // stay under Mapbox free-tier rate limit
  }

  console.log(`\nDone. Updated ${updated}/${loads.length} loads.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
