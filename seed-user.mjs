import { prisma } from './apps/api/src/db.js';

async function main() {
  const user = await prisma.user.upsert({
    where: { openid: 'demo-openid' },              // 用唯一键 openid
    update: { nickname: 'Demo User', email: 'demo@example.com' },
    create: {
      openid: 'demo-openid',
      nickname: 'Demo User',
      email: 'demo@example.com'
    }
  });
  console.log('seeded user id=' + user.id);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

