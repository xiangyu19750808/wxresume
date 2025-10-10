import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // 如不存在则创建一个演示用户
  let u = await prisma.user.findFirst({ where: { openid: "demo_openid" } });
  const defaults = {
    openid: "demo_openid",
    nickname: "演示用户",
    email: "demo.user@wxresume.dev"
  };

  if (!u) {
    u = await prisma.user.create({
      data: defaults
    });
  } else if (!u.email || !u.nickname) {
    u = await prisma.user.update({
      where: { id: u.id },
      data: {
        nickname: u.nickname || defaults.nickname,
        email: u.email || defaults.email
      }
    });
  }

  console.log(JSON.stringify({ user_id: u.id, email: u.email }, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
