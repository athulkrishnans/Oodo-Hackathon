// scripts/concurrencyDemo.ts — Section 14 #6, the mic-drop closer.
// Fires 2 simultaneous dispatches for the SAME vehicle via the service layer (real interactive
// transactions + SELECT..FOR UPDATE row locks + partial unique index). Exactly one wins.
// Run: npx tsx scripts/concurrencyDemo.ts   (no HTTP server required)

import { prisma } from '../src/shared/prisma';
import { dispatchService } from '../src/modules/dispatch/service';
import { AppError } from '../src/middleware/errors';

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) throw new Error('Seed the database first (npm run db:seed).');

  // Pick an AVAILABLE, non-EV vehicle and a compatible AVAILABLE driver.
  const vehicle = await prisma.vehicle.findFirst({ where: { status: 'AVAILABLE', type: 'VAN' } });
  const driver = await prisma.driver.findFirst({
    where: { status: 'AVAILABLE', licenseCategory: 'LMV', licenseExpiryDate: { gt: new Date() } },
  });
  if (!vehicle || !driver) throw new Error('No eligible AVAILABLE VAN + LMV driver found. Re-seed.');

  console.log(`\nContenders: vehicle ${vehicle.registrationNumber} + driver ${driver.name}\n`);

  // Two DRAFT trips both targeting the same vehicle+driver.
  const mk = (n: number) =>
    dispatchService.createTrip(
      { source: 'Depot', destination: `Race ${n}`, vehicleId: vehicle.id, driverId: driver.id, cargoWeightKg: 300, plannedDistanceKm: 50 },
      admin.id,
    );
  const t1 = await mk(1);
  const t2 = await mk(2);

  // Fire both dispatches simultaneously.
  const results = await Promise.allSettled([
    dispatchService.dispatchTrip(t1.id, undefined, admin.id),
    dispatchService.dispatchTrip(t2.id, undefined, admin.id),
  ]);

  results.forEach((r, i) => {
    const code = i === 0 ? t1.code : t2.code;
    if (r.status === 'fulfilled') {
      console.log(`✅ ${code} dispatched`);
    } else {
      const e = r.reason;
      const msg = e instanceof AppError ? `${e.statusCode} ${e.code}` : String(e);
      console.log(`🛑 ${code} rejected → ${msg}`);
    }
  });

  const winners = results.filter((r) => r.status === 'fulfilled').length;
  console.log(`\nExactly one winner? ${winners === 1 ? 'YES ✅' : `NO (${winners}) ❌`}\n`);

  // Cleanup: restore vehicle/driver and remove the demo trips (avoid mutating seed state).
  await prisma.vehicle.update({ where: { id: vehicle.id }, data: { status: 'AVAILABLE' } });
  await prisma.driver.update({ where: { id: driver.id }, data: { status: 'AVAILABLE' } });
  await prisma.auditLog.deleteMany({ where: { entity: 'Trip', entityId: { in: [t1.id, t2.id] } } });
  await prisma.trip.deleteMany({ where: { id: { in: [t1.id, t2.id] } } });
  console.log('Cleanup done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
