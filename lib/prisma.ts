import { PrismaClient } from "@prisma/client";

/**
 * Jedna sdílená instance i v produkci (Vercel serverless izoláty) — bez toho
 * vznikají zbytečné nové klienty a přihlášení přes DB občas spadne.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;
