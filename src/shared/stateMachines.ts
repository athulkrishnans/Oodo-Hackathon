// src/shared/stateMachines.ts
// Authoritative state transition tables from BUILD_BIBLE.md Section 6.
// Service layers call these helpers to validate transitions before writing to DB.
// ON_TRIP is SYSTEM-ONLY — never settable via manual vehicle/driver update APIs.

import { VehicleStatus, DriverStatus, TripStatus, MaintenanceStatus } from '@prisma/client';

// ── Vehicle state machine ─────────────────────
const VEHICLE_TRANSITIONS: Record<VehicleStatus, VehicleStatus[]> = {
  AVAILABLE: ['ON_TRIP', 'IN_SHOP', 'RETIRED'],
  ON_TRIP:   ['AVAILABLE'],                      // system-only: trip complete/cancel
  IN_SHOP:   ['AVAILABLE', 'RETIRED'],           // maintenance close
  RETIRED:   [],                                  // terminal state
};

export function canTransitionVehicle(from: VehicleStatus, to: VehicleStatus): boolean {
  return VEHICLE_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Driver state machine ──────────────────────
const DRIVER_TRANSITIONS: Record<DriverStatus, DriverStatus[]> = {
  AVAILABLE:  ['ON_TRIP', 'OFF_DUTY', 'SUSPENDED'],
  ON_TRIP:    ['AVAILABLE'],                     // system-only: trip complete/cancel
  OFF_DUTY:   ['AVAILABLE', 'SUSPENDED'],
  SUSPENDED:  ['AVAILABLE', 'OFF_DUTY'],         // Safety Officer only
};

export function canTransitionDriver(from: DriverStatus, to: DriverStatus): boolean {
  return DRIVER_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Trip state machine ────────────────────────
const TRIP_TRANSITIONS: Record<TripStatus, TripStatus[]> = {
  DRAFT:      ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['COMPLETED', 'CANCELLED'],
  COMPLETED:  [],  // terminal
  CANCELLED:  [],  // terminal
};

export function canTransitionTrip(from: TripStatus, to: TripStatus): boolean {
  return TRIP_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Maintenance state machine ──────────────────
const MAINTENANCE_TRANSITIONS: Record<MaintenanceStatus, MaintenanceStatus[]> = {
  OPEN:   ['CLOSED'],
  CLOSED: [],  // terminal
};

export function canTransitionMaintenance(from: MaintenanceStatus, to: MaintenanceStatus): boolean {
  return MAINTENANCE_TRANSITIONS[from]?.includes(to) ?? false;
}

// Guard: ON_TRIP must never be set via manual vehicle/driver APIs
export const SYSTEM_ONLY_VEHICLE_STATUSES: VehicleStatus[] = ['ON_TRIP'];
export const SYSTEM_ONLY_DRIVER_STATUSES: DriverStatus[] = ['ON_TRIP'];
