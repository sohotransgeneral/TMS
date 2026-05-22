const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('Admin123!@#', 10);
  const user = await prisma.user.upsert({
    where: { email: 'racustefan34@gmail.com' },
    update: { password: hash, role: 'SUPER_ADMIN', active: true, name: 'Stefan Racu' },
    create: {
      email: 'racustefan34@gmail.com',
      name: 'Stefan Racu',
      role: 'SUPER_ADMIN',
      password: hash,
      active: true,
    },
  });
  console.log('✅ Cont creat:', user.email, '/', user.role);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
