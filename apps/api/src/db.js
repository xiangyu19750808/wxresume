let prisma;

if (process.env.E2E_LIGHT) {
  // 轻量模式：提供最小假的 Prisma 接口，避免在 CI 里跑 prisma generate
  prisma = {
    user: {
      count: async () => 0,
    },
    result: {
      findMany: async () => [],
      create: async ({ data }) => ({
        id: 'e2e-' + Date.now(),
        report_id: (data?.report && data.report.report_id) || 'r-' + Date.now(),
        created_at: new Date(),
        ...data,
      }),
    },
  };
} else {
  const { PrismaClient } = await import('@prisma/client');
  prisma = new PrismaClient();
}

export { prisma };
