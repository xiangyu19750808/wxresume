import { PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis;
export const prisma =
  globalForPrisma.__prisma || new PrismaClient({ log: ["error"] });
if (!globalForPrisma.__prisma) globalForPrisma.__prisma = prisma;
