// prisma/seed.ts — stub for Section 15 seed data
// Full implementation in H1–2 by M1.
// Run: tsx prisma/seed.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seed stub — full seed data will be added in H1-2 (Section 15).');
  // TODO: seed users, vehicles, drivers, emission factors, settings, trips, fuel logs, expenses
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
