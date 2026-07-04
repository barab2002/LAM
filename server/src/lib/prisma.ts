import { PrismaClient } from '@prisma/client';

// Single Prisma instance shared across the app (and hot-reload safe in dev)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
