if (!process.env.DB_URL) {
  process.env.DB_URL = 'file:./prisma/dev.db';
}

let prisma;

if (process.env.E2E_LIGHT) {
  // 轻量模式：提供最小假的 Prisma 接口，避免在 CI 里跑 prisma generate
  const stubUser = {
    id: 'demo-user',
    nickname: '演示用户',
    email: 'demo.user@wxresume.dev',
    avatar_url: null,
    phone: null,
    created_at: new Date('2024-01-01T00:00:00.000Z'),
  };

  const applySelect = (record, select) => {
    if (!select) return { ...record };
    const picked = {};
    for (const [key, enabled] of Object.entries(select)) {
      if (enabled && key in record) {
        picked[key] = record[key];
      }
    }
    return picked;
  };

  const cloneUser = (select) => applySelect(stubUser, select);

  prisma = {
    user: {
      count: async () => 1,
      findUnique: async (args = {}) => {
        const where = args.where || {};
        if (!where.id || where.id === stubUser.id) {
          return cloneUser(args.select);
        }
        return null;
      },
      findFirst: async (args = {}) => cloneUser(args.select),
      update: async (args = {}) => {
        const where = args.where || {};
        if (where.id && where.id !== stubUser.id) {
          const error = new Error('Record not found');
          error.code = 'P2025';
          throw error;
        }

        const data = args.data || {};
        for (const [key, value] of Object.entries(data)) {
          if (value === undefined) continue;
          if (key === 'created_at') continue;
          stubUser[key] = value;
        }
        stubUser.updated_at = new Date();
        return cloneUser(args.select);
      },
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
