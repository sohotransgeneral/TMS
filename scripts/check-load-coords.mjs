import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const load = await p.load.findUnique({
  where: { id: "6a12c9a30ce966035442cd12" },
  select: { referenceNumber: true, pickupAddress: true, pickupLat: true, pickupLng: true, deliveryAddress: true, deliveryLat: true, deliveryLng: true, status: true },
});
console.log(JSON.stringify(load, null, 2));
await p.$disconnect();
