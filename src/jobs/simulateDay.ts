// src/jobs/simulateDay.ts
// Section 12 / Section 14 #4 — scripted live demo sequence with 1s pauses so KPIs tick visibly.
// Reused by the POST /jobs/simulate-day endpoint (admin UI button) and scripts/simulateDay.ts (CLI).

import { prisma } from '../shared/prisma';
import { getSettings } from '../shared/settings';
import { dispatchService } from '../modules/dispatch/service';
import { fleetService } from '../modules/fleet/service';
import { AppError } from '../middleware/errors';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface SimulateDayResult {
  steps: string[];
}

export async function runSimulateDay(actorId: string): Promise<SimulateDayResult> {
  const settings = await getSettings();
  if (!settings.simulateDayEnabled) {
    throw new AppError(422, 'admin/simulate-day-disabled', 'Simulate Day is disabled in settings');
  }

  const steps: string[] = [];
  const log = (m: string) => { steps.push(m); console.log(`[simulateDay] ${m}`); };

  // Step 1 & 2: dispatch up to 2 DRAFT trips.
  const drafts = await prisma.trip.findMany({ where: { status: 'DRAFT' }, take: 2 });
  for (const t of drafts) {
    try {
      await dispatchService.dispatchTrip(t.id, `sim-${t.id}`, actorId);
      log(`Dispatched ${t.code}`);
    } catch (e) {
      log(`Could not dispatch ${t.code}: ${e instanceof AppError ? e.message : 'error'}`);
    }
    await sleep(1000);
  }

  // Step 3: complete one DISPATCHED trip with fuel that trips the anomaly engine.
  const dispatched = await prisma.trip.findFirst({ where: { status: 'DISPATCHED' }, orderBy: { dispatchedAt: 'desc' } });
  if (dispatched) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: dispatched.vehicleId } });
    const start = dispatched.startOdometerKm ?? vehicle?.odometerKm ?? 0;
    const distance = dispatched.plannedDistanceKm;
    const avg = vehicle?.avgKmPerLiter ?? 8;
    const expected = distance / avg;
    const fuelUsedL = vehicle?.fuelType === 'EV' ? undefined : Math.round(expected * 1.5 * 10) / 10; // ~+50% => anomaly
    try {
      await dispatchService.completeTrip(dispatched.id, { endOdometerKm: start + distance, fuelUsedL }, actorId);
      log(`Completed ${dispatched.code}${fuelUsedL ? ` with ${fuelUsedL} L (anomaly likely)` : ''}`);
    } catch (e) {
      log(`Could not complete ${dispatched.code}: ${e instanceof AppError ? e.message : 'error'}`);
    }
    await sleep(1000);
  }

  // Step 4: open maintenance on an AVAILABLE vehicle → KPI "In Maintenance" ticks up.
  const available = await prisma.vehicle.findFirst({ where: { status: 'AVAILABLE' } });
  if (available) {
    try {
      await fleetService.openMaintenance(
        { vehicleId: available.id, type: 'INSPECTION', description: 'Simulate Day inspection' },
        actorId,
      );
      log(`Opened maintenance on ${available.registrationNumber} (now IN_SHOP)`);
    } catch (e) {
      log(`Could not open maintenance: ${e instanceof AppError ? e.message : 'error'}`);
    }
  }

  log('Simulate Day sequence finished.');
  return { steps };
}
