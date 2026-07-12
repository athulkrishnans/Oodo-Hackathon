// src/modules/admin/service.ts — M1 owns this file
// Cross-cutting admin concerns (BUILD_BIBLE Section 4 settings, Section 11 notifications,
// Section 14 #8 immutable audit-log viewer). Emission factors live in the finance module.

import { Prisma, Notification, AuditLog } from '@prisma/client';
import { prisma } from '../../shared/prisma';
import { AppError } from '../../middleware/errors';
import { auditLog } from '../../shared/auditLog';
import {
  getSettings,
  AppSettings,
  SETTING_FIELD_TO_KEY,
} from '../../shared/settings';
import type { PaginationQuery } from '../../shared/zodSchemas';

type SettingsUpdate = Partial<AppSettings>;

export const adminService = {
  // GET /settings — full, defaults-merged settings object (Section 4).
  async getSettings(): Promise<AppSettings> {
    return getSettings();
  },

  // PUT /settings — upsert provided keys. Dispatch weights must sum to 100 (Section 4 / Section 16).
  async updateSettings(input: SettingsUpdate, actorId: string): Promise<AppSettings> {
    const current = await getSettings();
    const merged: AppSettings = { ...current };
    const mergedRecord = merged as unknown as Record<string, unknown>;
    for (const [k, v] of Object.entries(input)) {
      if (v !== undefined) mergedRecord[k] = v;
    }

    const weightSum =
      merged.dispatchWeightCapacity +
      merged.dispatchWeightFuel +
      merged.dispatchWeightMaintenance +
      merged.dispatchWeightSafety;
    if (weightSum !== 100) {
      throw new AppError(
        422,
        'settings/weights-must-sum-100',
        `Dispatch weights must sum to 100 (got ${weightSum})`,
      );
    }

    for (const [field, value] of Object.entries(input)) {
      if (value === undefined) continue;
      const key = SETTING_FIELD_TO_KEY[field as keyof AppSettings];
      if (!key) continue;
      const serialized = JSON.stringify(value);
      await prisma.setting.upsert({
        where: { key },
        update: { value: serialized },
        create: { key, value: serialized },
      });
    }

    await auditLog.write({
      actorId,
      action: 'SETTINGS_UPDATED',
      entity: 'Setting',
      entityId: 'settings',
      payload: { ...input },
    });
    return getSettings();
  },

  // ── Notifications (Section 11 — in-app bell) ──
  async listNotifications(
    userId: string,
    query: PaginationQuery & { unreadOnly?: boolean },
  ): Promise<{ items: Notification[]; total: number; unreadCount: number }> {
    const { page, limit, unreadOnly } = query;
    const where: Prisma.NotificationWhereInput = { userId };
    if (unreadOnly) where.read = false;

    const [items, total, unreadCount] = await prisma.$transaction([
      prisma.notification.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, read: false } }),
    ]);
    return { items, total, unreadCount };
  },

  async markNotificationRead(id: string, userId: string): Promise<Notification> {
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== userId) {
      throw new AppError(404, 'admin/notification-not-found', 'Notification not found');
    }
    return prisma.notification.update({ where: { id }, data: { read: true } });
  },

  async markAllNotificationsRead(userId: string): Promise<{ updated: number }> {
    const result = await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return { updated: result.count };
  },

  // ── Audit log viewer (Section 14 #8 — read-only, immutable) ──
  async listAuditLogs(
    query: PaginationQuery & { entity?: string; actorId?: string },
  ): Promise<{ items: AuditLog[]; total: number }> {
    const { page, limit, entity, actorId } = query;
    const where: Prisma.AuditLogWhereInput = {};
    if (entity) where.entity = entity;
    if (actorId) where.actorId = actorId;

    const [items, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: { actor: { select: { name: true, email: true, role: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);
    return { items, total };
  },
};
