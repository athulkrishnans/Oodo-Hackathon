// src/shared/notify.ts
// In-app notification helper — creates Notification rows.
// Email is documented roadmap (Section 11), not built.
// Used by: dispatch (trip status), fleet (maintenance due), finance (anomaly), jobs (license expiry).

import { PrismaClient, NotificationType } from '@prisma/client';

const prisma = new PrismaClient();

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

  // Convenience: notify all users with a given role
  async sendToRole(_role: string, type: NotificationType, message: string): Promise<void> {
    // TODO: query users by role, fan out notification rows
    void _role; void type; void message;
  },
};
