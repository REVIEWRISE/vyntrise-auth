import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL!,
    },
  },
});

async function main() {
  console.log('Start seeding...');

  // Create a default platform
  const platform = await prisma.platform.upsert({
    where: { name: 'Vyntrise Core' },
    update: {},
    create: {
      name: 'Vyntrise Core',
      description: 'The core Vyntrise platform',
    },
  });
  console.log(`Created platform: ${platform.name} (${platform.id})`);

  // Create a default admin user
  const hashedPassword = await bcrypt.hash('password123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'admin@vyntrise.com' },
    update: {},
    create: {
      email: 'admin@vyntrise.com',
      password: hashedPassword,
    },
  });
  console.log(`Created user: ${user.email} (${user.id})`);

  // Give user access to platform
  await prisma.userPlatformAccess.upsert({
    where: {
      userId_platformId: {
        userId: user.id,
        platformId: platform.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      platformId: platform.id,
      role: 'ADMIN',
    },
  });
  console.log('Linked admin user to Vyntrise Core platform');

  console.log('\nSeeding finished! Login with:');
  console.log('  Email:    admin@vyntrise.com');
  console.log('  Password: password123');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
