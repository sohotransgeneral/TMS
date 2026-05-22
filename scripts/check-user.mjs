import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

import bcrypt from 'bcryptjs';

const hash = await bcrypt.hash('Admin123!@#', 12);

const user = await prisma.user.create({
  data: {
    email: 'racustefan34@gmail.com',
    password: hash,
    name: 'Stefan Racu',
    role: 'SUPER_ADMIN',
    active: true,
  },
});
console.log('Created user:', user.id, user.email, user.role);

await prisma.$disconnect();
