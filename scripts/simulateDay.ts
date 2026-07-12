// scripts/simulateDay.ts
// Section 14, Innovation #4 — Simulate Day live demo mode.
// Also triggered by the "Simulate Day" button in the Admin UI (gated by simulate_day_enabled setting).
// Scripted sequence with 1-second delays so KPIs visibly tick during the demo.
// Implemented by M1 in H5-6.

async function run(): Promise<void> {
  const BASE_URL = process.env.API_URL ?? 'http://localhost:3000/api/v1';

  // TODO (M1, H5-6):
  // Step 1: Dispatch trip A (vehicle-01 + driver-01)                 — wait 1s
  // Step 2: Dispatch trip B (vehicle-02 + driver-02)                 — wait 1s
  // Step 3: Complete trip A with fuel=58L (the planted anomaly)       — wait 1s
  //           → FuelLog created, anomaly flag fires, notification sent
  // Step 4: Open maintenance on vehicle-03                           — wait 1s
  //           → vehicle goes IN_SHOP, KPI "In Maintenance" ticks up
  // Each step logs to console with timestamp so demo audience can see it live.

  console.log(`Simulate Day against ${BASE_URL}`);
  console.log('TODO: implement in H5-6 (M1)');
}

run().catch(console.error);
