// scripts/concurrencyDemo.ts
// Section 14, Innovation #6 — the mic-drop demo closer.
// Fires 2 simultaneous dispatch requests for the same vehicle.
// Implemented by M3 in H5-6.

async function run(): Promise<void> {
  const BASE_URL = process.env.API_URL ?? 'http://localhost:3000/api/v1';

  // TODO (M3, H5-6):
  // 1. Login as DISPATCHER, get token
  // 2. Pick a known AVAILABLE vehicle + 2 AVAILABLE drivers from seed data
  // 3. Fire Promise.all([dispatch(trip1, vehicle), dispatch(trip2, vehicle)])
  // 4. Print results — exactly one 201, one 409

  console.log(`Running concurrency demo against ${BASE_URL}`);
  console.log('TODO: implement in H5-6 (M3)');
}

run().catch(console.error);
