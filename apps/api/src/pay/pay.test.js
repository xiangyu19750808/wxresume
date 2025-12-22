import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import express from 'express';

const __filename = fileURLToPath(import.meta.url);
const projectDir = path.resolve(__filename, '..', '..', '..');
const prismaSchema = path.join(projectDir, 'prisma', 'schema.prisma');
const prismaBinary = path.join(
  projectDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'prisma.cmd' : 'prisma'
);

const testDbPath = path.join(projectDir, 'prisma', 'test.db');
const testDbUrl = 'file:./prisma/test.db';

process.env.DB_URL = testDbUrl;
process.env.WX_API_V3_KEY = '0123456789abcdef0123456789abcdef';

const { createPayRouter } = await import('./index.js');

let prisma;

function runPrismaDbPush() {
  execFileSync(prismaBinary, ['generate', '--schema', prismaSchema], {
    cwd: projectDir,
    env: {
      ...process.env,
      DB_URL: testDbUrl,
    },
    stdio: 'ignore',
  });
  execFileSync(prismaBinary, ['db', 'push', '--schema', prismaSchema, '--skip-generate'], {
    cwd: projectDir,
    env: {
      ...process.env,
      DB_URL: testDbUrl,
    },
    stdio: 'ignore',
  });
}

function encryptResource(plaintext, apiV3Key, associatedData = '') {
  const nonce = crypto.randomBytes(12).toString('base64').slice(0, 12);
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    Buffer.from(apiV3Key, 'utf8'),
    Buffer.from(nonce, 'utf8')
  );
  if (associatedData) {
    cipher.setAAD(Buffer.from(associatedData, 'utf8'));
  }
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(plaintext), 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  const ciphertext = Buffer.concat([encrypted, authTag]).toString('base64');
  return {
    ciphertext,
    nonce,
    associated_data: associatedData,
  };
}

before(async () => {
  runPrismaDbPush();
  const { PrismaClient } = await import('@prisma/client');
  prisma = new PrismaClient();
});

after(async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
  fs.rmSync(testDbPath, { force: true });
  fs.rmSync(`${testDbPath}-journal`, { force: true });
  fs.rmSync(`${testDbPath}-shm`, { force: true });
  fs.rmSync(`${testDbPath}-wal`, { force: true });
});

test('jsapi create + notify flow', async () => {
  const app = express();
  app.use('/v1/pay', createPayRouter());
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    process.env.WX_DEBUG_OPENID = 'openid-123';
    const outTradeNo = `TEST_${Date.now()}`;
    const createResponse = await fetch(`${baseUrl}/v1/pay/jsapi/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        openid: 'openid-123',
        out_trade_no: outTradeNo,
        amount: { total: 300 },
        plan: 'pro',
      }),
    });

    assert.equal(createResponse.status, 200);
    const createBody = await createResponse.json();
    assert.equal(createBody.code, 0);
    assert.equal(createBody.data?.package, `prepay_id=mock-prepay-${outTradeNo}`);
    const order = await prisma.order.findUnique({ where: { out_trade_no: outTradeNo } });
    assert.equal(order?.status, 'CREATED');
    assert.equal(order?.wx_prepay_id, `mock-prepay-${outTradeNo}`);

    const transaction = {
      out_trade_no: outTradeNo,
      trade_state: 'SUCCESS',
      success_time: new Date().toISOString(),
    };
    const resource = encryptResource(transaction, process.env.WX_API_V3_KEY, 'transaction');

    const notifyResponse = await fetch(`${baseUrl}/v1/pay/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'TRANSACTION.SUCCESS',
        resource: {
          ...resource,
          algorithm: 'AEAD_AES_256_GCM',
        },
      }),
    });
    assert.equal(notifyResponse.status, 200);

    const updated = await prisma.order.findUnique({ where: { out_trade_no: outTradeNo } });
    assert.equal(updated?.status, 'PAID');
    assert.equal(Boolean(updated?.paid_at), true);
  } finally {
    delete process.env.WX_DEBUG_OPENID;
    server.close();
  }
});
