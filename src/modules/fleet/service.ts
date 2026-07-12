// src/modules/fleet/service.ts — M2 owns this file
// Vehicle CRUD — BUILD_BIBLE Section 5.1 (Vehicle model), Section 6 (ON_TRIP system-only),
// Section 7 rule 1 (unique registration number: service-layer pre-check + DB unique constraint).
// Every state-changing action writes an immutable AuditLog row (conventions.md).

import { Prisma, Vehicle, MaintenanceLog } from '@prisma/client';
import { AppError } from '../../middleware/errors';
import { auditLog } from '../../shared/auditLog';
import { notify } from '../../shared/notify';
import { prisma } from '../../shared/prisma';
import type {
  CreateVehicleInput,
  UpdateVehicleInput,
  ListVehiclesQuery,
  CreateMaintenanceInput,
  CloseMaintenanceInput,
  ListMaintenanceQuery,
} from '../../shared/zodSchemas';

// Fields whose changes are worth recording on the audit trail.
const AUDITED_FIELDS: (keyof UpdateVehicleInput)[] = [
  'registrationNumber',
  'name',
  'model',
  'type',
  'fuelType',
  'maxLoadCapacityKg',
  'serviceIntervalKm',
  'acquisitionCost',
  'region',
  'status',
];

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}

