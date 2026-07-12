-- Section 7 — Partial unique indexes (the concurrency backstop)
-- Run AFTER prisma db push / first migration.
-- These cannot be expressed in schema.prisma — apply via psql or Supabase SQL editor.

-- Rule #4: physically prevent double-dispatch of the same vehicle
CREATE UNIQUE INDEX IF NOT EXISTS one_active_trip_per_vehicle
  ON trips(vehicle_id)
  WHERE status = 'DISPATCHED';

-- Rule #4: physically prevent double-dispatch of the same driver
CREATE UNIQUE INDEX IF NOT EXISTS one_active_trip_per_driver
  ON trips(driver_id)
  WHERE status = 'DISPATCHED';

-- Rule #9: physically prevent opening two simultaneous maintenance logs on a vehicle
CREATE UNIQUE INDEX IF NOT EXISTS one_open_maintenance_per_vehicle
  ON maintenance_logs(vehicle_id)
  WHERE status = 'OPEN';
