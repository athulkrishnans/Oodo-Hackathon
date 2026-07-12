# Tech — TransitOps

## Stack (do not deviate — Kiro should never suggest an alternative library for these)
| Layer | Choice |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind + shadcn/ui + Recharts |
| Backend | Node.js + Express + TypeScript — single modular monolith |
| ORM | Prisma |
| Database | PostgreSQL via Supabase (pooled) |
| Auth | JWT, 15-min access token, bcrypt (cost 10), stateless |
| Validation | Zod — schemas shared FE/BE, single source of truth for shapes |
| Exports | CSV via streaming endpoint (PDF is documented roadmap, not built) |

## Deliberately rejected — if Kiro suggests these, decline and point back here
- **Microservices** — overkill at this scale. Modular monolith with an extractable dispatch module is the defended answer in ARCHITECTURE.md.
- **Redis** — Postgres is sufficient now; documented as a future scaling step, not built.
- **NoSQL** — dispatch correctness requires ACID transactions and row locks.

## Non-negotiable implementation details
- Concurrency safety comes from `SELECT ... FOR UPDATE` row locks inside the dispatch transaction, backstopped by partial unique indexes:
  ```sql
  CREATE UNIQUE INDEX one_active_trip_per_vehicle ON trips(vehicle_id) WHERE status = 'DISPATCHED';
  CREATE UNIQUE INDEX one_active_trip_per_driver  ON trips(driver_id)  WHERE status = 'DISPATCHED';
  ```
- Every state-changing action writes an immutable `AuditLog` row (no update/delete API on it).
- Rate limit `/auth/*` to 10 req/min/IP.
- All list endpoints are paginated (default 20) and indexed on status/date/FK columns.
- Fully offline-demoable — no external API calls anywhere in the app.

## Load testing
`scripts/loadtest.k6.js` — 200 VUs, login + dashboard flow, target p95 < 300ms. Results get charted into the README, not just run and discarded.