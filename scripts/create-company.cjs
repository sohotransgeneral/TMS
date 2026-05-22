const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.company.findFirst();
  if (existing) {
    console.log('✅ Companie deja existentă:', existing.name, '/', existing.id);
    return;
  }
  const c = await prisma.company.create({
    data: {
      name: 'Energreen Battery SRL',
      taxId: 'RO12345678',
      registrationNumber: 'J40/1234/2020',
      street: 'Str. Exemplu nr. 1',
      city: 'București',
      country: 'RO',
      currency: 'USD',
      vatRate: 19,
      invoicePrefix: 'INV',
      timezone: 'Europe/Bucharest',
      locale: 'ro-RO',
    },
  });
  console.log('✅ Companie creată:', c.name, '/', c.id);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
