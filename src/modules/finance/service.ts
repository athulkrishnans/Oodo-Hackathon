// src/modules/finance/service.ts — M4 owns this file
// Implemented in H1–2 onwards. Stub only.

export const financeService = {
  // TODO: createFuelLog(data) → FuelLog + anomaly detection (Section 9) + notify + auditLog
  //         EV vehicles: throw 422 finance/ev-no-fuel-log
  // TODO: reviewAnomaly(id, note) → FuelLog (mark reviewed, keep flag, add note)
  // TODO: createExpense(data) → Expense + auditLog
  // TODO: getFuelEfficiencyReport(filters) → per-vehicle km/L + fleet average
  // TODO: getUtilizationReport(filters) → current % + 30-day trend
  // TODO: getOperationalCostReport(filters) → fuel + maintenance + expenses per vehicle
  // TODO: getRoiReport(filters) → (revenue - (maintenance + fuel)) / acquisitionCost
  // TODO: getCarbonReport(filters) → CO2 per vehicle/month + fleet total
  // TODO: exportCsv(reportName, filters) → Node.js readable stream (CSV)
  // TODO: updateEmissionFactor(id, data) → EmissionFactor + auditLog (ADMIN only)
};
