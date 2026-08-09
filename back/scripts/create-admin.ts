import 'dotenv/config';
import bcryptjs from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email) {
    console.error('ADMIN_EMAIL est requis (variable d\'environnement).');
    process.exitCode = 1;
    return;
  }
  if (!password || password.length < 8) {
    console.error(
      'ADMIN_PASSWORD est requis et doit contenir au moins 8 caracteres.',
    );
    process.exitCode = 1;
    return;
  }

  const connectionString =
    process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const passwordHash = await bcryptjs.hash(password, 12);

    const admin = await prisma.utilisateur.upsert({
      where: { email },
      update: { passwordHash, role: 'admin' },
      create: { email, passwordHash, role: 'admin' },
    });

    console.log(`Compte admin pret : ${admin.email} (id: ${admin.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    'Echec de la creation du compte admin :',
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
