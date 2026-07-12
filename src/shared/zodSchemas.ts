// src/shared/zodSchemas.ts
// Single source of truth for all Zod validation schemas.
// Imported by both Express routes AND frontend forms — never hand-roll a second copy.
// Each module's schemas are added here as features are implemented in H1+.

import { z } from 'zod';

// ── Auth ──────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

// ── Vehicle ───────────────────────────────────
// TODO M2: add createVehicleSchema, updateVehicleSchema

// ── Driver ───────────────────────────────────
// TODO M3: add createDriverSchema, updateDriverSchema

// ── Trip ─────────────────────────────────────
// TODO M3: add createTripSchema, dispatchTripSchema, completeTripSchema

// ── Maintenance ───────────────────────────────
// TODO M2: add createMaintenanceSchema, closeMaintenanceSchema

// ── Fuel / Expense ────────────────────────────
// TODO M4: add createFuelLogSchema, createExpenseSchema

// ── Settings ──────────────────────────────────
export const updateSettingsSchema = z.object({
  anomalyDeviationThreshold: z.number().min(0).max(1).optional(),
  anomalyMinHistory: z.number().int().min(1).optional(),
  licenseWarningDays: z.array(z.number().int().positive()).optional(),
  dispatchWeightCapacity: z.number().int().optional(),
  dispatchWeightFuel: z.number().int().optional(),
  dispatchWeightMaintenance: z.number().int().optional(),
  dispatchWeightSafety: z.number().int().optional(),
  defaultServiceIntervalKm: z.number().int().positive().optional(),
  simulateDayEnabled: z.boolean().optional(),
}).refine(
  (data) => {
    const weights = [
      data.dispatchWeightCapacity,
      data.dispatchWeightFuel,
      data.dispatchWeightMaintenance,
      data.dispatchWeightSafety,
    ];
    if (weights.some((w) => w !== undefined)) {
      const defined = weights.filter((w) => w !== undefined) as number[];
      if (defined.length === 4) {
        return defined.reduce((a, b) => a + b, 0) === 100;
      }
    }
    return true;
  },
  { message: 'Dispatch weights must sum to 100 when all four are provided' },
);
