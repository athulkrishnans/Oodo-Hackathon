# Conventions — TransitOps

This is the file that makes 4 people's code look like it came from 1 person. Every module follows this exactly, no per-module variation.

## API response envelope (every endpoint, every module)
```ts
// success
{ success: true, data: T, meta?: { page, limit, total } }

// failure
{ success: false, error: { code: string, message: string, details?: unknown } }
```
Use a shared `ApiResponse<T>` type from `src/shared/types.ts`. Never return raw Prisma objects or bare arrays.

## HTTP status codes
- `200` OK / `201` Created
- `400` malformed request (bad JSON, missing required field)
- `401` unauthenticated / `403` wrong role
- `404` not found
- `409` conflict (lost a row-lock race, e.g. double dispatch)
- `422` validation failure (Zod rejects, business rule rejects — e.g. cargo > capacity, weights not summing to 100)
- `500` only for genuinely unexpected errors — a 500 during a demo is a bug, not a valid business-rule response

## Error codes (stable strings the frontend switches on, e.g. for the 409 dispatch race)
`kebab-case`, module-prefixed: `dispatch/vehicle-already-assigned`, `fleet/duplicate-registration`, `finance/ev-no-fuel-log`. Add new ones here as you create them so nobody collides.

## Naming
- TS/JSON fields: `camelCase`
- Prisma models & enums: `PascalCase`
- File names: `kebab-case.ts`, except React components: `PascalCase.tsx`
- Route paths: `/api/v1/{plural-resource}` — e.g. `/api/v1/vehicles`, `/api/v1/trips/:id/dispatch`

## Validation
Every mutating endpoint validates with a Zod schema from `src/shared/zodSchemas.ts`, imported by both the Express route and the frontend form. Never hand-roll a second copy of a shape.

## Auth & RBAC
- `Authorization: Bearer <jwt>` on every request except `/auth/login` and `/auth/signup`
- `requireRole('FLEET_MANAGER', 'ADMIN')` middleware on writes, applied at the route level, not buried in service logic
- Never trust `role` from the request body — always from the verified JWT claim

## Audit log
Any service function that changes state ends with:
```ts
await auditLog.write({ actorId, action: 'TRIP_DISPATCHED', entity: 'Trip', entityId, payload });
```
Action names are `SCREAMING_SNAKE_CASE`, past tense.

## Pagination
Every list endpoint: `?page=1&limit=20` (default limit 20), response `meta: { page, limit, total }`.

## Transactions
Anything touching 2+ models atomically (dispatch, complete, cancel, maintenance open/close) goes through a single `prisma.$transaction(...)` — never sequential awaited calls that could partially fail.

## Kiro prompt discipline
When prompting Kiro inside your module, reference the exact section number of `BUILD_BIBLE.md` you're implementing (e.g. "Section 7, rule 4" or "Section 9"). This keeps Kiro's output traceable to spec instead of improvising a shape that drifts from what the other 3 modules expect.