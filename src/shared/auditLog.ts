// src/shared/auditLog.ts
// Every service function that changes state calls auditLog.write().
// Immutable — no update or delete API exists on AuditLog.
// Convention: action names are SCREAMING_SNAKE_CASE, past tense.

import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

interface AuditLogEntry {
  actorId: string;
  action: string;   // e.g. TRIP_DISPATCHED
  entity: string;   // model name e.g. 'Trip'
  entityId: string;
  payload: Record<string, unknown>;
  // Optional transaction client — pass the tx handle so the audit row
  // commits/rolls back atomically with the state change (dispatch, complete, etc.).
  tx?: Prisma.TransactionClient;
}

export const auditLog = {
  async write(entry: AuditLogEntry): Promise<void> {
    const client = entry.tx ?? prisma;
    await client.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        payload: entry.payload as Prisma.InputJsonValue,
      },
    });
  },
};
