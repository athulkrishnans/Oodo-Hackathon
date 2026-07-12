// src/modules/dispatch/service.ts — M3 owns this file
// Driver CRUD + the dispatch core (BUILD_BIBLE Sections 6, 7, 8).
// The dispatch/complete/cancel transactions are the heart of the app: row locks
// (SELECT ... FOR UPDATE) serialize concurrent dispatches, backstopped by the partial
// unique indexes (one_active_trip_per_vehicle / _per_driver). All 10 mandatory rules
// are enforced here in the service layer with clean 4xx responses.

import {
  Prisma,
  Driver,
  Trip,
  Vehicle,
  LicenseCategory,
  VehicleType,
} from '@prisma/client';
import { AppError } from '../../middleware/errors';
import { prisma } from '../../shared/prisma';
import { auditLog } from '../../shared/auditLog';
import { notify } from '../../shared/notify';
import { getSettings } from '../../shared/settings';
import { notifyServiceDueIfNeeded } from '../fleet/service';
import { financeService, getEmissionFactorPerLiter } from '../finance/service';
import type {
  CreateDriverInput,
  UpdateDriverInput,
  ListDriversQuery,
  CreateTripInput,
  CompleteTripInput,
  ListTripsQuery,
  RecommendationQuery,
} from '../../shared/zodSchemas';

// ── License ↔ vehicle-type compatibility (Section 5.1) ──
// LMV → van / pickup / bike ; HMV & TRANS → truck / bus.
const LICENSE_VEHICLE_COMPAT: Record<LicenseCategory, VehicleType[]> = {
  LMV: ['VAN', 'PICKUP', 'BIKE'],
  HMV: ['TRUCK', 'BUS'],
  TRANS: ['TRUCK', 'BUS'],
};

function isLicenseCompatible(category: LicenseCategory, vehicleType: VehicleType): boolean {
  return LICENSE_VEHICLE_COMPAT[category]?.includes(vehicleType) ?? false;
}