// serviceIntervalKm defaults from settings (Section 4: default_service_interval_km).
// Falls back to the schema default (10000) when the setting is absent or unparseable.
async function resolveDefaultServiceInterval(): Promise<number | undefined> {
  const setting = await prisma.setting.findUnique({
    where: { key: 'default_service_interval_km' },
  });
  if (!setting) return undefined;
  try {
    const parsed = JSON.parse(setting.value);
    const value = typeof parsed === 'number' ? parsed : Number(parsed);
    return Number.isFinite(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export interface ListVehiclesResult {
  items: Vehicle[];
  total: number;
}

export const fleetService = {
  // GET /vehicles — paginated (default 20) + filter by type/status/region (Section 12).
  async listVehicles(query: ListVehiclesQuery): Promise<ListVehiclesResult> {
    const { page, limit, type, status, region } = query;

    const where: Prisma.VehicleWhereInput = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (region) where.region = region;

    const [items, total] = await prisma.$transaction([
      prisma.vehicle.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.vehicle.count({ where }),
    ]);

    return { items, total };
  },

  // GET /vehicles/:id
  async getVehicle(id: string): Promise<Vehicle> {
    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) {
      throw new AppError(404, 'fleet/vehicle-not-found', `Vehicle ${id} not found`);
    }
    return vehicle;
  },

  // POST /vehicles — unique-registration pre-check (Section 7 rule 1) + DB constraint backstop.
  async createVehicle(input: CreateVehicleInput, actorId: string): Promise<Vehicle> {
    const existing = await prisma.vehicle.findUnique({
      where: { registrationNumber: input.registrationNumber },
    });
    if (existing) {
      throw new AppError(
        409,
        'fleet/duplicate-registration',
        `A vehicle with registration number "${input.registrationNumber}" already exists`,
      );
    }

    let serviceIntervalKm = input.serviceIntervalKm;
    if (serviceIntervalKm === undefined) {
      serviceIntervalKm = await resolveDefaultServiceInterval();
    }

    try {
      const vehicle = await prisma.vehicle.create({
        data: {
          registrationNumber: input.registrationNumber,
          name: input.name,
          model: input.model,
          type: input.type,
          fuelType: input.fuelType,
          maxLoadCapacityKg: input.maxLoadCapacityKg,
          odometerKm: input.odometerKm ?? 0,
          acquisitionCost: input.acquisitionCost,
          region: input.region,
          ...(serviceIntervalKm !== undefined ? { serviceIntervalKm } : {}),
          // status defaults to AVAILABLE (Section 6) — never set to ON_TRIP here.
        },
      });

      await auditLog.write({
        actorId,
        action: 'VEHICLE_CREATED',
        entity: 'Vehicle',
        entityId: vehicle.id,
        payload: {
          registrationNumber: vehicle.registrationNumber,
          name: vehicle.name,
          type: vehicle.type,
          fuelType: vehicle.fuelType,
          maxLoadCapacityKg: vehicle.maxLoadCapacityKg,
          acquisitionCost: vehicle.acquisitionCost,
          region: vehicle.region,
        },
      });

      return vehicle;
    } catch (err) {
      // DB unique-constraint backstop for a race between the pre-check and the insert.
      if (isUniqueViolation(err)) {
        throw new AppError(
          409,
          'fleet/duplicate-registration',
          `A vehicle with registration number "${input.registrationNumber}" already exists`,
        );
      }
      throw err;
    }
  },

  // PATCH /vehicles/:id — audits any field change, not just status.
  async updateVehicle(
    id: string,
    input: UpdateVehicleInput,
    actorId: string,
  ): Promise<Vehicle> {
    const existing = await prisma.vehicle.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, 'fleet/vehicle-not-found', `Vehicle ${id} not found`);
    }

    // Section 6 belt-and-suspenders: rejected by Zod already, re-checked here.
    if (input.status === 'ON_TRIP') {
      throw new AppError(
        422,
        'fleet/system-only-status',
        'ON_TRIP is a system-only status and cannot be set through the vehicle API',
      );
    }

    // Unique-registration pre-check only when the number actually changes.
    if (
      input.registrationNumber &&
      input.registrationNumber !== existing.registrationNumber
    ) {
      const dup = await prisma.vehicle.findUnique({
        where: { registrationNumber: input.registrationNumber },
      });
      if (dup) {
        throw new AppError(
          409,
          'fleet/duplicate-registration',
          `A vehicle with registration number "${input.registrationNumber}" already exists`,
        );
      }
    }

    // Diff against the current row so the audit payload captures exactly what changed.
    const existingRecord = existing as unknown as Record<string, unknown>;
    const inputRecord = input as Record<string, unknown>;
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const field of AUDITED_FIELDS) {
      const next = inputRecord[field];
      if (next !== undefined && next !== existingRecord[field]) {
        changes[field] = { from: existingRecord[field], to: next };
      }
    }

    try {
      const vehicle = await prisma.vehicle.update({
        where: { id },
        data: input,
      });

      if (Object.keys(changes).length > 0) {
        await auditLog.write({
          actorId,
          action: 'VEHICLE_UPDATED',
          entity: 'Vehicle',
          entityId: vehicle.id,
          payload: { changes },
        });
      }

      return vehicle;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new AppError(
          409,
          'fleet/duplicate-registration',
          `A vehicle with registration number "${input.registrationNumber}" already exists`,
        );
      }
      throw err;
    }
  },

  // POST /vehicles/:id/retire — terminal transition (Section 6).
  // Blocked if ON_TRIP or if an OPEN maintenance log exists (Section 16).
  async retireVehicle(id: string, actorId: string): Promise<Vehicle> {
    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) {
      throw new AppError(404, 'fleet/vehicle-not-found', `Vehicle ${id} not found`);
    }
    if (vehicle.status === 'RETIRED') {
      throw new AppError(422, 'fleet/already-retired', 'Vehicle is already retired');
    }
    if (vehicle.status === 'ON_TRIP') {
      throw new AppError(
        422,
        'fleet/vehicle-on-trip',
        'Cannot retire a vehicle that is on a trip — complete or cancel the trip first',
      );
    }
    const openLog = await prisma.maintenanceLog.findFirst({
      where: { vehicleId: id, status: 'OPEN' },
    });
    if (openLog) {
      throw new AppError(
        422,
        'fleet/open-maintenance',
        'Cannot retire a vehicle with an open maintenance log — close it first',
      );
    }

    const updated = await prisma.vehicle.update({
      where: { id },
      data: { status: 'RETIRED' },
    });
    await auditLog.write({
      actorId,
      action: 'VEHICLE_RETIRED',
      entity: 'Vehicle',
      entityId: id,
      payload: { previousStatus: vehicle.status },
    });
    return updated;
  },

  // GET /maintenance-logs — paginated, filter by vehicle/status.
  async listMaintenance(
    query: ListMaintenanceQuery,
  ): Promise<{ items: MaintenanceLog[]; total: number }> {
    const { page, limit, vehicleId, status } = query;
    const where: Prisma.MaintenanceLogWhereInput = {};
    if (vehicleId) where.vehicleId = vehicleId;
    if (status) where.status = status;

    const [items, total] = await prisma.$transaction([
      prisma.maintenanceLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { openedAt: 'desc' },
      }),
      prisma.maintenanceLog.count({ where }),
    ]);
    return { items, total };
  },

  // POST /maintenance-logs — Rule #9: opening maintenance auto-sets vehicle IN_SHOP.
  // One OPEN log per vehicle (partial unique index backstop); blocked on ON_TRIP / RETIRED.
  async openMaintenance(input: CreateMaintenanceInput, actorId: string): Promise<MaintenanceLog> {
    try {
      return await prisma.$transaction(async (tx) => {
        const vehicle = await tx.vehicle.findUnique({ where: { id: input.vehicleId } });
        if (!vehicle) {
          throw new AppError(404, 'fleet/vehicle-not-found', `Vehicle ${input.vehicleId} not found`);
        }
        if (vehicle.status === 'RETIRED') {
          throw new AppError(422, 'fleet/vehicle-retired', 'Cannot open maintenance on a retired vehicle');
        }
        if (vehicle.status === 'ON_TRIP') {
          throw new AppError(
            422,
            'fleet/vehicle-on-trip',
            'Cannot open maintenance while the vehicle is on a trip — complete or cancel the trip first',
          );
        }
        const existingOpen = await tx.maintenanceLog.findFirst({
          where: { vehicleId: input.vehicleId, status: 'OPEN' },
        });
        if (existingOpen) {
          throw new AppError(
            422,
            'fleet/maintenance-already-open',
            'This vehicle already has an open maintenance log',
          );
        }

        const log = await tx.maintenanceLog.create({
          data: {
            vehicleId: input.vehicleId,
            type: input.type,
            description: input.description,
            cost: input.cost ?? 0,
            status: 'OPEN',
          },
        });
        await tx.vehicle.update({ where: { id: input.vehicleId }, data: { status: 'IN_SHOP' } });
        await auditLog.write({
          actorId,
          action: 'MAINTENANCE_OPENED',
          entity: 'MaintenanceLog',
          entityId: log.id,
          payload: { vehicleId: input.vehicleId, type: input.type, previousStatus: vehicle.status },
          tx,
        });
        return log;
      });
    } catch (err) {
      // Partial unique index backstop for a concurrent open.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AppError(
          409,
          'fleet/maintenance-already-open',
          'This vehicle already has an open maintenance log',
        );
      }
      throw err;
    }
  },

  // POST /maintenance-logs/:id/close — Rule #10: closing sets vehicle AVAILABLE unless RETIRED.
  // Resets kmSinceLastServiceKm to 0 (odometer − odometer at last closed maintenance).
  async closeMaintenance(
    id: string,
    input: CloseMaintenanceInput,
    actorId: string,
  ): Promise<MaintenanceLog> {
    return prisma.$transaction(async (tx) => {
      const log = await tx.maintenanceLog.findUnique({ where: { id } });
      if (!log) {
        throw new AppError(404, 'fleet/maintenance-not-found', `Maintenance log ${id} not found`);
      }
      if (log.status === 'CLOSED') {
        throw new AppError(422, 'fleet/maintenance-already-closed', 'This maintenance log is already closed');
      }
      const vehicle = await tx.vehicle.findUnique({ where: { id: log.vehicleId } });
      if (!vehicle) {
        throw new AppError(404, 'fleet/vehicle-not-found', `Vehicle ${log.vehicleId} not found`);
      }

      const closed = await tx.maintenanceLog.update({
        where: { id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          ...(input.cost !== undefined ? { cost: input.cost } : {}),
        },
      });

      // Rule #10: back to AVAILABLE unless the vehicle was retired in the meantime.
      const nextStatus = vehicle.status === 'RETIRED' ? 'RETIRED' : 'AVAILABLE';
      await tx.vehicle.update({
        where: { id: vehicle.id },
        data: { status: nextStatus, kmSinceLastServiceKm: 0 },
      });

      await auditLog.write({
        actorId,
        action: 'MAINTENANCE_CLOSED',
        entity: 'MaintenanceLog',
        entityId: closed.id,
        payload: { vehicleId: vehicle.id, cost: closed.cost, vehicleStatus: nextStatus },
        tx,
      });
      return closed;
    });
  },
};

// Notifies the fleet manager pool when a vehicle crosses its service interval.
// Called by the dispatch module on trip completion (Section 11).
export async function notifyServiceDueIfNeeded(vehicleId: string): Promise<void> {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) return;
  if (vehicle.kmSinceLastServiceKm >= vehicle.serviceIntervalKm) {
    await notify.sendToRole(
      'FLEET_MANAGER',
      'MAINTENANCE_DUE',
      `Vehicle ${vehicle.registrationNumber} is due for service (${Math.round(
        vehicle.kmSinceLastServiceKm,
      )} km since last service).`,
    );
  }
}
