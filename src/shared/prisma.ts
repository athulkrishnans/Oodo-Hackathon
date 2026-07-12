// src/shared/prisma.ts
// Single shared PrismaClient instance for the whole process.
// Every module imports this — never `new PrismaClient()` in module code
// (multiple clients exhaust the pooled Supabase connection limit).

import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __transitopsPrisma: PrismaClient | undefined;
}

// Reuse the instance across hot-reloads (tsx watch) to avoid connection leaks.
export const prisma =
  global.__transitopsPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV === 'development') {
  global.__transitopsPrisma = prisma;
}
