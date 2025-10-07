import test from "node:test";
import assert from "node:assert/strict";
import express from "express";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { registerUsersModule } = await import("./index.js");
const { prisma } = await import("../../db.js");

function createApp() {
  const app = express();
  app.use(express.json());
  registerUsersModule(app);
  return app;
}

async function withServer(app, handler) {
  const server = app.listen(0);
  try {
    const address = server.address();
    const baseURL = `http://127.0.0.1:${address.port}`;
    return await handler(baseURL);
  } finally {
    server.close();
  }
}

test("GET /v1/users/profile without token returns 401", { concurrency: false }, async () => {
  const app = createApp();
  await withServer(app, async (baseURL) => {
    const res = await fetch(`${baseURL}/v1/users/profile`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.deepEqual(body, { code: 401, msg: "unauthorized" });
  });
});

test("POST login returns JWT and allows subsequent profile fetch", { concurrency: false }, async () => {
  const app = createApp();
  const user = {
    id: "user-demo",
    email: "demo.user@wxresume.dev",
    nickname: "演示用户",
    created_at: new Date("2024-01-01T00:00:00.000Z"),
  };

  const original = prisma.user.findUnique;
  prisma.user.findUnique = async ({ where }) => {
    if (where?.id === user.id) {
      return { ...user };
    }
    return null;
  };

  try {
    await withServer(app, async (baseURL) => {
      const loginRes = await fetch(`${baseURL}/v1/users/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id })
      });

      assert.equal(loginRes.status, 200);
      const loginBody = await loginRes.json();
      assert.equal(loginBody.code, 0);
      assert.equal(typeof loginBody.data.token, "string");
      assert.deepEqual(loginBody.data.user, {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        created_at: user.created_at.toISOString()
      });

      const token = loginBody.data.token;

      const profileRes = await fetch(`${baseURL}/v1/users/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      assert.equal(profileRes.status, 200);
      const profileBody = await profileRes.json();
      assert.equal(profileBody.code, 0);
      assert.deepEqual(profileBody.data.user, {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        created_at: user.created_at.toISOString()
      });
    });
  } finally {
    prisma.user.findUnique = original;
  }
});

test("POST login returns 404 when user is missing", { concurrency: false }, async () => {
  const app = createApp();
  const original = prisma.user.findUnique;
  prisma.user.findUnique = async () => null;

  try {
    await withServer(app, async (baseURL) => {
      const res = await fetch(`${baseURL}/v1/users/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: "missing" })
      });

      assert.equal(res.status, 404);
      const body = await res.json();
      assert.deepEqual(body, { code: 404, msg: "user not found" });
    });
  } finally {
    prisma.user.findUnique = original;
  }
});
