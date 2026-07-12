// src/shared/auditLog.ts
// Every service function that changes state calls auditLog.write().
// Immutable — no update or delete API exists on AuditLog.
// Convention: action names are SCREAMING_SNAKE_CASE, past tense.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuditLogEntry {
  actorId: string;
  action: string;   // e.g. TRIP_DISPATCHED
  entity: string;   // model name e.g. 'Trip'
  entityId: string;
  payload: Record<string, unknown>;
}

export const auditLog = {
  async write(entry: AuditLogEntry): Promise<void> {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        payload: entry.payload,
      },
    });
  },
};
