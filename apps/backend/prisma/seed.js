require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcrypt');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('Start seeding...');

  const platform = await prisma.platform.upsert({
    where: { name: 'Vyntrise Core' },
    update: {},
    create: {
      name: 'Vyntrise Core',
      description: 'The core Vyntrise platform',
    },
  });
  console.log(`Platform: ${platform.name} (${platform.id})`);

  const hashedPassword = await bcrypt.hash('password123', 10);
  
  const seedUsers = [
    { email: 'admin@vyntrise.com', role: 'ADMIN' },
    { email: 'john@vyntrise.com', role: 'USER' },
    { email: 'sarah@vyntrise.com', role: 'USER' },
    { email: 'mike@vyntrise.com', role: 'USER' },
    { email: 'emily@vyntrise.com', role: 'USER' },
  ];

  for (const u of seedUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        password: hashedPassword,
      },
    });
    console.log(`User: ${user.email}`);

    await prisma.userPlatformAccess.upsert({
      where: { userId_platformId: { userId: user.id, platformId: platform.id } },
      update: { role: u.role },
      create: { userId: user.id, platformId: platform.id, role: u.role },
    });
    console.log(`Linked ${u.email} to platform with role ${u.role}`);
  }

  console.log('\nDone! Login credentials for all users:');
  console.log('  Password: password123');
  for (const u of seedUsers) {
    console.log(`  Email:    ${u.email} (${u.role})`);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
