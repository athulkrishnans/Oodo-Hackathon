# TransitOps — Architecture

> **This document is a graded artifact (Section 14, item 10).**
> Complete the trade-off narrative and scale-out section before the H6–7 demo rehearsal.

---

## Section 2 — Tech Stack Trade-offs

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

**Deliberately rejected:**
- **Microservices** — overkill at this scale. The modular monolith (`src/modules/`) has clean boundaries; the dispatch module is extractable if load demands it. Coordination overhead (service discovery, distributed tracing, cross-service transactions) would consume the entire hackathon and add failure modes without benefit.
- **Redis** — Postgres connection pooling (Supabase pgBouncer) handles the current load profile. Redis is the documented next step for KPI caching and session invalidation.
- **NoSQL** — the dispatch transaction (`SELECT FOR UPDATE` + partial unique indexes) requires ACID guarantees. Document or key-value stores would force application-level locking with no reliability gain.

---

## Section 14, Item 10 — Scale Trade-off Table

What "now" looks like vs. what "later" would require:

| Concern | Now (hackathon / MVP) | Later (production scale) |
|---|---|---|
| Auth | Stateless JWT, 15-min expiry, bcrypt cost 10 | Add refresh-token rotation + Redis blocklist for instant revocation |
| DB connections | Supabase pooled (pgBouncer, connection_limit=1 per serverless fn) | Dedicated connection pool (PgBouncer sidecar or RDS Proxy); read replicas for analytics queries |
| KPI dashboard | Per-request aggregation queries | Materialized views refreshed on write; Redis cache for p95 < 50 ms at 1 k+ vehicles |
| Dispatch concurrency | `SELECT FOR UPDATE` row locks + partial unique indexes | Same model scales to ~500 dispatchers; beyond that, optimistic locking + event sourcing |
| Audit log | Synchronous write in same transaction | Outbox pattern → async fan-out (Kafka/SQS) so audit never blocks the hot path |
| Notifications | Synchronous DB insert | WebSocket push (Socket.io) or SSE for real-time bell updates; push notifications via FCM roadmap |
| Jobs | Single node-cron process | Distributed job queue (BullMQ over Redis) with at-least-once delivery guarantee |
| Module boundaries | Shared Prisma client, in-process function calls | Extract dispatch module to its own service behind an internal API if CPU/memory contention appears |
| Reporting / CSV | On-request query + stream | Pre-aggregated OLAP tables or a read replica dedicated to analytics; background job for large exports |
| Load test baseline | 200 VUs, p95 < 300 ms (k6, see README) | Target 2 k VUs p95 < 200 ms with connection pooling + read replicas in place |

---

## Module ownership map

| Module | Owner | Folder |
|---|---|---|
| Auth + RBAC + seed + dashboard + jobs | M1 | `src/modules/auth/` + `src/jobs/` |
| Fleet (vehicles, maintenance) | M2 | `src/modules/fleet/` |
| Dispatch (drivers, trips, recommendations) | M3 | `src/modules/dispatch/` |
| Finance (fuel, expenses, reports, carbon) | M4 | `src/modules/finance/` |

No cross-editing of module folders. Cross-module needs go through exported service functions or shared utilities in `src/shared/`.

---

---

## Partial unique indexes — why they're raw SQL

Three indexes exist only as a Prisma migration (`prisma/migrations/20260712132334_add_partial_unique_indexes/migration.sql`) and **not** in `schema.prisma`, because Prisma's schema language cannot express `WHERE`-clause partial indexes:

| Index name | Table | Condition | Rule enforced |
|---|---|---|---|
| `one_active_trip_per_vehicle` | `trips` | `WHERE status = 'DISPATCHED'` | Section 7 Rule #4 — no double-dispatch of a vehicle |
| `one_active_trip_per_driver` | `trips` | `WHERE status = 'DISPATCHED'` | Section 7 Rule #4 — no double-dispatch of a driver |
| `one_open_maintenance_per_vehicle` | `maintenance_logs` | `WHERE status = 'OPEN'` | Section 7 Rule #9 — one open maintenance log per vehicle |

**If you run `prisma migrate reset`:** Prisma replays all migrations in order, so these indexes will be re-created automatically from the migration file. No manual intervention needed after a reset.

---

*TODO (complete before H6–7 demo): add sequence diagram for the dispatch transaction, and document the concurrency test results from `scripts/concurrencyDemo.ts`.*
