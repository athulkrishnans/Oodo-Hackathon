TRANSITOPS — Smart Transport Operations Platform · BUILD BIBLE
Target: Custom stack (React + Node/TS + Postgres) · Built with Kiro · 7-hour hackathon build
This document is the single source of truth. If something is not specified here, follow standard REST/Prisma conventions.

## 1. Product Summary
TransitOps is a centralized fleet operations platform that replaces spreadsheets and paper logbooks. It:

- Manages the full lifecycle of vehicles, drivers, trips, maintenance, fuel, and expenses.
- Enforces 10 mandatory business rules transactionally, correct even under simultaneous dispatchers.
- Auto-transitions vehicle/driver statuses on dispatch, completion, cancellation, and maintenance.
- Adds an intelligence layer no incumbent (Fleetio/Samsara) offers without hardware: Smart Dispatch Recommendation, Fuel Anomaly (fraud) Detection, Carbon-per-Trip tracking.
- Ships with KPI dashboard, analytics (fuel efficiency, utilization, cost, ROI), CSV export, notifications, full audit trail, and a live "Simulate Day" demo mode.

## 2. Tech Stack & Constraints

| Item | Decision | Trade-off accepted |
|---|---|---|
| Frontend | React + Vite + TypeScript + Tailwind + shadcn/ui, Recharts | SPA = no SEO; irrelevant for internal ops tool |
| Backend | Node.js + Express + TypeScript, single modular monolith | Less raw perf than Go; workload is I/O-bound CRUD |
| ORM | Prisma (schema doubles as documentation) | Slight query overhead; compile-time type safety worth it |
| Database | PostgreSQL via Supabase (pooled) | Vendor dependency; vanilla Postgres underneath, portable |
| Auth | JWT (15-min access token) + bcrypt, stateless | Instant revocation harder; acceptable with short expiry |
| Validation | Zod schemas shared FE/BE (single source of truth for shapes) | — |
| Exports | CSV via streaming endpoint; PDF declared roadmap | — |
| Load testing | k6 script + results in README | — |
| No external APIs | Fully offline-demoable | — |
| Mobile | Tailwind responsive; card-first layouts on list screens | — |

Deliberately rejected: microservices (overhead at this scale — modular monolith with extractable dispatch module is the defensible answer), Redis (Postgres suffices now; documented as scaling step), NoSQL (dispatch correctness demands ACID).

Folder structure:
```
transitops/
├── prisma/schema.prisma + seed.ts        # schema + demo data (FROZEN after hour 1)
├── src/
│   ├── server.ts
│   ├── middleware/ (auth.ts, rbac.ts, rateLimit.ts, idempotency.ts, errors.ts)
│   ├── modules/                          # one folder per member — no cross-editing
│   │   ├── auth/       (routes, service)
│   │   ├── fleet/      (vehicles, maintenance)
│   │   ├── dispatch/   (drivers, trips, recommendation)
│   │   └── finance/    (fuel, expenses, reports, carbon)
│   ├── shared/ (stateMachines.ts, auditLog.ts, notify.ts, zodSchemas.ts)
│   └── jobs/licenseExpiry.ts             # node-cron daily check (+ manual trigger for demo)
├── web/src/ (pages per module, components, api client, charts)
├── scripts/ (concurrencyDemo.ts, simulateDay.ts, loadtest.k6.js)
├── ARCHITECTURE.md                       # trade-off table (graded artifact)
└── .kiro/steering/                       # conventions: API shape, error format, naming
```

## 3. Security Roles (RBAC)

