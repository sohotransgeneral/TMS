import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const loads = await p.load.findMany({ select: { referenceNumber:true, pickupAddress:true, pickupLat:true, deliveryAddress:true, deliveryLat:true }, take:10 });
console.log("Total shown:", loads.length);
console.log(JSON.stringify(loads, null, 2));
await p.$disconnect();
