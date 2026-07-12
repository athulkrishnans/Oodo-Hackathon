# Structure & Ownership — TransitOps

## Folder structure (frozen after Hour 1 — only M1 touches `prisma/schema.prisma` after that point)
```
transitops/
├── prisma/schema.prisma + seed.ts        # FROZEN after hour 1
├── src/
│   ├── server.ts
│   ├── middleware/ (auth.ts, rbac.ts, rateLimit.ts, idempotency.ts, errors.ts)
│   ├── modules/                          # one folder per member — NO cross-editing
│   │   ├── auth/       (routes, service)          → M1
│   │   ├── fleet/      (vehicles, maintenance)      → M2
│   │   ├── dispatch/   (drivers, trips, recommendation) → M3
│   │   └── finance/    (fuel, expenses, reports, carbon) → M4
│   ├── shared/ (stateMachines.ts, auditLog.ts, notify.ts, zodSchemas.ts)
│   └── jobs/licenseExpiry.ts             # node-cron daily + manual trigger
├── web/src/ (pages per module, components, api client, charts)
├── scripts/ (concurrencyDemo.ts, simulateDay.ts, loadtest.k6.js)
├── ARCHITECTURE.md                       # trade-off table, graded artifact
└── .kiro/steering/                       # this folder
```

## Rule: no cross-editing
Each member owns one folder under `src/modules/`. If your feature needs something from another member's module (e.g. dispatch needs vehicle availability), import their exported service functions — never edit their files directly. Flag it in the shared channel and let them expose what you need.

## Git discipline
- Feature branches per member: `feature/m{1-4}-{module}-{short-feature-name}`
- Commit every completed function — the `:50` mark each hour is a checkpoint, not a deadline
- Merge to `main` via MR roughly every 90 minutes
- Only M1 touches `schema.prisma` after Hour 1 — if you need a field added, ask M1, don't edit it yourself

## Build order (hour-mapped — see individual member scripts for exact prompts)
| Phase | M1 | M2 | M3 | M4 |
|---|---|---|---|---|
| H0–1 (together) | Freeze schema, steering, skeleton, ARCHITECTURE.md stub | ← | ← | ← |
| H1–2 | Auth + JWT + RBAC + seed v1 | Vehicle CRUD + views | Driver CRUD + license logic | Fuel/Expense CRUD |
| H2–3.5 | Notifications + audit log + settings | Maintenance workflow + auto IN_SHOP | Dispatch transaction + state machines + 10 rules | expected-liters + anomaly engine |
| H3.5–5 | Dashboard KPIs + filters + license widget | Vehicle detail (history, service-due) | Recommendation engine + trip form UI | Reports + charts + CSV + carbon |
| H5–6 | Simulate Day + seed v2 (planted anomaly) | Retire flow + edge cases | Concurrency script + idempotency | ROI verification + anomaly review UI |
| H6–7 (together) | k6 run + README + full flow test + demo rehearsal | ← | ← | ← |