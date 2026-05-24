/**
 * Fix the active driver's load to use European addresses
 * so the route shows up near Moldova on the dispatch map.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

async function geocode(address) {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${TOKEN}&limit=1`;
  const res = await fetch(url);
  const json = await res.json();
  const [lng, lat] = json.features?.[0]?.center ?? [];
  return lat != null ? { lat, lng } : null;
}

async function main() {
  // The load currently assigned to the active driver
  const loadId = "6a12c9a30ce966035442cd12";

  const pickup = await geocode("Chișinău, Moldova");
  const delivery = await geocode("București, România");

  if (!pickup || !delivery) {
    console.error("Geocoding failed"); process.exit(1);
  }

  console.log("Pickup (Chișinău):", pickup);
  console.log("Delivery (București):", delivery);

  await prisma.load.update({
    where: { id: loadId },
    data: {
      pickupAddress: "Str. Armenească 38, Chișinău, Moldova",
      pickupCity: "Chișinău",
      pickupCountry: "MD",
      pickupLat: pickup.lat,
      pickupLng: pickup.lng,
      deliveryAddress: "Calea Griviței 120, București, România",
      deliveryCity: "București",
      deliveryCountry: "RO",
      deliveryLat: delivery.lat,
      deliveryLng: delivery.lng,
    },
  });

  console.log("✅ Load updated with European addresses.");
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
