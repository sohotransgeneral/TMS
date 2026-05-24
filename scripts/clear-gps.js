const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
prisma.gPSLocation
  .deleteMany({})
  .then((r) => {
    console.log("Deleted", r.count, "GPS records");
    return prisma.$disconnect();
  })
  .catch(console.error);
