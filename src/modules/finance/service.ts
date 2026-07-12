// src/modules/finance/service.ts — M4 owns this file
// Fuel/expense + anomaly + carbon + reports (BUILD_BIBLE Sections 9, 10, 13).
// Phase 4 slice: createFuelLog (anomaly engine) + getEmissionFactorPerLiter — the dispatch
// module imports these so trip completion can auto-create a fuel log and compute CO2.
// Reports + CSV export are implemented in Phase 5.

import { Prisma, FuelLog, FuelType, Expense } from '@prisma/client';
import { AppError } from '../../middleware/errors';
import { prisma } from '../../shared/prisma';
import { auditLog } from '../../shared/auditLog';
import { notify } from '../../shared/notify';
import { getSettings } from '../../shared/settings';
import type {
  CreateFuelLogInput,
  CreateExpenseInput,
  ListFuelLogsQuery,
  ListExpensesQuery,
  ReportFilter,
  ReportName,
} from '../../shared/zodSchemas';

// DEFRA 2024 fallback factors (Section 10) — used only if the EmissionFactor row is missing.
const FALLBACK_FACTORS: Record<FuelType, number> = {
  DIESEL: 2.68,
  PETROL: 2.31,
  CNG: 2.02,
  EV: 0,
};

// CO2 per litre for a fuel type (Section 10). Reads the ADMIN-editable table, falls back to DEFRA.
export async function getEmissionFactorPerLiter(
  fuelType: FuelType,
  tx?: Prisma.TransactionClient,
): Promise<number> {
  const client = tx ?? prisma;
  const factor = await client.emissionFactor.findUnique({ where: { fuelType } });
  return factor ? factor.kgCo2PerLiter : FALLBACK_FACTORS[fuelType];
}

interface CreateFuelLogOptions {
  tx?: Prisma.TransactionClient;
  // Distance to base the expected-litres calculation on. When auto-created from a trip
  // completion, this is the trip's actualDistanceKm. Falls back to the linked trip's value.
  actualDistanceKm?: number | null;
  // Skip the anomaly notification (e.g. bulk seeding). Default false.
  suppressNotification?: boolean;
}

