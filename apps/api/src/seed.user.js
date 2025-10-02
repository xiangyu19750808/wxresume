import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // 如不存在则创建一个演示用户
  let u = await prisma.user.findFirst({ where: { openid: "demo_openid" } });
  if (!u) {
    u = await prisma.user.create({
      data: { openid: "demo_openid", nickname: "演示用户" }
    });
  }
  console.log(JSON.stringify({ user_id: u.id }, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
