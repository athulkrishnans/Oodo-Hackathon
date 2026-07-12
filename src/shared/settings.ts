// src/shared/settings.ts
// Read-only accessor for the Setting key-value table (BUILD_BIBLE Section 4).
// Values are stored as JSON strings; this helper parses them and merges with the
// documented defaults so callers always get a fully-populated, typed object.
// The settings WRITE API + admin UI live in the settings module (Phase 6); this
// shared reader is imported by dispatch (weights), finance (anomaly), and jobs (license bands).

import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export interface AppSettings {
  anomalyDeviationThreshold: number;   // 0.20
  anomalyMinHistory: number;           // 3
  licenseWarningDays: number[];        // [30, 60, 90]
  dispatchWeightCapacity: number;      // 35
  dispatchWeightFuel: number;          // 30
  dispatchWeightMaintenance: number;   // 20
  dispatchWeightSafety: number;        // 15
  defaultServiceIntervalKm: number;    // 10000
  simulateDayEnabled: boolean;         // true
}

// Section 4 defaults — used when a key is absent or unparseable.
export const DEFAULT_SETTINGS: AppSettings = {
  anomalyDeviationThreshold: 0.2,
  anomalyMinHistory: 3,
  licenseWarningDays: [30, 60, 90],
  dispatchWeightCapacity: 35,
  dispatchWeightFuel: 30,
  dispatchWeightMaintenance: 20,
  dispatchWeightSafety: 15,
  defaultServiceIntervalKm: 10000,
  simulateDayEnabled: true,
};

// DB key (snake_case) -> AppSettings field (camelCase).
export const SETTING_KEY_MAP: Record<string, keyof AppSettings> = {
  anomaly_deviation_threshold: 'anomalyDeviationThreshold',
  anomaly_min_history: 'anomalyMinHistory',
  license_warning_days: 'licenseWarningDays',
  dispatch_weight_capacity: 'dispatchWeightCapacity',
  dispatch_weight_fuel: 'dispatchWeightFuel',
  dispatch_weight_maintenance: 'dispatchWeightMaintenance',
  dispatch_weight_safety: 'dispatchWeightSafety',
  default_service_interval_km: 'defaultServiceIntervalKm',
  simulate_day_enabled: 'simulateDayEnabled',
};

// Inverse of SETTING_KEY_MAP: AppSettings field (camelCase) -> DB key (snake_case).
export const SETTING_FIELD_TO_KEY = Object.fromEntries(
  Object.entries(SETTING_KEY_MAP).map(([dbKey, field]) => [field, dbKey]),
) as Record<keyof AppSettings, string>;

function parseValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

// Returns the full settings object with DB overrides applied over defaults.
export async function getSettings(tx?: Prisma.TransactionClient): Promise<AppSettings> {
  const client = tx ?? prisma;
  const rows = await client.setting.findMany();
  const settings: AppSettings = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    const field = SETTING_KEY_MAP[row.key];
    if (!field) continue;
    const parsed = parseValue(row.value);
    // Assign only when the parsed value is defined; type coercion is trusted from the
    // settings write API which validates via updateSettingsSchema.
    if (parsed !== undefined && parsed !== null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (settings as any)[field] = parsed;
    }
  }
  return settings;
}