| Role | Who | Rights |
|---|---|---|
| ADMIN | System owner | Everything + user management, settings, emission factors. Seeded only — no self-assigned admin at signup |
| FLEET_MANAGER | Fleet ops | Vehicle CRUD, maintenance open/close, retire vehicles, view all analytics |
| DISPATCHER | Ops desk (the statement's "Driver" persona — creates trips, assigns vehicles/drivers) | Trip create/dispatch/complete/cancel, view fleet availability |
| SAFETY_OFFICER | Compliance | Driver CRUD, suspend/reinstate drivers, edit safety scores, license expiry dashboard |
| FINANCIAL_ANALYST | Finance | Fuel/expense CRUD, revenue entry, all reports + exports, anomaly review |

Enforcement: JWT middleware → requireRole(...) per route. All roles read the dashboard; writes are role-scoped.
Signup creates a pending account with no role; ADMIN assigns roles (mirrors realistic provisioning).
Rate limit on /auth/*: 10 req/min/IP (blocks credential stuffing).

## 4. Settings (settings key-value table, ADMIN-editable UI)

| Key | Type | Default | Rule |
|---|---|---|---|
| anomaly_deviation_threshold | Float | 0.20 | Fuel log flagged if deviation exceeds this |
| anomaly_min_history | Int | 3 | Min prior fuel logs before anomaly engine activates (cold-start guard) |
| license_warning_days | Int[] | [30, 60, 90] | Expiry risk bands |
| dispatch_weight_capacity / _fuel / _maintenance / _safety | Int % | 35 / 30 / 20 / 15 | Constraint: must sum to 100 (mirrors configurable scoring — judges can tune live) |
| default_service_interval_km | Int | 10000 | Used when vehicle has no override |
| simulate_day_enabled | Boolean | true | Gates the demo endpoint |

## 5. Data Models — FULL SPEC
All models: id (cuid), createdAt, updatedAt. Every state-changing action writes an AuditLog row.

### 5.1 Master Data

**User**
| Field | Type | Notes |
|---|---|---|
| email | String, unique | login |
| passwordHash | String | bcrypt, cost 10 |
| name | String, required | |
| role | Enum (Section 3), nullable | null = pending approval |
| status | ACTIVE / INACTIVE | inactive cannot log in |

**Vehicle**
| Field | Type | Notes |
|---|---|---|
| registrationNumber | String, unique (DB constraint) | Mandatory rule #1 |
| name / model | String required / String | |
| type | Enum: TRUCK / VAN / PICKUP / BIKE / BUS | dashboard filter |
| fuelType | Enum: DIESEL / PETROL / CNG / EV | drives emission factor + fuel logic (EV skips fuel logs) |
| maxLoadCapacityKg | Float, required, > 0 | |
| odometerKm | Float, required, ≥ 0 | updated on trip completion; monotonic (see edge case 6) |
| kmSinceLastServiceKm | Float, computed | odometer − odometer at last closed maintenance |
| serviceIntervalKm | Int, default from settings | |
| acquisitionCost | Float, required, > 0 | ROI denominator |
| region | String | dashboard filter |
| status | AVAILABLE / ON_TRIP / IN_SHOP / RETIRED | state machine Section 6 |
| avgKmPerLiter | Float, computed | trailing 10 completed trips; null until ≥1 |

**Driver**
| Field | Type | Notes |
|---|---|---|
| name | String, required | |
| licenseNumber | String, unique | |
| licenseCategory | Enum: LMV / HMV / TRANS | must be compatible with vehicle type at dispatch (LMV→van/pickup/bike, HMV/TRANS→truck/bus) |
| licenseExpiryDate | Date, required | checked at dispatch time, not creation time |
| contactNumber | String | |
| safetyScore | Int 0–100, default 80 | Safety Officer editable; +1 on clean trip completion, −5 on dispatched-trip cancellation (auto, clamped) |
| status | AVAILABLE / ON_TRIP / OFF_DUTY / SUSPENDED | SUSPENDED settable only by Safety Officer |

**EmissionFactor** — fuelType (unique), kgCo2PerLiter (DIESEL 2.68, PETROL 2.31, CNG 2.02, EV 0), source ("DEFRA 2024"), ADMIN-editable.

### 5.2 Transactional Data

**Trip**
| Field | Type | Notes |
|---|---|---|
| code | String, sequence TR-2026-0001, readonly | |
| source / destination | String, required | |
| vehicleId / driverId | FK, required | validated per Section 7 |
| cargoWeightKg | Float, required, > 0 | must be ≤ vehicle.maxLoadCapacityKg |
| plannedDistanceKm | Float, required, > 0 | |
| revenue | Float, default 0 | Financial Analyst editable; ROI numerator |
| status | DRAFT / DISPATCHED / COMPLETED / CANCELLED | |
| dispatchedAt / completedAt | DateTime | |
| startOdometerKm / endOdometerKm | Float | start = vehicle odometer at dispatch; end entered at completion, must be > start |
| actualDistanceKm | Float, computed | end − start |
| fuelUsedL | Float, entered at completion | feeds the auto-created FuelLog |
| co2Kg | Float, computed stored | fuelUsedL × factor (Innovation #3) |
| idempotencyKey | String, unique nullable | double-click guard |

Partial unique indexes (the concurrency backstop — headline design point):
```sql
CREATE UNIQUE INDEX one_active_trip_per_vehicle ON trips(vehicle_id) WHERE status = 'DISPATCHED';
CREATE UNIQUE INDEX one_active_trip_per_driver  ON trips(driver_id)  WHERE status = 'DISPATCHED';
```
Even a buggy code path physically cannot double-dispatch.

**MaintenanceLog** — vehicleId (FK req), type (SERVICE / REPAIR / INSPECTION), description (req), cost (Float ≥ 0, editable until close), status OPEN → CLOSED, openedAt/closedAt. On create → vehicle auto IN_SHOP; on close → AVAILABLE unless RETIRED. Constraint: one OPEN log per vehicle (partial unique index); cannot open on a vehicle that is ON_TRIP.

**FuelLog** — vehicleId (req), tripId (nullable; auto-created from trip completion), liters (> 0), cost (≥ 0), date, expectedLiters (Float, stored = actualDistance ÷ avgKmPerLiter — stored so the anomaly flag is explainable in demo), deviationPct (computed stored), isAnomaly (Boolean computed stored, Section 9). EV vehicles: fuel logs blocked (ValidationError).

**Expense** — vehicleId (req), tripId (nullable), type TOLL / PARKING / FINE / OTHER, amount (> 0), date, notes.

### 5.3 Supporting Models

**AuditLog** — actorId, action (e.g. TRIP_DISPATCHED), entity, entityId, payload JSON, timestamp. Immutable (no update/delete API). Viewer screen for ADMIN + Fleet Manager.

**Notification** — userId, type (LICENSE_EXPIRING / FUEL_ANOMALY / MAINTENANCE_DUE / TRIP_STATUS / ROLE_ASSIGNED), message, read Boolean, createdAt. Bell dropdown, in-app only (email declared roadmap).

## 6. State Machines (authoritative)
```
Vehicle:  AVAILABLE ⇄ ON_TRIP          (dispatch / complete·cancel — system only, never manual)
          AVAILABLE ⇄ IN_SHOP          (maintenance open / close)
          AVAILABLE | IN_SHOP → RETIRED  (terminal; Fleet Manager only; blocked if ON_TRIP or OPEN maintenance)

Driver:   AVAILABLE ⇄ ON_TRIP          (system only)
          AVAILABLE ⇄ OFF_DUTY         (self/Safety Officer)
          any-but-ON_TRIP ⇄ SUSPENDED  (Safety Officer only)

Trip:     DRAFT → DISPATCHED → COMPLETED
          DRAFT → CANCELLED
          DISPATCHED → CANCELLED       (restores vehicle + driver to AVAILABLE)

Maintenance: OPEN → CLOSED
```
ON_TRIP is never settable via the vehicle/driver update APIs — only trip transitions produce it (enforced in service layer + rejected by Zod schema).

## 7. Mandatory Business Rules — ENFORCEMENT MAP
Every rule enforced in service layer (clean 4xx + message) AND backstopped in DB where possible.

| # | Rule | Service check | DB backstop |
|---|---|---|---|
| 1 | Unique registration number | pre-check | unique constraint |
| 2 | Retired / In Shop never in dispatch pool | eligibility query filters status | partial index blocks active trip only for double-dispatch; status CHECK |
| 3 | Expired license / suspended driver blocked | licenseExpiryDate > now() AND status ≠ SUSPENDED at dispatch time | — |
| 4 | No double-assignment of busy vehicle/driver | row lock + status check in txn | partial unique indexes |
| 5 | Cargo ≤ max load capacity | numeric check | CHECK (cargo > 0) |
| 6 | Dispatch → both statuses ON_TRIP | single transaction | — |
| 7 | Complete → both back to AVAILABLE | single transaction | — |
| 8 | Cancel dispatched → both restored | single transaction | — |
| 9 | Maintenance open → IN_SHOP | maintenance service | one-OPEN-log partial index |
| 10 | Maintenance close → AVAILABLE unless retired | maintenance service | — |

Dispatch transaction (the core function of the entire app):
```sql
BEGIN;
  SELECT * FROM vehicles WHERE id=$1 FOR UPDATE;   -- row locks: concurrent dispatch
  SELECT * FROM drivers  WHERE id=$2 FOR UPDATE;   -- for same pair serializes here
  -- validate: statuses AVAILABLE, license valid & category-compatible, cargo ≤ capacity
  -- idempotencyKey already used? → return the existing trip (200, not duplicate)
  UPDATE trip SET status='DISPATCHED', start_odometer=vehicle.odometer, dispatched_at=now();
  UPDATE vehicle SET status='ON_TRIP'; UPDATE driver SET status='ON_TRIP';
  INSERT audit_log ...;
COMMIT;   -- loser of a race gets 409 CONFLICT with reason
```

## 8. Smart Dispatch Recommendation — EXACT FORMULA (Innovation #1)
`GET /trips/recommendations?cargoWeightKg=&plannedDistanceKm=`
Candidate pool = every (vehicle, driver) pair passing ALL Section 7 eligibility rules. Rank by:
```
score = Wc·capacity_fit + Wf·fuel_efficiency + Wm·maintenance_headroom + Ws·driver_safety
        (weights from Settings, default 35/30/20/15, sum-100 enforced)

capacity_fit         = cargoWeightKg / maxLoadCapacityKg              # closer to 1 = less waste
fuel_efficiency      = avgKmPerLiter / fleet_max_avgKmPerLiter        # fleet avg if no history; EV = 1.0
maintenance_headroom = clamp(1 − kmSinceLastService/serviceInterval, 0, 1)
driver_safety        = safetyScore / 100
```
Return top 3 with per-component breakdown chips ("92% capacity fit · service due in 4,200 km"). Manual override always allowed — it's a recommender, not a gate. Also flag: "⚠ recommended vehicle due for service within planned distance" when headroom × interval < plannedDistanceKm.

## 9. Fuel Anomaly Detection — EXACT RULE (Innovation #2)
On every FuelLog save (manual or auto from trip completion):
```
if vehicle prior fuel logs < anomaly_min_history (3): skip (cold start)
expectedLiters = actualDistanceKm / avgKmPerLiter        # trailing 10 trips
deviationPct   = (liters − expectedLiters) / expectedLiters
isAnomaly      = deviationPct > anomaly_deviation_threshold (0.20)
```
On flag → red badge in fuel list, Financial Analyst dashboard card ("2 suspicious fuel logs this week"), notification, and the stored expectedLiters shown next to actual so the flag is explainable live. Analyst can mark "reviewed – justified" (keeps flag, adds note — never silently deletes evidence).

## 10. Carbon Tracking (Innovation #3)
co2Kg = fuelUsedL × emissionFactor(fuelType) computed at trip completion, stored on trip.
Surfaced: per-trip detail, per-vehicle total in Reports, dashboard KPI "Fleet CO2 this month (±% vs last)", CSV export column. Factors table is ADMIN-editable — pitch line: "configurable emission factors, ESG reporting with zero extra data entry."

## 11. Notifications & Jobs

| Event | Recipients | Trigger |
|---|---|---|
| License expiring (30/60/90d bands) | Safety Officer | daily node-cron + manual "Run check" button for demo |
| License expired with driver still AVAILABLE | Safety Officer | same cron; suggests suspension |
| Fuel anomaly flagged | Financial Analyst | on fuel log save |
| Vehicle service due (kmSinceLastService ≥ interval) | Fleet Manager | on trip completion |
| Trip dispatched / completed / cancelled | Dispatcher | on transition |
| Role assigned / account approved | that user | on admin action |

## 12. Dashboards & UI
Nav: Dashboard · Fleet (Vehicles, Maintenance) · Dispatch (Trips, Drivers, New Trip) · Finance (Fuel, Expenses, Anomalies) · Reports · Admin (Users, Settings, Audit Log) — items hidden per role.

Dashboard:
- KPI cards: Active Vehicles · Available Vehicles · In Maintenance · Active Trips · Pending (Draft) Trips · Drivers On Duty · Fleet Utilization % (= ON_TRIP ÷ non-RETIRED) · Fleet CO2 this month
- Filters: vehicle type, status, region (spec-mandated — don't skip)
- License Expiry Risk widget (Innovation #5): drivers bucketed ≤30 (red) / ≤60 (amber) / ≤90 (yellow) days
- Fuel anomaly alert card · Recent activity feed (from AuditLog)
- "Simulate Day" button (Innovation #4, ADMIN, gated by setting): advances a scripted sequence — dispatches 2 trips, completes 1 with fuel (including the planted anomaly), opens 1 maintenance — with 1s delays so KPIs visibly tick during the demo

Trip form: select cargo + distance → recommendation panel renders top 3 scored pairs → one-click apply → dispatch. A 409 on a race shows "Vehicle was just dispatched by another user" with refreshed pool.

Charts (Recharts): fuel efficiency per vehicle (bar), monthly operational cost (stacked bar: fuel/maintenance/expenses), utilization trend (line), CO2 by vehicle (bar), ROI table (green/red).

## 13. Reports & Analytics
Filters everywhere: date range, vehicle, driver, type, region.

- Fuel Efficiency: km/L per vehicle, fleet average line, worst-5 list
- Fleet Utilization: current % + 30-day trend
- Operational Cost per vehicle: fuel + maintenance + expenses, monthly breakdown
- Vehicle ROI: exactly (revenue − (maintenance + fuel)) ÷ acquisitionCost — verbatim spec formula, hand-verify one vehicle before demo
- Carbon Report: CO2 per vehicle/month, fleet total
- CSV export on every report: streaming GET /reports/:name/export?filters... (PDF = documented roadmap)

## 14. Innovations (differentiators — ALL in scope)
1. Smart Dispatch Recommendation (Section 8) — configurable-weight scoring engine
2. Fuel Fraud / Anomaly Detection (Section 9) — with planted demo anomaly
3. Carbon per Trip + fleet ESG view (Section 10)
4. Simulate Day live demo mode (Section 12)
5. License Expiry Risk widget + daily cron (Section 11)
6. Live concurrency demo: scripts/concurrencyDemo.ts fires 2 simultaneous dispatches for one vehicle → prints ✅ TR-2026-0031 dispatched / 🛑 409 vehicle already on trip. The mic-drop closer.
7. k6 load test (loadtest.k6.js: 200 VUs login + dashboard) — results chart committed to README
8. Immutable Audit Log + viewer — "who did what, when" (industry compliance standard)
9. Auto safety-score adjustment (+1 clean completion / −5 dispatched-cancellation) — the score becomes a living metric, not a static field
10. ARCHITECTURE.md with scale trade-off table (JWT/pooling now → replicas + Redis KPI cache + outbox events later; modular monolith defended over microservices)

## 15. Seed & Demo Data (critical for judging)
Committed prisma/seed.ts, idempotent:
- Users: 1 per role + 1 pending signup (shows the approval flow)
- Vehicles (12): mixed types/fuel/regions incl. 1 RETIRED, 2 IN_SHOP (with open logs), 1 EV, 1 at 9,800/10,000 km since service (recommendation demo), varied acquisition costs
- Drivers (10): 1 expired license, 1 SUSPENDED, 1 expiring in 12 days (red widget), safety scores 55–98
- Trips (30, across 3 months): completed with odometer/fuel/revenue so efficiency, ROI, CO2 and utilization charts are alive; 2 DISPATCHED; 2 DRAFT
- Planted fuel anomaly: Van-03, expected 40 L, logged 58 L (+45%) → flag fires on first dashboard load
- Fuel logs, tolls/fines/expenses, closed maintenance history, emission factors, default settings

## 16. Edge Cases & Validations (must handle)
- Cargo > capacity → 422 with both numbers in message
- License expires between draft creation and dispatch → dispatch re-validates and blocks
- Driver suspended / vehicle sent to shop after draft created → same re-validation at dispatch
- Concurrent dispatch of same vehicle/driver → row lock; loser gets 409 (never a 500)
- Double-clicked dispatch → idempotency key returns the same trip, no duplicate
- Trip completion: endOdometer ≤ startOdometer → blocked; vehicle odometer only moves forward
- Retire vehicle while ON_TRIP or with OPEN maintenance → blocked with reason
- Open maintenance on ON_TRIP vehicle → blocked ("complete or cancel trip first")
- Second OPEN maintenance on same vehicle → blocked (partial index)
- Fuel log on EV → blocked; EV skips anomaly + efficiency, CO2 = 0
- Anomaly engine with < 3 prior logs → silently skipped (no false positives on new vehicles)
- ROI/efficiency division-by-zero (no fuel, zero cost) → guarded, renders "—"
- Cancelling DRAFT (never dispatched) → no status restoration side-effects
- Weights not summing 100 in settings → 422
- Negative/zero liters, cost, cargo, capacity → Zod + CHECK constraints
- Manual status APIs attempting ON_TRIP → rejected (system-only transition)
- All list endpoints paginated (default 20) + indexed on status/date/FK columns

## 17. Build Order (member-mapped for the hourly-commit rule)

| Phase | M1 (integration lead) | M2 (fleet) | M3 (dispatch) | M4 (finance) |
|---|---|---|---|---|
| H0–1 (together) | Freeze schema.prisma, Kiro steering files, folder skeleton, ARCHITECTURE.md stub — everyone's first commit | ← | ← | ← |
| H1–2 | Auth + JWT + RBAC middleware + seed v1 | Vehicle CRUD + views | Driver CRUD + license category logic | Fuel/Expense CRUD |
| H2–3.5 | Notifications + audit log + settings | Maintenance workflow + auto IN_SHOP | Dispatch transaction + state machines + all 10 rules | expected-liters + anomaly engine |
| H3.5–5 | Dashboard KPIs + filters + license widget | Vehicle detail (history, service-due) | Recommendation engine + trip form UI | Reports + charts + CSV + carbon |
| H5–6 | Simulate Day + seed v2 (planted anomaly) | Retire flow + edge cases | Concurrency script + idempotency | ROI verification + anomaly review UI |
| H6–7 (together) | k6 run + README + full flow test (Section 18) + demo script rehearsal | ← | ← | ← |

Rules: feature branches per member, commit every completed function (:50 timer as checkpoint), merge to main every ~90 min via MR, only M1 touches schema after H1.

## 18. Acceptance Checklist (definition of done)
- [ ] Fresh clone → npm i && prisma db push && seed && dev runs with zero console errors
- [ ] Signup creates roleless account; only ADMIN assigns roles; each role sees only its nav
- [ ] All 10 mandatory rules verifiably block/transition (walk spec Steps 1–9 end-to-end)
- [ ] Concurrency script: exactly one of two simultaneous dispatches succeeds, loser gets clean 409
- [ ] Double-click dispatch produces exactly one trip (idempotency)
- [ ] Expired-license and suspended drivers absent from dispatch pool; expiring-in-12-days driver shows red in widget
- [ ] Recommendation top-3 renders with breakdown; weights editable in settings and sum-100 enforced
- [ ] Planted anomaly flagged with expected-vs-actual visible; analyst can mark reviewed
- [ ] ROI matches hand calculation for one vehicle; CO2 = fuel × factor verified
- [ ] Dashboard filters (type/status/region) work; KPIs update live during Simulate Day
- [ ] Every report exports CSV honoring filters
- [ ] Audit log captures every state change with actor + timestamp
- [ ] k6 results (target: 200 VUs, p95 < 300 ms) charted in README; ARCHITECTURE.md trade-off table complete
- [ ] Responsive at 375 px width on dashboard, trip form, and lists