# Product — TransitOps

TransitOps is a centralized fleet operations platform replacing spreadsheets/paper logbooks. It manages the full lifecycle of vehicles, drivers, trips, maintenance, fuel, and expenses, and enforces 10 mandatory business rules transactionally — correct even under simultaneous dispatchers.

## Who uses it (RBAC — 5 roles)
- **ADMIN** — everything + user management, settings, emission factors. Seeded only, never self-assigned.
- **FLEET_MANAGER** — vehicle CRUD, maintenance open/close, retire vehicles, all analytics.
- **DISPATCHER** — trip create/dispatch/complete/cancel, view fleet availability.
- **SAFETY_OFFICER** — driver CRUD, suspend/reinstate drivers, safety scores, license expiry dashboard.
- **FINANCIAL_ANALYST** — fuel/expense CRUD, revenue entry, reports + exports, anomaly review.

Signup creates a **pending, roleless** account. Only ADMIN assigns roles. All roles read the dashboard; writes are role-scoped via `requireRole(...)` middleware.

## The 10 mandatory rules (never negotiable — every module must respect these)
1. Unique vehicle registration number
2. Retired / In-Shop vehicles never enter the dispatch pool
3. Expired license or suspended driver blocked at dispatch time (not creation time)
4. No double-assignment of a busy vehicle or driver (row lock + partial unique index backstop)
5. Cargo weight ≤ vehicle max load capacity
6. Dispatch → vehicle AND driver both flip to ON_TRIP, in one transaction
7. Complete → both restored to AVAILABLE, in one transaction
8. Cancel a dispatched trip → both restored, in one transaction
9. Opening maintenance → vehicle auto IN_SHOP
10. Closing maintenance → vehicle AVAILABLE unless RETIRED

`ON_TRIP` is a system-only status — never settable through a manual vehicle/driver update API, on any module.

## The 3 differentiators (don't build these as afterthoughts — they're the pitch)
- **Smart Dispatch Recommendation**: configurable-weight scoring engine over eligible vehicle/driver pairs.
- **Fuel Anomaly Detection**: flags fuel logs deviating >20% from a vehicle's rolling history.
- **Carbon per Trip**: CO2 = fuelUsedL × emissionFactor(fuelType), stored at trip completion.

Full formulas, edge cases, and field-level specs live in `BUILD_BIBLE.md` at the repo root — that document is the single source of truth. If Kiro ever proposes something that contradicts it, the bible wins.