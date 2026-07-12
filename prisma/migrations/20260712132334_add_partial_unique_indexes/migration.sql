-- Migration: add_partial_unique_indexes
-- Generated manually because prisma migrate dev --create-only requires a live DB connection.
-- These three partial unique indexes cannot be expressed in Prisma's schema language,
-- so they live here as raw SQL. See ARCHITECTURE.md for rationale.
--
-- IMPORTANT: If you ever run `prisma migrate reset`, re-apply this migration manually
-- or ensure Prisma replays it from the migrations table. The indexes are the DB-level
-- backstop for the dispatch concurrency safety (Section 7, BUILD_BIBLE.md).

-- Rule #4 backstop: physically prevents double-dispatch of the same vehicle.
-- Even a buggy code path cannot create two DISPATCHED trips for one vehicle.
CREATE UNIQUE INDEX IF NOT EXISTS one_active_trip_per_vehicle
  ON trips (vehicle_id)
  WHERE status = 'DISPATCHED';

-- Rule #4 backstop: physically prevents double-dispatch of the same driver.
CREATE UNIQUE INDEX IF NOT EXISTS one_active_trip_per_driver
  ON trips (driver_id)
  WHERE status = 'DISPATCHED';

-- Rule #9 backstop: physically prevents opening two simultaneous maintenance logs
-- on the same vehicle. One OPEN log per vehicle at a time.
CREATE UNIQUE INDEX IF NOT EXISTS one_open_maintenance_per_vehicle
  ON maintenance_logs (vehicle_id)
  WHERE status = 'OPEN';
