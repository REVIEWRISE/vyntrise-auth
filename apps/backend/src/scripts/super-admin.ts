// Grants, revokes and lists super-admins. This script is deliberately the ONLY way to change
// User.isSuperAdmin: there is no API for it, so a stolen admin session can never escalate
// itself. Run it with shell access to the server:
//
//   npm run super-admin -- grant someone@example.com      (development, via ts-node)
//   node dist/scripts/super-admin.js list                 (production image)
import prisma from '../db/prisma';
import { logActivity } from '../services/audit.service';

const USAGE = 'Usage: super-admin <grant|revoke> <email>  |  super-admin list';

async function main() {
  const [command, rawEmail] = process.argv.slice(2);

  if (command === 'list') {
    const admins = await prisma.user.findMany({
      where: { isSuperAdmin: true },
      select: { email: true, createdAt: true, disabledAt: true },
      orderBy: { email: 'asc' },
    });
    if (admins.length === 0) {
      console.log('No super-admins.');
      return;
    }
    for (const a of admins) {
      console.log(`${a.email}${a.disabledAt ? '  (disabled)' : ''}`);
    }
    return;
  }

  if ((command !== 'grant' && command !== 'revoke') || !rawEmail) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  const email = rawEmail.trim();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No account with email ${email}. The user must register first.`);
    process.exitCode = 1;
    return;
  }

  const grant = command === 'grant';
  if (user.isSuperAdmin === grant) {
    console.log(`${email} is already ${grant ? 'a super-admin' : 'not a super-admin'}. Nothing to do.`);
    return;
  }

  if (!grant) {
    const remaining = await prisma.user.count({
      where: { isSuperAdmin: true, disabledAt: null, id: { not: user.id } },
    });
    if (remaining === 0) {
      console.error('Refusing to revoke the last active super-admin. Grant another one first.');
      process.exitCode = 1;
      return;
    }
  }

  await prisma.user.update({ where: { id: user.id }, data: { isSuperAdmin: grant } });

  await logActivity({
    action: grant ? 'SUPER_ADMIN_GRANTED' : 'SUPER_ADMIN_REVOKED',
    actorId: null,
    targetType: 'user',
    targetId: user.id,
    metadata: { email, via: 'cli' },
  });

  console.log(`${grant ? 'Granted' : 'Revoked'} super-admin for ${email}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
