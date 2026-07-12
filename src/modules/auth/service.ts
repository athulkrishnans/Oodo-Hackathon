// src/modules/auth/service.ts — M1 owns this file
// Auth + user management — BUILD_BIBLE Section 3 (RBAC).
// Signup creates a roleless (pending) ACTIVE account; only ADMIN assigns roles.
// JWT is a 15-min stateless access token (Section 2); passwords hashed with bcrypt cost 10.

import bcrypt from 'bcryptjs';
import { Prisma, Role, User } from '@prisma/client';
import { prisma } from '../../shared/prisma';
import { AppError } from '../../middleware/errors';
import { signAccessToken } from '../../middleware/auth';
import { auditLog } from '../../shared/auditLog';
import { notify } from '../../shared/notify';
import type { PaginationQuery } from '../../shared/zodSchemas';

const BCRYPT_COST = 10;

// Public shape — never leak passwordHash.
export type SafeUser = Pick<User, 'id' | 'email' | 'name' | 'role' | 'status' | 'createdAt'>;

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export const authService = {
  // POST /auth/signup — roleless, ACTIVE, pending approval. No token issued.
  async signup(input: { email: string; password: string; name: string }): Promise<SafeUser> {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new AppError(409, 'auth/email-taken', 'An account with this email already exists');
    }
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
    const user = await prisma.user.create({
      data: { email: input.email, name: input.name, passwordHash, role: null, status: 'ACTIVE' },
      select: SAFE_USER_SELECT,
    });
    await auditLog.write({
      actorId: user.id,
      action: 'USER_SIGNED_UP',
      entity: 'User',
      entityId: user.id,
      payload: { email: user.email, name: user.name },
    });
    return user;
  },

  // POST /auth/login — returns access token + safe user. INACTIVE cannot log in.
  async login(input: { email: string; password: string }): Promise<{ accessToken: string; user: SafeUser }> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    // Generic message — never reveal whether the email exists (credential-stuffing defence).
    if (!user) {
      throw new AppError(401, 'auth/invalid-credentials', 'Invalid email or password');
    }
    if (user.status === 'INACTIVE') {
      throw new AppError(403, 'auth/account-inactive', 'This account is inactive');
    }
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) {
      throw new AppError(401, 'auth/invalid-credentials', 'Invalid email or password');
    }
    const accessToken = signAccessToken({ sub: user.id, role: user.role, email: user.email });
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
      },
    };
  },

  // GET /auth/me — fresh role/status straight from DB (token may be stale after role assignment).
  async me(userId: string): Promise<SafeUser> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: SAFE_USER_SELECT });
    if (!user) {
      throw new AppError(404, 'auth/user-not-found', 'User not found');
    }
    return user;
  },

  // GET /users — ADMIN user management, paginated.
  async listUsers(query: PaginationQuery): Promise<{ items: SafeUser[]; total: number }> {
    const { page, limit } = query;
    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({
        select: SAFE_USER_SELECT,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count(),
    ]);
    return { items, total };
  },

  // PATCH /users/:id/role — ADMIN assigns a role (also approves a pending account).
  async assignRole(adminId: string, targetUserId: string, role: Role): Promise<SafeUser> {
    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) {
      throw new AppError(404, 'auth/user-not-found', 'User not found');
    }
    const user = await prisma.user.update({
      where: { id: targetUserId },
      data: { role },
      select: SAFE_USER_SELECT,
    });
    await auditLog.write({
      actorId: adminId,
      action: 'ROLE_ASSIGNED',
      entity: 'User',
      entityId: user.id,
      payload: { role, previousRole: target.role },
    });
    await notify.send({
      userId: user.id,
      type: 'ROLE_ASSIGNED',
      message: `Your account has been approved with the role ${role}.`,
    });
    return user;
  },

  // PATCH /users/:id/status — ADMIN activates / deactivates an account.
  async setUserStatus(adminId: string, targetUserId: string, status: 'ACTIVE' | 'INACTIVE'): Promise<SafeUser> {
    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) {
      throw new AppError(404, 'auth/user-not-found', 'User not found');
    }
    if (target.id === adminId && status === 'INACTIVE') {
      throw new AppError(422, 'auth/cannot-deactivate-self', 'You cannot deactivate your own account');
    }
    const user = await prisma.user.update({
      where: { id: targetUserId },
      data: { status },
      select: SAFE_USER_SELECT,
    });
    await auditLog.write({
      actorId: adminId,
      action: status === 'ACTIVE' ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      entity: 'User',
      entityId: user.id,
      payload: { status },
    });
    return user;
  },
};
