import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const since = new Date(Date.now() - 30 * 60 * 1000);
const pings = await p.gPSLocation.findMany({
  where: { recordedAt: { gte: since } },
  select: { driverId: true, loadId: true, lat: true, lng: true, recordedAt: true },
  orderBy: { recordedAt: "desc" },
  take: 20,
});
console.log("Recent GPS pings (last 30min):", pings.length);
console.log(JSON.stringify(pings, null, 2));

// Also check if any GPS exist at all
const total = await p.gPSLocation.count();
console.log("\nTotal GPS records:", total);
const latest = await p.gPSLocation.findMany({ orderBy: { recordedAt: "desc" }, take: 5, select: { driverId: true, loadId: true, lat: true, lng: true, recordedAt: true } });
console.log("Latest 5:", JSON.stringify(latest, null, 2));

await p.$disconnect();
