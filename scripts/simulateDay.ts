// scripts/simulateDay.ts — Section 14 #4, CLI entry to the live demo sequence.
// Runs the same runSimulateDay() used by the admin UI button. Run: npx tsx scripts/simulateDay.ts

import { prisma } from '../src/shared/prisma';
import { runSimulateDay } from '../src/jobs/simulateDay';

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) throw new Error('Seed the database first (npm run db:seed).');
  console.log('Running Simulate Day…\n');
  const result = await runSimulateDay(admin.id);
  result.steps.forEach((s) => console.log(' •', s));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
