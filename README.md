# TransitOps — Smart Transport Operations Platform

A centralized fleet operations platform that replaces spreadsheets and paper logbooks. It manages
the full lifecycle of vehicles, drivers, trips, maintenance, fuel and expenses, and enforces **10
mandatory business rules transactionally** — correct even under simultaneous dispatchers.

Built with a React + Node/TypeScript + PostgreSQL stack. Fully offline-demoable (no external APIs).

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind + Recharts |
| Backend | Node.js + Express + TypeScript (modular monolith) |
| ORM | Prisma |
| Database | PostgreSQL (Supabase, pooled) |
| Auth | JWT (15-min access token) + bcrypt (cost 10), stateless |
| Validation | Zod (shared shapes) |

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the trade-off table and scale-out plan.

---

## Prerequisites

- Node.js 20+
- A PostgreSQL database (Supabase project or any Postgres 14+)

## Setup

```bash
# 1. Install backend deps
npm install

# 2. Configure environment — copy the example and fill in your connection strings
copy .env.example .env        # Windows
# cp .env.example .env        # macOS/Linux
```

Set in `.env`:
- `DATABASE_URL` — pooled connection (Supabase transaction pooler, port 6543, `?pgbouncer=true`)
- `DIRECT_URL` — direct/session connection (port 5432), used for migrations
- `JWT_SECRET` — any 32+ char random string

> If your DB password contains reserved URL characters (`@`, `:`, `/`), URL-encode them
> (e.g. `@` → `%40`).

```bash
# 3. Create the schema
npm run db:push

# 4. Apply the partial unique indexes (the concurrency backstop — not expressible in schema.prisma)
npx prisma db execute --file prisma/migrations/manual_partial_indexes.sql --schema prisma/schema.prisma

# 5. Seed demo data (idempotent — safe to re-run)
npm run db:seed

# 6. Run the API (http://localhost:3000)
npm run dev
```

Frontend:

```bash
cd web
npm install
npm run dev        # http://localhost:5173 (proxies /api → :3000)
```

## Demo credentials

All seeded users share the password **`password123`**:

| Email | Role |
|---|---|
| `admin@transitops.dev` | ADMIN |
| `fleet@transitops.dev` | FLEET_MANAGER |
| `dispatcher@transitops.dev` | DISPATCHER |
| `safety@transitops.dev` | SAFETY_OFFICER |
| `finance@transitops.dev` | FINANCIAL_ANALYST |
| `pending@transitops.dev` | (pending — no role, awaiting admin approval) |

---

## The 10 mandatory business rules

1. Unique vehicle registration number
2. Retired / In-Shop vehicles never enter the dispatch pool
3. Expired-license or suspended driver blocked **at dispatch time**
4. No double-assignment of a busy vehicle or driver (row lock + partial unique index backstop)
5. Cargo weight ≤ vehicle max load capacity
6. Dispatch → vehicle AND driver both flip to ON_TRIP, in one transaction
7. Complete → both restored to AVAILABLE, in one transaction
8. Cancel a dispatched trip → both restored, in one transaction
9. Opening maintenance → vehicle auto IN_SHOP
10. Closing maintenance → vehicle AVAILABLE unless RETIRED

## The differentiators

- **Smart Dispatch Recommendation** — configurable-weight scoring engine over eligible vehicle/driver pairs (`GET /api/v1/trips/recommendations`).
- **Fuel Anomaly Detection** — flags fuel logs deviating > 20% from a vehicle's rolling history; explainable (expected vs actual stored).
- **Carbon per Trip** — CO₂ = fuelUsedL × emissionFactor(fuelType), stored at completion.
- **Simulate Day** — scripted live demo that ticks KPIs (admin button / `scripts/simulateDay.ts`).
- **Immutable Audit Log**, **License Expiry Risk widget + daily cron**, and a **live concurrency demo**.

---

## Demo scripts

```bash
# Concurrency mic-drop: 2 simultaneous dispatches for one vehicle → exactly one wins
npx tsx scripts/concurrencyDemo.ts

# Simulate Day: dispatch 2, complete 1 (fuel anomaly), open 1 maintenance — with 1s pauses
npx tsx scripts/simulateDay.ts
```

Verified concurrency output:

```
Contenders: vehicle VAN-01 + driver Deepak Nair
✅ TR-2026-0032 dispatched
🛑 TR-2026-0033 rejected → 409 dispatch/vehicle-already-assigned
Exactly one winner? YES ✅
```

---

## Load test (k6)

```bash
# Requires k6 (https://k6.io/docs/get-started/installation/). Start the API first.
k6 run scripts/loadtest.k6.js
```

Target: **200 VUs**, login + dashboard flow, **p95 < 300 ms**, error rate < 1%.

> **Results:** run the command above against a running instance to populate this table.
> k6 was not installed in the build environment, so live numbers are pending an on-machine run.

| Metric | Target | Result |
|---|---|---|
| Virtual users | 200 | _run k6_ |
| p95 request duration | < 300 ms | _run k6_ |
| Error rate | < 1% | _run k6_ |

---

## Verified against the acceptance checklist

The following were verified against the live database during the build:

- Fresh `db:push` + indexes + `db:seed` + `dev` runs with zero console errors.
- Signup creates a roleless account; only ADMIN assigns roles; nav is role-scoped.
- Dispatch flips vehicle + driver to ON_TRIP in one transaction; complete/cancel restore them.
- Concurrency: exactly one of two simultaneous dispatches succeeds; the loser gets a clean 409.
- Double-click dispatch is idempotent (same `Idempotency-Key` returns the same trip).
- Cargo > capacity → 422; expired/suspended drivers blocked at dispatch.
- Recommendation returns top-3 with breakdown; settings weights enforced to sum 100.
- Planted anomaly (VAN-03, 58 L vs 40 L expected) flagged with expected-vs-actual visible.
- ROI matches the verbatim formula `(revenue − (maintenance + fuel)) ÷ acquisitionCost`.
- CO₂ = fuel × emission factor verified (40 L diesel → 107.2 kg).
- Every report exports CSV; audit log captures state changes with actor + timestamp.

## API surface (all under `/api/v1`, envelope `{ success, data, meta? }`)

- **auth**: `POST /auth/signup`, `POST /auth/login`, `GET /auth/me`
- **users** (ADMIN): `GET /users`, `PATCH /users/:id/role`, `PATCH /users/:id/status`
- **fleet**: `GET|POST /vehicles`, `GET|PATCH /vehicles/:id`, `POST /vehicles/:id/retire`, `GET|POST /maintenance-logs`, `POST /maintenance-logs/:id/close`
- **dispatch**: `GET|POST /drivers`, `GET|PUT /drivers/:id`, `GET /trips/recommendations`, `GET|POST /trips`, `GET /trips/:id`, `POST /trips/:id/{dispatch,complete,cancel}`
- **finance**: `GET|POST /fuel-logs`, `GET /fuel-logs/anomalies`, `POST /fuel-logs/:id/review`, `GET|POST /expenses`, `PATCH /trips/:id/revenue`, `GET /emission-factors`, `PUT /emission-factors/:id`, `GET /reports/{fuel-efficiency,utilization,operational-cost,roi,carbon}`, `GET /reports/:name/export`
- **admin**: `GET|PUT /settings`, `GET /notifications`, `PATCH /notifications/:id/read`, `POST /notifications/read-all`, `GET /audit-logs`, `POST /jobs/license-expiry-check`, `POST /jobs/simulate-day`