function isUniqueViolation(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// Generate the next TR-YYYY-NNNN code inside a transaction (max existing + 1 for the year).
async function nextTripCode(tx: Prisma.TransactionClient): Promise<string> {
  const prefix = `TR-${new Date().getFullYear()}-`;
  const last = await tx.trip.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });
  const seq = last ? parseInt(last.code.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

// Recompute avgKmPerLiter from the trailing 10 completed trips with fuel (Section 5.1). EV stays null.
async function recomputeAvgKmPerLiter(
  tx: Prisma.TransactionClient,
  vehicleId: string,
): Promise<number | null> {
  const trips = await tx.trip.findMany({
    where: { vehicleId, status: 'COMPLETED', fuelUsedL: { gt: 0 }, actualDistanceKm: { not: null } },
    orderBy: { completedAt: 'desc' },
    take: 10,
    select: { actualDistanceKm: true, fuelUsedL: true },
  });
  if (trips.length === 0) return null;
  const distance = trips.reduce((s, t) => s + (t.actualDistanceKm ?? 0), 0);
  const fuel = trips.reduce((s, t) => s + (t.fuelUsedL ?? 0), 0);
  if (fuel <= 0) return null;
  return distance / fuel;
}

export const dispatchService = {
  // ── Driver CRUD (Section 5.1) ───────────────
  async listDrivers(query: ListDriversQuery): Promise<{ items: Driver[]; total: number }> {
    const { page, limit, status, licenseCategory } = query;
    const where: Prisma.DriverWhereInput = {};
    if (status) where.status = status;
    if (licenseCategory) where.licenseCategory = licenseCategory;

    const [items, total] = await prisma.$transaction([
      prisma.driver.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.driver.count({ where }),
    ]);
    return { items, total };
  },

  async getDriver(id: string): Promise<Driver> {
    const driver = await prisma.driver.findUnique({ where: { id } });
    if (!driver) throw new AppError(404, 'dispatch/driver-not-found', `Driver ${id} not found`);
    return driver;
  },

  async createDriver(input: CreateDriverInput, actorId: string): Promise<Driver> {
    const existing = await prisma.driver.findUnique({ where: { licenseNumber: input.licenseNumber } });
    if (existing) {
      throw new AppError(
        409,
        'dispatch/duplicate-license',
        `A driver with license number "${input.licenseNumber}" already exists`,
      );
    }
    try {
      const driver = await prisma.driver.create({
        data: {
          name: input.name,
          licenseNumber: input.licenseNumber,
          licenseCategory: input.licenseCategory,
          licenseExpiryDate: input.licenseExpiryDate,
          contactNumber: input.contactNumber,
          ...(input.safetyScore !== undefined ? { safetyScore: input.safetyScore } : {}),
          // status defaults to AVAILABLE — never ON_TRIP at creation (Section 6).
        },
      });
      await auditLog.write({
        actorId,
        action: 'DRIVER_CREATED',
        entity: 'Driver',
        entityId: driver.id,
        payload: { name: driver.name, licenseNumber: driver.licenseNumber, licenseCategory: driver.licenseCategory },
      });
      return driver;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new AppError(
          409,
          'dispatch/duplicate-license',
          `A driver with license number "${input.licenseNumber}" already exists`,
        );
      }
      throw err;
    }
  },

  async updateDriver(id: string, input: UpdateDriverInput, actorId: string): Promise<Driver> {
    const existing = await prisma.driver.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'dispatch/driver-not-found', `Driver ${id} not found`);

    // Section 6 belt-and-suspenders (already rejected by Zod).
    if (input.status === 'ON_TRIP') {
      throw new AppError(422, 'dispatch/system-only-status', 'ON_TRIP is a system-only status');
    }
    // Cannot manually change status while the driver is on a trip (input.status is non-ON_TRIP here).
    if (existing.status === 'ON_TRIP' && input.status) {
      throw new AppError(
        422,
        'dispatch/driver-on-trip',
        'Cannot change status while the driver is on a trip — complete or cancel the trip first',
      );
    }
    if (input.licenseNumber && input.licenseNumber !== existing.licenseNumber) {
      const dup = await prisma.driver.findUnique({ where: { licenseNumber: input.licenseNumber } });
      if (dup) {
        throw new AppError(409, 'dispatch/duplicate-license', `License number "${input.licenseNumber}" already exists`);
      }
    }

    try {
      const driver = await prisma.driver.update({ where: { id }, data: input });
      await auditLog.write({
        actorId,
        action: 'DRIVER_UPDATED',
        entity: 'Driver',
        entityId: driver.id,
        payload: { ...input },
      });
      return driver;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new AppError(409, 'dispatch/duplicate-license', `License number "${input.licenseNumber}" already exists`);
      }
      throw err;
    }
  },

  // ── Trips ───────────────────────────────────
  async listTrips(query: ListTripsQuery): Promise<{ items: Trip[]; total: number }> {
    const { page, limit, status, vehicleId, driverId } = query;
    const where: Prisma.TripWhereInput = {};
    if (status) where.status = status;
    if (vehicleId) where.vehicleId = vehicleId;
    if (driverId) where.driverId = driverId;

    const [items, total] = await prisma.$transaction([
      prisma.trip.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { vehicle: true, driver: true },
      }),
      prisma.trip.count({ where }),
    ]);
    return { items, total };
  },

  async getTrip(id: string): Promise<Trip> {
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: { vehicle: true, driver: true, fuelLogs: true, expenses: true },
    });
    if (!trip) throw new AppError(404, 'dispatch/trip-not-found', `Trip ${id} not found`);
    return trip;
  },

  // POST /trips — creates a DRAFT trip. Validates existence + cargo ≤ capacity (Rule #5) up front;
  // status/license are (re)validated at dispatch time per Section 16.
  async createTrip(input: CreateTripInput, actorId: string): Promise<Trip> {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: input.vehicleId } });
    if (!vehicle) throw new AppError(404, 'dispatch/vehicle-not-found', `Vehicle ${input.vehicleId} not found`);
    const driver = await prisma.driver.findUnique({ where: { id: input.driverId } });
    if (!driver) throw new AppError(404, 'dispatch/driver-not-found', `Driver ${input.driverId} not found`);

    if (input.cargoWeightKg > vehicle.maxLoadCapacityKg) {
      throw new AppError(
        422,
        'dispatch/cargo-exceeds-capacity',
        `Cargo weight ${input.cargoWeightKg} kg exceeds vehicle capacity ${vehicle.maxLoadCapacityKg} kg`,
      );
    }

    const trip = await prisma.$transaction(async (tx) => {
      const code = await nextTripCode(tx);
      return tx.trip.create({
        data: {
          code,
          source: input.source,
          destination: input.destination,
          vehicleId: input.vehicleId,
          driverId: input.driverId,
          cargoWeightKg: input.cargoWeightKg,
          plannedDistanceKm: input.plannedDistanceKm,
          revenue: input.revenue ?? 0,
          status: 'DRAFT',
        },
      });
    });

    await auditLog.write({
      actorId,
      action: 'TRIP_CREATED',
      entity: 'Trip',
      entityId: trip.id,
      payload: { code: trip.code, vehicleId: trip.vehicleId, driverId: trip.driverId, cargoWeightKg: trip.cargoWeightKg },
    });
    return trip;
  },

  // POST /trips/:id/dispatch — the core transaction (Section 7).
  // Row locks on trip + vehicle + driver serialize concurrent dispatches; partial unique
  // indexes are the physical backstop. Idempotency-Key replays return the existing trip.
  async dispatchTrip(tripId: string, idempotencyKey: string | undefined, actorId: string): Promise<Trip> {
    try {
      const trip = await prisma.$transaction(async (tx) => {
        // Lock the trip row first — serializes two dispatches of the same trip.
        await tx.$queryRaw`SELECT id FROM trips WHERE id = ${tripId} FOR UPDATE`;
        const current = await tx.trip.findUnique({ where: { id: tripId } });
        if (!current) throw new AppError(404, 'dispatch/trip-not-found', `Trip ${tripId} not found`);

        // Idempotent replay: same key + already dispatched → return the existing trip (Section 16).
        if (idempotencyKey && current.idempotencyKey === idempotencyKey && current.status === 'DISPATCHED') {
          return current;
        }
        if (current.status === 'DISPATCHED') {
          throw new AppError(409, 'dispatch/trip-already-dispatched', 'This trip has already been dispatched');
        }
        if (current.status !== 'DRAFT') {
          throw new AppError(422, 'dispatch/trip-not-draft', `Cannot dispatch a ${current.status} trip`);
        }

        // Lock vehicle + driver — concurrent dispatches for the same pair serialize here.
        await tx.$queryRaw`SELECT id FROM vehicles WHERE id = ${current.vehicleId} FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM drivers WHERE id = ${current.driverId} FOR UPDATE`;

        const vehicle = await tx.vehicle.findUnique({ where: { id: current.vehicleId } });
        const driver = await tx.driver.findUnique({ where: { id: current.driverId } });
        if (!vehicle) throw new AppError(404, 'dispatch/vehicle-not-found', 'Vehicle not found');
        if (!driver) throw new AppError(404, 'dispatch/driver-not-found', 'Driver not found');

        // Rule #2 + #4: vehicle must be AVAILABLE (not RETIRED/IN_SHOP/ON_TRIP).
        if (vehicle.status === 'ON_TRIP') {
          throw new AppError(409, 'dispatch/vehicle-already-assigned', 'Vehicle was just dispatched by another user');
        }
        if (vehicle.status === 'IN_SHOP') {
          throw new AppError(422, 'dispatch/vehicle-in-shop', 'Vehicle is in the shop and cannot be dispatched');
        }
        if (vehicle.status === 'RETIRED') {
          throw new AppError(422, 'dispatch/vehicle-retired', 'Vehicle is retired and cannot be dispatched');
        }

        // Rule #3 + #4: driver must be AVAILABLE, not suspended, license valid & compatible.
        if (driver.status === 'ON_TRIP') {
          throw new AppError(409, 'dispatch/driver-already-assigned', 'Driver was just dispatched by another user');
        }
        if (driver.status === 'SUSPENDED') {
          throw new AppError(422, 'dispatch/driver-suspended', 'Driver is suspended and cannot be dispatched');
        }
        if (driver.status === 'OFF_DUTY') {
          throw new AppError(422, 'dispatch/driver-off-duty', 'Driver is off duty and cannot be dispatched');
        }
        if (driver.licenseExpiryDate.getTime() <= Date.now()) {
          throw new AppError(422, 'dispatch/license-expired', "Driver's license has expired");
        }
        if (!isLicenseCompatible(driver.licenseCategory, vehicle.type)) {
          throw new AppError(
            422,
            'dispatch/license-incompatible',
            `A ${driver.licenseCategory} license cannot operate a ${vehicle.type}`,
          );
        }

        // Rule #5: cargo ≤ capacity (re-checked at dispatch).
        if (current.cargoWeightKg > vehicle.maxLoadCapacityKg) {
          throw new AppError(
            422,
            'dispatch/cargo-exceeds-capacity',
            `Cargo weight ${current.cargoWeightKg} kg exceeds vehicle capacity ${vehicle.maxLoadCapacityKg} kg`,
          );
        }

        // Rule #6: single transaction — trip DISPATCHED, vehicle + driver ON_TRIP.
        const updated = await tx.trip.update({
          where: { id: tripId },
          data: {
            status: 'DISPATCHED',
            dispatchedAt: new Date(),
            startOdometerKm: vehicle.odometerKm,
            ...(idempotencyKey ? { idempotencyKey } : {}),
          },
        });
        await tx.vehicle.update({ where: { id: vehicle.id }, data: { status: 'ON_TRIP' } });
        await tx.driver.update({ where: { id: driver.id }, data: { status: 'ON_TRIP' } });

        await auditLog.write({
          actorId,
          action: 'TRIP_DISPATCHED',
          entity: 'Trip',
          entityId: updated.id,
          payload: { code: updated.code, vehicleId: vehicle.id, driverId: driver.id },
          tx,
        });
        return updated;
      });

      // Notifications after commit (Section 11 — trip dispatched → dispatchers).
      await notify.sendToRole('DISPATCHER', 'TRIP_STATUS', `Trip ${trip.code} dispatched.`);
      return trip;
    } catch (err) {
      // Partial unique index backstop — a lost race surfaces as P2002 → clean 409.
      if (isUniqueViolation(err)) {
        throw new AppError(
          409,
          'dispatch/vehicle-already-assigned',
          'Vehicle or driver was just assigned to another trip',
        );
      }
      throw err;
    }
  },

  // POST /trips/:id/complete — Rule #7: both restored to AVAILABLE; odometer moves forward;
  // auto-creates a FuelLog (anomaly engine) and stores CO2; safety score +1.
  async completeTrip(tripId: string, input: CompleteTripInput, actorId: string): Promise<Trip> {
    let vehicleIdForServiceCheck = '';

    const trip = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM trips WHERE id = ${tripId} FOR UPDATE`;
      const current = await tx.trip.findUnique({ where: { id: tripId } });
      if (!current) throw new AppError(404, 'dispatch/trip-not-found', `Trip ${tripId} not found`);
      if (current.status !== 'DISPATCHED') {
        throw new AppError(422, 'dispatch/trip-not-dispatched', `Cannot complete a ${current.status} trip`);
      }
      const startOdo = current.startOdometerKm ?? 0;
      if (input.endOdometerKm <= startOdo) {
        throw new AppError(
          422,
          'dispatch/invalid-odometer',
          `End odometer ${input.endOdometerKm} must be greater than start odometer ${startOdo}`,
        );
      }

      const vehicle = await tx.vehicle.findUnique({ where: { id: current.vehicleId } });
      const driver = await tx.driver.findUnique({ where: { id: current.driverId } });
      if (!vehicle || !driver) throw new AppError(404, 'dispatch/not-found', 'Vehicle or driver not found');
      vehicleIdForServiceCheck = vehicle.id;

      const actualDistanceKm = input.endOdometerKm - startOdo;
      const isEv = vehicle.fuelType === 'EV';
      const fuelUsedL = isEv ? null : input.fuelUsedL ?? null;

      // CO2 (Section 10): fuelUsedL × emission factor. EV → 0. No fuel logged → null.
      let co2Kg: number | null = null;
      if (isEv) {
        co2Kg = 0;
      } else if (fuelUsedL != null) {
        const factor = await getEmissionFactorPerLiter(vehicle.fuelType, tx);
        co2Kg = fuelUsedL * factor;
      }

      const updated = await tx.trip.update({
        where: { id: tripId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          endOdometerKm: input.endOdometerKm,
          actualDistanceKm,
          fuelUsedL,
          co2Kg,
        },
      });

      // Auto-create the fuel log (Section 9 anomaly) BEFORE recomputing avg, so the anomaly
      // is measured against the vehicle's historical efficiency, not a self-referential value.
      if (!isEv && fuelUsedL != null && fuelUsedL > 0) {
        await financeService.createFuelLog(
          { vehicleId: vehicle.id, tripId: updated.id, liters: fuelUsedL, cost: 0 },
          actorId,
          { tx, actualDistanceKm },
        );
      }

      const newAvg = isEv ? null : await recomputeAvgKmPerLiter(tx, vehicle.id);

      // Rule #7: vehicle back to AVAILABLE; odometer forward; service counter advances.
      await tx.vehicle.update({
        where: { id: vehicle.id },
        data: {
          status: 'AVAILABLE',
          odometerKm: input.endOdometerKm,
          kmSinceLastServiceKm: vehicle.kmSinceLastServiceKm + actualDistanceKm,
          ...(isEv ? {} : { avgKmPerLiter: newAvg }),
        },
      });
      // Rule #7 + Section 14 #9: driver back to AVAILABLE, safety score +1 (clean completion), clamped.
      await tx.driver.update({
        where: { id: driver.id },
        data: { status: 'AVAILABLE', safetyScore: clamp(driver.safetyScore + 1, 0, 100) },
      });

      await auditLog.write({
        actorId,
        action: 'TRIP_COMPLETED',
        entity: 'Trip',
        entityId: updated.id,
        payload: { code: updated.code, actualDistanceKm, fuelUsedL, co2Kg },
        tx,
      });
      return updated;
    });

    // Post-commit side effects (Section 11).
    await notify.sendToRole('DISPATCHER', 'TRIP_STATUS', `Trip ${trip.code} completed.`);
    if (vehicleIdForServiceCheck) await notifyServiceDueIfNeeded(vehicleIdForServiceCheck);
    return trip;
  },

  // POST /trips/:id/cancel — Rule #8: cancelling a DISPATCHED trip restores both to AVAILABLE
  // (safety score −5); cancelling a DRAFT has no status side effects (Section 16).
  async cancelTrip(tripId: string, actorId: string): Promise<Trip> {
    const { trip, wasDispatched } = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM trips WHERE id = ${tripId} FOR UPDATE`;
      const current = await tx.trip.findUnique({ where: { id: tripId } });
      if (!current) throw new AppError(404, 'dispatch/trip-not-found', `Trip ${tripId} not found`);

      if (current.status === 'DRAFT') {
        const updated = await tx.trip.update({ where: { id: tripId }, data: { status: 'CANCELLED' } });
        await auditLog.write({
          actorId,
          action: 'TRIP_CANCELLED',
          entity: 'Trip',
          entityId: updated.id,
          payload: { code: updated.code, fromStatus: 'DRAFT' },
          tx,
        });
        return { trip: updated, wasDispatched: false };
      }

      if (current.status === 'DISPATCHED') {
        const driver = await tx.driver.findUnique({ where: { id: current.driverId } });
        const updated = await tx.trip.update({ where: { id: tripId }, data: { status: 'CANCELLED' } });
        // Restore both to AVAILABLE.
        await tx.vehicle.update({ where: { id: current.vehicleId }, data: { status: 'AVAILABLE' } });
        await tx.driver.update({
          where: { id: current.driverId },
          data: { status: 'AVAILABLE', safetyScore: clamp((driver?.safetyScore ?? 80) - 5, 0, 100) },
        });
        await auditLog.write({
          actorId,
          action: 'TRIP_CANCELLED',
          entity: 'Trip',
          entityId: updated.id,
          payload: { code: updated.code, fromStatus: 'DISPATCHED' },
          tx,
        });
        return { trip: updated, wasDispatched: true };
      }

      throw new AppError(422, 'dispatch/trip-not-cancellable', `Cannot cancel a ${current.status} trip`);
    });

    await notify.sendToRole('DISPATCHER', 'TRIP_STATUS', `Trip ${trip.code} cancelled.`);
    void wasDispatched;
    return trip;
  },

  // ── Smart Dispatch Recommendation (Section 8) ──
  // Ranks every eligible (vehicle, driver) pair by a configurable-weight score. Top 3, with breakdown.
  async getRecommendations(query: RecommendationQuery): Promise<RecommendationResult> {
    const { cargoWeightKg, plannedDistanceKm } = query;
    const settings = await getSettings();

    // Weights normalised to fractions (Settings enforce sum-100).
    const wCap = settings.dispatchWeightCapacity / 100;
    const wFuel = settings.dispatchWeightFuel / 100;
    const wMaint = settings.dispatchWeightMaintenance / 100;
    const wSafe = settings.dispatchWeightSafety / 100;

    // Eligible vehicles: AVAILABLE + capacity ≥ cargo.
    const vehicles = await prisma.vehicle.findMany({
      where: { status: 'AVAILABLE', maxLoadCapacityKg: { gte: cargoWeightKg } },
    });
    // Eligible drivers: AVAILABLE + license valid.
    const drivers = await prisma.driver.findMany({
      where: { status: 'AVAILABLE', licenseExpiryDate: { gt: new Date() } },
    });

    // Fleet efficiency reference values for the fuel component.
    const withHistory = vehicles.filter((v) => v.fuelType !== 'EV' && v.avgKmPerLiter != null);
    const fleetAvg =
      withHistory.length > 0
        ? withHistory.reduce((s, v) => s + (v.avgKmPerLiter ?? 0), 0) / withHistory.length
        : 0;
    const fleetMax = withHistory.length > 0 ? Math.max(...withHistory.map((v) => v.avgKmPerLiter ?? 0)) : 0;

    const candidates: RecommendationCandidate[] = [];
    for (const vehicle of vehicles) {
      for (const driver of drivers) {
        if (!isLicenseCompatible(driver.licenseCategory, vehicle.type)) continue;

        const capacityFit = clamp(cargoWeightKg / vehicle.maxLoadCapacityKg, 0, 1);

        // fuel_efficiency: EV = 1.0; else (avg or fleet avg) / fleet_max, clamped.
        let fuelEfficiency: number;
        if (vehicle.fuelType === 'EV') {
          fuelEfficiency = 1.0;
        } else {
          const eff = vehicle.avgKmPerLiter ?? fleetAvg;
          fuelEfficiency = fleetMax > 0 ? clamp(eff / fleetMax, 0, 1) : 0.5;
        }

        const maintenanceHeadroom = clamp(
          1 - vehicle.kmSinceLastServiceKm / vehicle.serviceIntervalKm,
          0,
          1,
        );
        const driverSafety = clamp(driver.safetyScore / 100, 0, 1);

        const score =
          wCap * capacityFit + wFuel * fuelEfficiency + wMaint * maintenanceHeadroom + wSafe * driverSafety;

        // Section 8 flag: recommended vehicle due for service within the planned distance.
        const serviceDueWithinDistance =
          maintenanceHeadroom * vehicle.serviceIntervalKm < plannedDistanceKm;

        candidates.push({
          vehicle,
          driver,
          score: Number(score.toFixed(4)),
          breakdown: {
            capacityFit: Number(capacityFit.toFixed(4)),
            fuelEfficiency: Number(fuelEfficiency.toFixed(4)),
            maintenanceHeadroom: Number(maintenanceHeadroom.toFixed(4)),
            driverSafety: Number(driverSafety.toFixed(4)),
          },
          serviceDueWithinDistance,
        });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    return {
      weights: {
        capacity: settings.dispatchWeightCapacity,
        fuel: settings.dispatchWeightFuel,
        maintenance: settings.dispatchWeightMaintenance,
        safety: settings.dispatchWeightSafety,
      },
      recommendations: candidates.slice(0, 3),
    };
  },
};

export interface RecommendationCandidate {
  vehicle: Vehicle;
  driver: Driver;
  score: number;
  breakdown: {
    capacityFit: number;
    fuelEfficiency: number;
    maintenanceHeadroom: number;
    driverSafety: number;
  };
  serviceDueWithinDistance: boolean;
}

export interface RecommendationResult {
  weights: { capacity: number; fuel: number; maintenance: number; safety: number };
  recommendations: RecommendationCandidate[];
}
