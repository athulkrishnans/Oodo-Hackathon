// src/modules/dispatch/service.ts — M3 owns this file
// Implemented in H2–3.5. Stub only.

export const dispatchService = {
  // TODO: listDrivers(filters, pagination) → Driver[]
  // TODO: createDriver(data) → Driver + auditLog
  // TODO: updateDriver(id, data) → Driver + auditLog (blocks ON_TRIP manual set)
  // TODO: listTrips(filters, pagination) → Trip[]
  // TODO: createTrip(data) → Trip (DRAFT status)
  // TODO: dispatchTrip(id, idempotencyKey) — Section 7 core transaction:
  //         SELECT FOR UPDATE vehicle + driver
  //         validate all 10 rules
  //         UPDATE trip DISPATCHED, vehicle ON_TRIP, driver ON_TRIP
  //         auditLog + notify DISPATCHER
  // TODO: completeTrip(id, {endOdometerKm, fuelUsedL}) → Trip + FuelLog + auditLog
  // TODO: cancelTrip(id) → Trip + restore statuses + auditLog
  // TODO: getRecommendations(cargoWeightKg, plannedDistanceKm) → top 3 scored pairs (Section 8)
};
