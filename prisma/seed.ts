// prisma/seed.ts — Section 15 demo data. Idempotent: wipes then re-inserts deterministically.
// Run: npm run db:seed  (tsx prisma/seed.ts)

import { PrismaClient, Prisma, FuelType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const FACTOR: Record<FuelType, number> = { DIESEL: 2.68, PETROL: 2.31, CNG: 2.02, EV: 0 };
const FUEL_PRICE = 100; // per litre, for cost figures
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5);
const daysAhead = (n: number) => new Date(Date.now() + n * 864e5);

async function wipe() {
  // FK-safe deletion order.
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.fuelLog.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.maintenanceLog.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.emissionFactor.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  console.log('Seeding TransitOps demo data…');
  await wipe();

  // ── Settings (Section 4 defaults) ──
  const settings: Record<string, unknown> = {
    anomaly_deviation_threshold: 0.2,
    anomaly_min_history: 3,
    license_warning_days: [30, 60, 90],
    dispatch_weight_capacity: 35,
    dispatch_weight_fuel: 30,
    dispatch_weight_maintenance: 20,
    dispatch_weight_safety: 15,
    default_service_interval_km: 10000,
    simulate_day_enabled: true,
  };
  await prisma.setting.createMany({
    data: Object.entries(settings).map(([key, value]) => ({ key, value: JSON.stringify(value) })),
  });

  // ── Emission factors (DEFRA 2024) ──
  await prisma.emissionFactor.createMany({
    data: (['DIESEL', 'PETROL', 'CNG', 'EV'] as FuelType[]).map((f) => ({
      fuelType: f,
      kgCo2PerLiter: FACTOR[f],
      source: 'DEFRA 2024',
    })),
  });

  // ── Users: 1 per role + 1 pending ──
  const passwordHash = await bcrypt.hash('password123', 10);
  const users = await Promise.all(
    [
      { email: 'admin@transitops.dev', name: 'Ada Admin', role: 'ADMIN' as const },
      { email: 'fleet@transitops.dev', name: 'Frank Fleet', role: 'FLEET_MANAGER' as const },
      { email: 'dispatcher@transitops.dev', name: 'Dana Dispatch', role: 'DISPATCHER' as const },
      { email: 'safety@transitops.dev', name: 'Sam Safety', role: 'SAFETY_OFFICER' as const },
      { email: 'finance@transitops.dev', name: 'Fiona Finance', role: 'FINANCIAL_ANALYST' as const },
      { email: 'pending@transitops.dev', name: 'Pat Pending', role: null },
    ].map((u) => prisma.user.create({ data: { ...u, passwordHash, status: 'ACTIVE' } })),
  );
  const admin = users[0];

  // ── Vehicles (12): 1 RETIRED, 2 IN_SHOP, 1 EV, 1 near-service, 2 ON_TRIP ──
  type VSeed = Prisma.VehicleCreateManyInput & { key: string };
  const vSeeds: VSeed[] = [
    { key: 'TRK-001', registrationNumber: 'TRK-001', name: 'Atlas Hauler', model: 'Tata Prima', type: 'TRUCK', fuelType: 'DIESEL', maxLoadCapacityKg: 15000, odometerKm: 82000, acquisitionCost: 85000, region: 'North', status: 'ON_TRIP', avgKmPerLiter: 4.6, kmSinceLastServiceKm: 3200, serviceIntervalKm: 12000 },
    { key: 'TRK-OLD', registrationNumber: 'TRK-OLD-99', name: 'Old Warhorse', model: 'Ashok Leyland', type: 'TRUCK', fuelType: 'DIESEL', maxLoadCapacityKg: 12000, odometerKm: 410000, acquisitionCost: 70000, region: 'South', status: 'RETIRED', avgKmPerLiter: 3.8, kmSinceLastServiceKm: 0 },
    { key: 'VAN-01', registrationNumber: 'VAN-01', name: 'City Runner', model: 'Force Traveller', type: 'VAN', fuelType: 'PETROL', maxLoadCapacityKg: 1500, odometerKm: 54000, acquisitionCost: 42000, region: 'North', status: 'AVAILABLE', avgKmPerLiter: 9.2, kmSinceLastServiceKm: 4100 },
    { key: 'VAN-02', registrationNumber: 'VAN-02', name: 'Metro Mover', model: 'Maruti Eeco', type: 'VAN', fuelType: 'PETROL', maxLoadCapacityKg: 1200, odometerKm: 39000, acquisitionCost: 40000, region: 'East', status: 'ON_TRIP', avgKmPerLiter: 10.1, kmSinceLastServiceKm: 2600 },
    { key: 'VAN-03', registrationNumber: 'VAN-03', name: 'Cargo Express', model: 'Mahindra Supro', type: 'VAN', fuelType: 'DIESEL', maxLoadCapacityKg: 1400, odometerKm: 61000, acquisitionCost: 45000, region: 'West', status: 'AVAILABLE', avgKmPerLiter: 10.0, kmSinceLastServiceKm: 5200 },
    { key: 'PKP-01', registrationNumber: 'PKP-01', name: 'Trail Boss', model: 'Isuzu D-Max', type: 'PICKUP', fuelType: 'DIESEL', maxLoadCapacityKg: 1000, odometerKm: 28000, acquisitionCost: 35000, region: 'South', status: 'AVAILABLE', avgKmPerLiter: 8.4, kmSinceLastServiceKm: 1900 },
    { key: 'BIKE-01', registrationNumber: 'BIKE-01', name: 'Swift Courier', model: 'Hero Xtreme', type: 'BIKE', fuelType: 'PETROL', maxLoadCapacityKg: 40, odometerKm: 17000, acquisitionCost: 8000, region: 'North', status: 'AVAILABLE', avgKmPerLiter: 38, kmSinceLastServiceKm: 900 },
    { key: 'BUS-01', registrationNumber: 'BUS-01', name: 'Transit Liner', model: 'Tata Starbus', type: 'BUS', fuelType: 'DIESEL', maxLoadCapacityKg: 6000, odometerKm: 145000, acquisitionCost: 120000, region: 'Central', status: 'AVAILABLE', avgKmPerLiter: 3.5, kmSinceLastServiceKm: 9800, serviceIntervalKm: 10000 },
    { key: 'CNG-01', registrationNumber: 'CNG-01', name: 'Eco Shuttle', model: 'Maruti Super Carry', type: 'VAN', fuelType: 'CNG', maxLoadCapacityKg: 1000, odometerKm: 33000, acquisitionCost: 43000, region: 'East', status: 'AVAILABLE', avgKmPerLiter: 12.5, kmSinceLastServiceKm: 3000 },
    { key: 'EV-01', registrationNumber: 'EV-01', name: 'Volt Carrier', model: 'Tata Ace EV', type: 'PICKUP', fuelType: 'EV', maxLoadCapacityKg: 600, odometerKm: 12000, acquisitionCost: 60000, region: 'North', status: 'AVAILABLE', avgKmPerLiter: null, kmSinceLastServiceKm: 2000 },
    { key: 'TRK-003', registrationNumber: 'TRK-003', name: 'Iron Duke', model: 'BharatBenz', type: 'TRUCK', fuelType: 'DIESEL', maxLoadCapacityKg: 16000, odometerKm: 98000, acquisitionCost: 90000, region: 'South', status: 'IN_SHOP', avgKmPerLiter: 4.2, kmSinceLastServiceKm: 7000 },
    { key: 'VAN-04', registrationNumber: 'VAN-04', name: 'Parcel Pro', model: 'Force Urbania', type: 'VAN', fuelType: 'PETROL', maxLoadCapacityKg: 1300, odometerKm: 47000, acquisitionCost: 41000, region: 'West', status: 'IN_SHOP', avgKmPerLiter: 8.8, kmSinceLastServiceKm: 6100 },
  ];
  const vehicles: Record<string, { id: string; fuelType: FuelType; odometerKm: number; avgKmPerLiter: number | null }> = {};
  for (const { key, ...data } of vSeeds) {
    const v = await prisma.vehicle.create({ data });
    vehicles[key] = { id: v.id, fuelType: v.fuelType, odometerKm: v.odometerKm, avgKmPerLiter: v.avgKmPerLiter };
  }

  // ── Drivers (10): incl expired, suspended, expiring-in-12-days ──
  type DSeed = Prisma.DriverCreateManyInput & { key: string };
  const dSeeds: DSeed[] = [
    { key: 'D_RAJESH', name: 'Rajesh Kumar', licenseNumber: 'DL-HMV-1001', licenseCategory: 'HMV', licenseExpiryDate: daysAhead(400), contactNumber: '9000000001', safetyScore: 88, status: 'ON_TRIP' },
    { key: 'D_AMIT', name: 'Amit Sharma', licenseNumber: 'DL-LMV-1002', licenseCategory: 'LMV', licenseExpiryDate: daysAhead(300), contactNumber: '9000000002', safetyScore: 76, status: 'ON_TRIP' },
    { key: 'D_SURESH', name: 'Suresh Rao', licenseNumber: 'DL-HMV-1003', licenseCategory: 'HMV', licenseExpiryDate: daysAhead(500), contactNumber: '9000000003', safetyScore: 95, status: 'AVAILABLE' },
    { key: 'D_VIKRAM', name: 'Vikram Singh', licenseNumber: 'DL-TRANS-1004', licenseCategory: 'TRANS', licenseExpiryDate: daysAhead(220), contactNumber: '9000000004', safetyScore: 82, status: 'AVAILABLE' },
    { key: 'D_DEEPAK', name: 'Deepak Nair', licenseNumber: 'DL-LMV-1005', licenseCategory: 'LMV', licenseExpiryDate: daysAhead(150), contactNumber: '9000000005', safetyScore: 90, status: 'AVAILABLE' },
    { key: 'D_MANOJ', name: 'Manoj Gupta', licenseNumber: 'DL-LMV-1006', licenseCategory: 'LMV', licenseExpiryDate: daysAhead(75), contactNumber: '9000000006', safetyScore: 68, status: 'AVAILABLE' },
    { key: 'D_RAVI', name: 'Ravi Verma', licenseNumber: 'DL-HMV-1007', licenseCategory: 'HMV', licenseExpiryDate: daysAhead(180), contactNumber: '9000000007', safetyScore: 55, status: 'SUSPENDED' },
    { key: 'D_KIRAN', name: 'Kiran Bose', licenseNumber: 'DL-LMV-1008', licenseCategory: 'LMV', licenseExpiryDate: daysAhead(12), contactNumber: '9000000008', safetyScore: 72, status: 'AVAILABLE' },
    { key: 'D_SANJAY', name: 'Sanjay Iyer', licenseNumber: 'DL-HMV-1009', licenseCategory: 'HMV', licenseExpiryDate: daysAgo(20), contactNumber: '9000000009', safetyScore: 60, status: 'AVAILABLE' },
    { key: 'D_ARJUN', name: 'Arjun Mehta', licenseNumber: 'DL-LMV-1010', licenseCategory: 'LMV', licenseExpiryDate: daysAhead(600), contactNumber: '9000000010', safetyScore: 98, status: 'AVAILABLE' },
  ];
  const drivers: Record<string, string> = {};
  for (const { key, ...data } of dSeeds) {
    const d = await prisma.driver.create({ data });
    drivers[key] = d.id;
  }

  // ── Trips ──
  let seq = 0;
  const nextCode = () => `TR-2026-${String(++seq).padStart(4, '0')}`;

  // Completed-trip generator with matching fuel logs.
  const historyPlan: Array<{ veh: string; drv: string; daysAgo: number; distance: number; revenue: number; anomaly?: boolean }> = [];
  const histVehicles = ['TRK-001', 'VAN-01', 'VAN-02', 'VAN-03', 'PKP-01', 'BIKE-01', 'BUS-01', 'CNG-01', 'EV-01', 'TRK-003'];
  const histDrivers = ['D_RAJESH', 'D_AMIT', 'D_SURESH', 'D_VIKRAM', 'D_DEEPAK', 'D_ARJUN'];
  let d = 88;
  for (let i = 0; i < 26; i++) {
    const veh = histVehicles[i % histVehicles.length];
    const drv = histDrivers[i % histDrivers.length];
    const distance = 120 + ((i * 37) % 380);
    const revenue = 4000 + ((i * 613) % 9000);
    historyPlan.push({ veh, drv, daysAgo: d, distance, revenue });
    d -= 3;
    if (d < 2) d = 88;
  }
  // Planted anomaly: a VAN-03 completed trip, distance 400 (expected 40 L), logged 58 L (+45%).
  historyPlan.push({ veh: 'VAN-03', drv: 'D_SURESH', daysAgo: 5, distance: 400, revenue: 8000, anomaly: true });

  for (const p of historyPlan) {
    const v = vehicles[p.veh];
    const isEv = v.fuelType === 'EV';
    const start = Math.max(0, v.odometerKm - 5000 - Math.round(Math.random() * 3000));
    const end = start + p.distance;
    let fuelUsedL: number | null = null;
    let co2Kg: number | null = null;
    if (isEv) {
      co2Kg = 0;
    } else {
      const avg = v.avgKmPerLiter ?? 8;
      fuelUsedL = p.anomaly ? 58 : Math.round((p.distance / avg) * 10) / 10;
      co2Kg = Math.round(fuelUsedL * FACTOR[v.fuelType] * 10) / 10;
    }
    const completedAt = daysAgo(p.daysAgo);
    const trip = await prisma.trip.create({
      data: {
        code: nextCode(), source: 'Depot', destination: `Site ${p.veh}`,
        vehicleId: v.id, driverId: drivers[p.drv],
        cargoWeightKg: 300, plannedDistanceKm: p.distance, revenue: p.revenue,
        status: 'COMPLETED', dispatchedAt: daysAgo(p.daysAgo + 1), completedAt,
        startOdometerKm: start, endOdometerKm: end, actualDistanceKm: p.distance,
        fuelUsedL, co2Kg,
      },
    });
    if (fuelUsedL != null) {
      const expected = p.anomaly ? 40 : fuelUsedL; // planted: expected 40 vs logged 58
      const deviationPct = expected > 0 ? (fuelUsedL - expected) / expected : 0;
      await prisma.fuelLog.create({
        data: {
          vehicleId: v.id, tripId: trip.id, liters: fuelUsedL, cost: Math.round(fuelUsedL * FUEL_PRICE),
          date: completedAt, expectedLiters: expected, deviationPct,
          isAnomaly: p.anomaly === true,
        },
      });
    }
  }

  // 2 DISPATCHED trips (vehicles + drivers already ON_TRIP).
  await prisma.trip.create({
    data: {
      code: nextCode(), source: 'Depot North', destination: 'Warehouse 7', vehicleId: vehicles['TRK-001'].id, driverId: drivers['D_RAJESH'],
      cargoWeightKg: 8000, plannedDistanceKm: 260, revenue: 15000, status: 'DISPATCHED',
      dispatchedAt: daysAgo(0), startOdometerKm: vehicles['TRK-001'].odometerKm,
    },
  });
  await prisma.trip.create({
    data: {
      code: nextCode(), source: 'Depot East', destination: 'Mall Delivery', vehicleId: vehicles['VAN-02'].id, driverId: drivers['D_AMIT'],
      cargoWeightKg: 800, plannedDistanceKm: 45, revenue: 3000, status: 'DISPATCHED',
      dispatchedAt: daysAgo(0), startOdometerKm: vehicles['VAN-02'].odometerKm,
    },
  });

  // 2 DRAFT trips.
  await prisma.trip.create({
    data: { code: nextCode(), source: 'Depot South', destination: 'Port', vehicleId: vehicles['PKP-01'].id, driverId: drivers['D_DEEPAK'], cargoWeightKg: 700, plannedDistanceKm: 120, revenue: 5000, status: 'DRAFT' },
  });
  await prisma.trip.create({
    data: { code: nextCode(), source: 'Depot East', destination: 'Airport', vehicleId: vehicles['CNG-01'].id, driverId: drivers['D_ARJUN'], cargoWeightKg: 500, plannedDistanceKm: 90, revenue: 4200, status: 'DRAFT' },
  });

  // ── Maintenance: open logs for the 2 IN_SHOP vehicles + closed history ──
  await prisma.maintenanceLog.create({
    data: { vehicleId: vehicles['TRK-003'].id, type: 'REPAIR', description: 'Gearbox overhaul', cost: 45000, status: 'OPEN', openedAt: daysAgo(2) },
  });
  await prisma.maintenanceLog.create({
    data: { vehicleId: vehicles['VAN-04'].id, type: 'SERVICE', description: 'Scheduled 45k service', cost: 8000, status: 'OPEN', openedAt: daysAgo(1) },
  });
  for (const [veh, cost, day] of [['TRK-001', 12000, 40], ['VAN-01', 4500, 30], ['BUS-01', 22000, 55], ['CNG-01', 3800, 20]] as const) {
    await prisma.maintenanceLog.create({
      data: { vehicleId: vehicles[veh].id, type: 'SERVICE', description: 'Routine service', cost, status: 'CLOSED', openedAt: daysAgo(day + 1), closedAt: daysAgo(day) },
    });
  }

  // ── Expenses ──
  for (const [veh, type, amount, day] of [
    ['TRK-001', 'TOLL', 850, 12], ['VAN-01', 'PARKING', 200, 8], ['VAN-03', 'FINE', 1500, 6],
    ['BUS-01', 'TOLL', 1200, 15], ['PKP-01', 'OTHER', 600, 3],
  ] as const) {
    await prisma.expense.create({
      data: { vehicleId: vehicles[veh].id, type, amount, date: daysAgo(day), notes: `${type} charge` },
    });
  }

  // ── A couple of seeded notifications for the admin bell ──
  await prisma.notification.create({
    data: { userId: admin.id, type: 'FUEL_ANOMALY', message: 'Planted demo anomaly on VAN-03 (58 L vs 40 L expected).' },
  });

  // ── Seeded audit trail so the Audit Log viewer + activity feed are alive on first load ──
  const [, fleetU, dispatcherU, , financeU] = users;
  await prisma.auditLog.createMany({
    data: [
      { actorId: fleetU.id, action: 'VEHICLE_CREATED', entity: 'Vehicle', entityId: vehicles['TRK-001'].id, payload: { registrationNumber: 'TRK-001' }, timestamp: daysAgo(6) },
      { actorId: fleetU.id, action: 'MAINTENANCE_OPENED', entity: 'MaintenanceLog', entityId: vehicles['TRK-003'].id, payload: { type: 'REPAIR' }, timestamp: daysAgo(2) },
      { actorId: dispatcherU.id, action: 'TRIP_DISPATCHED', entity: 'Trip', entityId: 'seed', payload: { code: 'TR-2026-0027' }, timestamp: daysAgo(1) },
      { actorId: dispatcherU.id, action: 'TRIP_COMPLETED', entity: 'Trip', entityId: 'seed', payload: { code: 'TR-2026-0025' }, timestamp: daysAgo(1) },
      { actorId: financeU.id, action: 'FUEL_LOG_CREATED', entity: 'FuelLog', entityId: 'seed', payload: { isAnomaly: true, vehicle: 'VAN-03' }, timestamp: daysAgo(5) },
      { actorId: admin.id, action: 'ROLE_ASSIGNED', entity: 'User', entityId: dispatcherU.id, payload: { role: 'DISPATCHER' }, timestamp: daysAgo(7) },
    ],
  });

  const counts = {
    users: users.length,
    vehicles: vSeeds.length,
    drivers: dSeeds.length,
    trips: seq,
  };
  console.log('Seed complete:', counts);
  console.log('Login with any of: admin|fleet|dispatcher|safety|finance@transitops.dev  (password: password123)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
