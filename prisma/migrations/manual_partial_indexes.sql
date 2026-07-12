-- Section 7 — Partial unique indexes (the concurrency backstop)
-- Run AFTER prisma db push / first migration.
-- These cannot be expressed in schema.prisma — apply via:
--   npx prisma db execute --file prisma/migrations/manual_partial_indexes.sql --schema prisma/schema.prisma
--
-- NOTE: Prisma maps model fields to camelCase column names (no @map used), so the
-- physical columns are "vehicleId" / "driverId" and must be double-quoted. Table names
-- use @@map (trips, maintenance_logs) and are lowercase/unquoted.

-- Rule #4: physically prevent double-dispatch of the same vehicle
CREATE UNIQUE INDEX IF NOT EXISTS one_active_trip_per_vehicle
  ON trips("vehicleId")
  WHERE status = 'DISPATCHED';

-- Rule #4: physically prevent double-dispatch of the same driver
CREATE UNIQUE INDEX IF NOT EXISTS one_active_trip_per_driver
  ON trips("driverId")
  WHERE status = 'DISPATCHED';

-- Rule #9: physically prevent opening two simultaneous maintenance logs on a vehicle
CREATE UNIQUE INDEX IF NOT EXISTS one_open_maintenance_per_vehicle
  ON maintenance_logs("vehicleId")
  WHERE status = 'OPEN';
