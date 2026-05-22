import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Delete in reverse dependency order
await prisma.mapZonePin.deleteMany({});
await prisma.gPSLocation.deleteMany({});
await prisma.fuelEntry.deleteMany({});
await prisma.expense.deleteMany({});
await prisma.maintenance.deleteMany({});
await prisma.payment.deleteMany({});
await prisma.invoice.deleteMany({});
await prisma.loadStatusHistory.deleteMany({});
await prisma.load.deleteMany({});
await prisma.customer.deleteMany({});
await prisma.driverProfile.deleteMany({});
await prisma.truck.deleteMany({});
await prisma.trailer.deleteMany({});
await prisma.user.deleteMany({ where: { email: { not: "racustefan34@gmail.com" } } });
await prisma.company.deleteMany({ where: { id: "000000000000000000000001" } });

console.log("✅ Cleared all seed data");
await prisma.$disconnect();