export const financeService = {
  // Create a fuel log and run the Section 9 anomaly check.
  // EV vehicles are blocked (finance/ev-no-fuel-log). Safe to call inside a transaction.
  async createFuelLog(
    input: CreateFuelLogInput,
    actorId: string,
    opts: CreateFuelLogOptions = {},
  ): Promise<FuelLog> {
    const client = opts.tx ?? prisma;

    const vehicle = await client.vehicle.findUnique({ where: { id: input.vehicleId } });
    if (!vehicle) {
      throw new AppError(404, 'finance/vehicle-not-found', `Vehicle ${input.vehicleId} not found`);
    }
    // EV skips fuel logs entirely (Section 5.2 / Section 16).
    if (vehicle.fuelType === 'EV') {
      throw new AppError(422, 'finance/ev-no-fuel-log', 'Electric vehicles do not record fuel logs');
    }

    // Resolve the distance used for the expected-litres calculation.
    let actualDistanceKm = opts.actualDistanceKm ?? null;
    if (actualDistanceKm == null && input.tripId) {
      const trip = await client.trip.findUnique({ where: { id: input.tripId } });
      actualDistanceKm = trip?.actualDistanceKm ?? null;
    }

    const settings = await getSettings(opts.tx);
    const priorCount = await client.fuelLog.count({ where: { vehicleId: input.vehicleId } });

    let expectedLiters: number | null = null;
    let deviationPct: number | null = null;
    let isAnomaly = false;

    // Section 9: cold-start guard — need at least anomaly_min_history prior logs and a usable avg.
    if (
      actualDistanceKm != null &&
      actualDistanceKm > 0 &&
      vehicle.avgKmPerLiter != null &&
      vehicle.avgKmPerLiter > 0 &&
      priorCount >= settings.anomalyMinHistory
    ) {
      expectedLiters = actualDistanceKm / vehicle.avgKmPerLiter;
      if (expectedLiters > 0) {
        deviationPct = (input.liters - expectedLiters) / expectedLiters;
        isAnomaly = deviationPct > settings.anomalyDeviationThreshold;
      }
    }

    const fuelLog = await client.fuelLog.create({
      data: {
        vehicleId: input.vehicleId,
        tripId: input.tripId,
        liters: input.liters,
        cost: input.cost,
        date: input.date ?? new Date(),
        expectedLiters,
        deviationPct,
        isAnomaly,
      },
    });

    await auditLog.write({
      actorId,
      action: 'FUEL_LOG_CREATED',
      entity: 'FuelLog',
      entityId: fuelLog.id,
      payload: {
        vehicleId: input.vehicleId,
        liters: input.liters,
        expectedLiters,
        deviationPct,
        isAnomaly,
      },
      tx: opts.tx,
    });

    // Notify finance of a suspicious log (Section 11). Fanned out to FINANCIAL_ANALYST.
    if (isAnomaly && !opts.suppressNotification) {
      await notify.sendToRole(
        'FINANCIAL_ANALYST',
        'FUEL_ANOMALY',
        `Suspicious fuel log for vehicle ${vehicle.registrationNumber}: ${input.liters.toFixed(
          1,
        )} L vs expected ${expectedLiters?.toFixed(1)} L (${((deviationPct ?? 0) * 100).toFixed(0)}% over).`,
      );
    }

    return fuelLog;
  },

  // GET /fuel-logs — paginated, filter by vehicle / anomaly flag.
  async listFuelLogs(query: ListFuelLogsQuery): Promise<{ items: FuelLog[]; total: number }> {
    const { page, limit, vehicleId, isAnomaly } = query;
    const where: Prisma.FuelLogWhereInput = {};
    if (vehicleId) where.vehicleId = vehicleId;
    if (isAnomaly !== undefined) where.isAnomaly = isAnomaly;

    const [items, total] = await prisma.$transaction([
      prisma.fuelLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { date: 'desc' },
        include: { vehicle: { select: { registrationNumber: true, name: true, fuelType: true } } },
      }),
      prisma.fuelLog.count({ where }),
    ]);
    return { items, total };
  },

  // GET /fuel-logs/anomalies — flagged logs for the analyst review queue (Section 9).
  async listAnomalies(query: ListFuelLogsQuery): Promise<{ items: FuelLog[]; total: number }> {
    return this.listFuelLogs({ ...query, isAnomaly: true });
  },

  // POST /fuel-logs/:id/review — keeps the flag, records a justification note (never deletes evidence).
  async reviewAnomaly(id: string, reviewNote: string, actorId: string): Promise<FuelLog> {
    const log = await prisma.fuelLog.findUnique({ where: { id } });
    if (!log) throw new AppError(404, 'finance/fuel-log-not-found', `Fuel log ${id} not found`);
    if (!log.isAnomaly) {
      throw new AppError(422, 'finance/not-an-anomaly', 'This fuel log is not flagged as an anomaly');
    }
    const updated = await prisma.fuelLog.update({
      where: { id },
      data: { anomalyReviewed: true, reviewNote },
    });
    await auditLog.write({
      actorId,
      action: 'FUEL_ANOMALY_REVIEWED',
      entity: 'FuelLog',
      entityId: id,
      payload: { reviewNote },
    });
    return updated;
  },

  // POST /expenses — toll / parking / fine / other.
  async createExpense(input: CreateExpenseInput, actorId: string): Promise<Expense> {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: input.vehicleId } });
    if (!vehicle) throw new AppError(404, 'finance/vehicle-not-found', `Vehicle ${input.vehicleId} not found`);
    const expense = await prisma.expense.create({
      data: {
        vehicleId: input.vehicleId,
        tripId: input.tripId,
        type: input.type,
        amount: input.amount,
        date: input.date ?? new Date(),
        notes: input.notes,
      },
    });
    await auditLog.write({
      actorId,
      action: 'EXPENSE_CREATED',
      entity: 'Expense',
      entityId: expense.id,
      payload: { vehicleId: input.vehicleId, type: input.type, amount: input.amount },
    });
    return expense;
  },

  async listExpenses(query: ListExpensesQuery): Promise<{ items: Expense[]; total: number }> {
    const { page, limit, vehicleId, type } = query;
    const where: Prisma.ExpenseWhereInput = {};
    if (vehicleId) where.vehicleId = vehicleId;
    if (type) where.type = type;

    const [items, total] = await prisma.$transaction([
      prisma.expense.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { date: 'desc' },
        include: { vehicle: { select: { registrationNumber: true, name: true } } },
      }),
      prisma.expense.count({ where }),
    ]);
    return { items, total };
  },

  // PATCH /trips/:id/revenue — revenue is analyst-editable (ROI numerator). Writes to the Trip table.
  async setTripRevenue(tripId: string, revenue: number, actorId: string): Promise<{ id: string; revenue: number }> {
    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new AppError(404, 'finance/trip-not-found', `Trip ${tripId} not found`);
    const updated = await prisma.trip.update({ where: { id: tripId }, data: { revenue } });
    await auditLog.write({
      actorId,
      action: 'TRIP_REVENUE_SET',
      entity: 'Trip',
      entityId: tripId,
      payload: { revenue, previousRevenue: trip.revenue },
    });
    return { id: updated.id, revenue: updated.revenue };
  },

  // ── Emission factors (Section 10, ADMIN-editable) ──
  async listEmissionFactors() {
    return prisma.emissionFactor.findMany({ orderBy: { fuelType: 'asc' } });
  },

  async updateEmissionFactor(
    id: string,
    data: { kgCo2PerLiter: number; source?: string },
    actorId: string,
  ) {
    const existing = await prisma.emissionFactor.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'finance/emission-factor-not-found', `Emission factor ${id} not found`);
    const updated = await prisma.emissionFactor.update({
      where: { id },
      data: { kgCo2PerLiter: data.kgCo2PerLiter, ...(data.source ? { source: data.source } : {}) },
    });
    await auditLog.write({
      actorId,
      action: 'EMISSION_FACTOR_UPDATED',
      entity: 'EmissionFactor',
      entityId: id,
      payload: { kgCo2PerLiter: data.kgCo2PerLiter, previous: existing.kgCo2PerLiter },
    });
    return updated;
  },

  // ── Reports (Section 13) ────────────────────
  async fuelEfficiencyReport(filter: ReportFilter) {
    const vehicles = await prisma.vehicle.findMany({ where: vehicleWhere(filter) });
    const rows = vehicles
      .filter((v) => v.fuelType !== 'EV')
      .map((v) => ({
        vehicleId: v.id,
        registrationNumber: v.registrationNumber,
        name: v.name,
        avgKmPerLiter: v.avgKmPerLiter,
      }));
    const withData = rows.filter((r) => r.avgKmPerLiter != null) as Array<
      typeof rows[number] & { avgKmPerLiter: number }
    >;
    const fleetAverage =
      withData.length > 0 ? withData.reduce((s, r) => s + r.avgKmPerLiter, 0) / withData.length : null;
    const worst5 = [...withData].sort((a, b) => a.avgKmPerLiter - b.avgKmPerLiter).slice(0, 5);
    return { vehicles: rows, fleetAverage, worst5 };
  },

  async utilizationReport(filter: ReportFilter) {
    const where = vehicleWhere(filter);
    const [nonRetired, onTrip] = await Promise.all([
      prisma.vehicle.count({ where: { ...where, status: { not: 'RETIRED' } } }),
      prisma.vehicle.count({ where: { ...where, status: 'ON_TRIP' } }),
    ]);
    const currentUtilization = nonRetired > 0 ? onTrip / nonRetired : 0;

    // 30-day trend: distinct vehicles active per day, based on trip dispatch/complete windows.
    const now = new Date();
    const windowStart = new Date(now.getTime() - 29 * 864e5);
    const trips = await prisma.trip.findMany({
      where: {
        dispatchedAt: { not: null, lte: now },
        OR: [{ completedAt: null }, { completedAt: { gte: windowStart } }],
      },
      select: { vehicleId: true, dispatchedAt: true, completedAt: true },
    });
    const trend: Array<{ date: string; activeVehicles: number; utilization: number }> = [];
    for (let i = 0; i < 30; i++) {
      const dayStart = new Date(windowStart.getTime() + i * 864e5);
      const dayEnd = new Date(dayStart.getTime() + 864e5);
      const active = new Set<string>();
      for (const t of trips) {
        if (!t.dispatchedAt) continue;
        const end = t.completedAt ?? now;
        if (t.dispatchedAt < dayEnd && end >= dayStart) active.add(t.vehicleId);
      }
      trend.push({
        date: dayStart.toISOString().slice(0, 10),
        activeVehicles: active.size,
        utilization: nonRetired > 0 ? active.size / nonRetired : 0,
      });
    }
    return { currentUtilization, onTrip, nonRetired, trend };
  },

  async operationalCostReport(filter: ReportFilter) {
    const vehicles = await prisma.vehicle.findMany({ where: vehicleWhere(filter) });
    const ids = vehicles.map((v) => v.id);
    const dateBetween = dateRange(filter);

    const [fuelLogs, maintenance, expenses] = await Promise.all([
      prisma.fuelLog.findMany({
        where: { vehicleId: { in: ids }, ...(dateBetween ? { date: dateBetween } : {}) },
        select: { vehicleId: true, cost: true, date: true },
      }),
      prisma.maintenanceLog.findMany({
        where: { vehicleId: { in: ids }, ...(dateBetween ? { openedAt: dateBetween } : {}) },
        select: { vehicleId: true, cost: true, openedAt: true },
      }),
      prisma.expense.findMany({
        where: { vehicleId: { in: ids }, ...(dateBetween ? { date: dateBetween } : {}) },
        select: { vehicleId: true, amount: true, date: true },
      }),
    ]);

    const perVehicle = vehicles.map((v) => {
      const fuel = fuelLogs.filter((f) => f.vehicleId === v.id).reduce((s, f) => s + f.cost, 0);
      const maint = maintenance.filter((m) => m.vehicleId === v.id).reduce((s, m) => s + m.cost, 0);
      const exp = expenses.filter((e) => e.vehicleId === v.id).reduce((s, e) => s + e.amount, 0);
      return {
        vehicleId: v.id,
        registrationNumber: v.registrationNumber,
        fuel,
        maintenance: maint,
        expenses: exp,
        total: fuel + maint + exp,
      };
    });

    // Fleet-wide monthly breakdown.
    const monthly: Record<string, { month: string; fuel: number; maintenance: number; expenses: number }> = {};
    const bump = (d: Date, key: 'fuel' | 'maintenance' | 'expenses', amt: number) => {
      const m = d.toISOString().slice(0, 7);
      monthly[m] ??= { month: m, fuel: 0, maintenance: 0, expenses: 0 };
      monthly[m][key] += amt;
    };
    fuelLogs.forEach((f) => bump(f.date, 'fuel', f.cost));
    maintenance.forEach((m) => bump(m.openedAt, 'maintenance', m.cost));
    expenses.forEach((e) => bump(e.date, 'expenses', e.amount));

    return { perVehicle, monthly: Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month)) };
  },

  async roiReport(filter: ReportFilter) {
    const vehicles = await prisma.vehicle.findMany({ where: vehicleWhere(filter) });
    const ids = vehicles.map((v) => v.id);
    const dateBetween = dateRange(filter);

    const [trips, fuelLogs, maintenance] = await Promise.all([
      prisma.trip.findMany({
        where: { vehicleId: { in: ids }, ...(dateBetween ? { createdAt: dateBetween } : {}) },
        select: { vehicleId: true, revenue: true },
      }),
      prisma.fuelLog.findMany({
        where: { vehicleId: { in: ids }, ...(dateBetween ? { date: dateBetween } : {}) },
        select: { vehicleId: true, cost: true },
      }),
      prisma.maintenanceLog.findMany({
        where: { vehicleId: { in: ids }, ...(dateBetween ? { openedAt: dateBetween } : {}) },
        select: { vehicleId: true, cost: true },
      }),
    ]);

    const perVehicle = vehicles.map((v) => {
      const revenue = trips.filter((t) => t.vehicleId === v.id).reduce((s, t) => s + t.revenue, 0);
      const fuel = fuelLogs.filter((f) => f.vehicleId === v.id).reduce((s, f) => s + f.cost, 0);
      const maint = maintenance.filter((m) => m.vehicleId === v.id).reduce((s, m) => s + m.cost, 0);
      // Section 13 verbatim: (revenue − (maintenance + fuel)) ÷ acquisitionCost. Guard divide-by-zero.
      const roi = v.acquisitionCost > 0 ? (revenue - (maint + fuel)) / v.acquisitionCost : null;
      return {
        vehicleId: v.id,
        registrationNumber: v.registrationNumber,
        revenue,
        fuel,
        maintenance: maint,
        acquisitionCost: v.acquisitionCost,
        roi,
      };
    });
    return { perVehicle };
  },

  async carbonReport(filter: ReportFilter) {
    const vehicles = await prisma.vehicle.findMany({ where: vehicleWhere(filter) });
    const ids = vehicles.map((v) => v.id);
    const dateBetween = dateRange(filter);
    const trips = await prisma.trip.findMany({
      where: {
        vehicleId: { in: ids },
        co2Kg: { not: null },
        ...(dateBetween ? { completedAt: dateBetween } : {}),
      },
      select: { vehicleId: true, co2Kg: true, completedAt: true },
    });

    const perVehicle = vehicles.map((v) => ({
      vehicleId: v.id,
      registrationNumber: v.registrationNumber,
      co2Kg: trips.filter((t) => t.vehicleId === v.id).reduce((s, t) => s + (t.co2Kg ?? 0), 0),
    }));
    const monthly: Record<string, number> = {};
    trips.forEach((t) => {
      if (!t.completedAt) return;
      const m = t.completedAt.toISOString().slice(0, 7);
      monthly[m] = (monthly[m] ?? 0) + (t.co2Kg ?? 0);
    });
    const fleetTotal = perVehicle.reduce((s, v) => s + v.co2Kg, 0);
    return {
      perVehicle,
      monthly: Object.entries(monthly)
        .map(([month, co2Kg]) => ({ month, co2Kg }))
        .sort((a, b) => a.month.localeCompare(b.month)),
      fleetTotal,
    };
  },

  // Flattens a report into CSV rows (header + data) for the streaming export endpoint.
  async reportRows(name: ReportName, filter: ReportFilter): Promise<Record<string, unknown>[]> {
    switch (name) {
      case 'fuel-efficiency':
        return (await this.fuelEfficiencyReport(filter)).vehicles;
      case 'utilization':
        return (await this.utilizationReport(filter)).trend;
      case 'operational-cost':
        return (await this.operationalCostReport(filter)).perVehicle;
      case 'roi':
        return (await this.roiReport(filter)).perVehicle;
      case 'carbon':
        return (await this.carbonReport(filter)).perVehicle;
      default:
        return [];
    }
  },
};

// ── Report filter helpers ─────────────────────
function vehicleWhere(filter: ReportFilter): Prisma.VehicleWhereInput {
  const where: Prisma.VehicleWhereInput = {};
  if (filter.vehicleId) where.id = filter.vehicleId;
  if (filter.region) where.region = filter.region;
  if (filter.type) where.type = filter.type;
  return where;
}

function dateRange(filter: ReportFilter): { gte?: Date; lte?: Date } | undefined {
  if (!filter.from && !filter.to) return undefined;
  const range: { gte?: Date; lte?: Date } = {};
  if (filter.from) range.gte = filter.from;
  if (filter.to) range.lte = filter.to;
  return range;
}

// Serialize flat objects to CSV text (RFC-4180-ish quoting). Used by the streaming export route.
export function objectsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (val: unknown): string => {
    const s = val == null ? '' : String(val);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map((h) => escape(row[h])).join(','));
  return lines.join('\n');
}
