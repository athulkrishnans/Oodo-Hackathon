// src/shared/notify.ts
// In-app notification helper — creates Notification rows.
// Email is documented roadmap (Section 11), not built.
// Used by: dispatch (trip status), fleet (maintenance due), finance (anomaly), jobs (license expiry).

import { NotificationType, Role } from '@prisma/client';
import { prisma } from './prisma';

interface NotifyPayload {
  userId: string;
  type: NotificationType;
  message: string;
}

export const notify = {
  async send(payload: NotifyPayload): Promise<void> {
    await prisma.notification.create({
      data: {
        userId: payload.userId,
        type: payload.type,
        message: payload.message,
      },
    });
  },

  // Fan out a notification to every ACTIVE user holding a given role.
  async sendToRole(role: Role, type: NotificationType, message: string): Promise<void> {
    const users = await prisma.user.findMany({
      where: { role, status: 'ACTIVE' },
      select: { id: true },
    });
    if (users.length === 0) return;
    await prisma.notification.createMany({
      data: users.map((u) => ({ userId: u.id, type, message })),
    });
  },
};
