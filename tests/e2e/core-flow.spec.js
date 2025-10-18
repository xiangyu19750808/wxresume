import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const PORT = Number(process.env.E2E_PORT || 8080);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DB_FILE = path.resolve('apps/api/prisma/e2e-test.db');

let serverProcess;
const serverLogs = [];

async function waitForServerReady(proc, timeoutMs = 10_000) {
  let resolved = false;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Server did not start within ${timeoutMs}ms. Logs:\n${serverLogs.join('')}`));
    }, timeoutMs);

    const onData = (chunk) => {
      const text = chunk.toString();
      serverLogs.push(text);
      if (!resolved && text.includes('API listening on')) {
        resolved = true;
        cleanup();
        resolve();
      }
    };

    const onError = (chunk) => {
      serverLogs.push(chunk.toString());
    };

    const onExit = (code, signal) => {
      cleanup();
      const reason = signal ? `signal ${signal}` : `code ${code}`;
      reject(new Error(`Server exited before becoming ready (${reason}). Logs:\n${serverLogs.join('')}`));
    };

    function cleanup() {
      clearTimeout(timer);
      proc.stdout.off('data', onData);
      proc.stderr.off('data', onError);
      proc.off('exit', onExit);
    }

    proc.stdout.on('data', onData);
    proc.stderr.on('data', onError);
    proc.once('exit', onExit);
  });
}

before(async () => {
  rmSync(DB_FILE, { force: true });

  serverProcess = spawn('node', ['src/server.js'], {
    env: {
      ...process.env,
      PORT: String(PORT),
      JWT_SECRET: process.env.JWT_SECRET || 'test-secret',
      NODE_ENV: 'test',
      DB_URL: 'file:./e2e-test.db',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: path.resolve('apps/api'),
  });

  serverProcess.stdout.setEncoding('utf8');
  serverProcess.stderr.setEncoding('utf8');

  await waitForServerReady(serverProcess);

  const capture = (chunk) => {
    serverLogs.push(chunk.toString());
  };

  serverProcess.stdout.on('data', capture);
  serverProcess.stderr.on('data', capture);

  // Give the server a brief moment to finish bootstrapping
  await delay(100);
});

after(async () => {
  if (!serverProcess) return;

  const exitPromise = new Promise((resolve) => {
    serverProcess.once('exit', () => resolve());
  });

  if (process.env.DEBUG_E2E_LOGS) {
    console.log(serverLogs.join(''));
  }

  serverProcess.kill('SIGTERM');
  await Promise.race([exitPromise, delay(500)]);

  rmSync(DB_FILE, { force: true });
});

async function jsonFetch(url, init) {
  const res = await fetch(url, init);
  const body = await res.json();
  return { res, body };
}

test('end-to-end core user journey', async () => {
  // Health check should succeed with request ID
  const { res: healthRes, body: healthBody } = await jsonFetch(`${BASE_URL}/v1/health`);
  assert.equal(healthRes.status, 200);
  assert.equal(healthBody.code, 0);
  assert.equal(healthBody.msg, 'ok');
  assert.match(healthBody.requestId, /^[\w-]+$/);

  // Unauthenticated access should be blocked
  const { res: unauthRes, body: unauthBody } = await jsonFetch(`${BASE_URL}/v1/users/me`);
  assert.equal(unauthRes.status, 401);
  assert.equal(unauthBody.code, 401);
  assert.equal(unauthBody.msg, 'unauthorized');

  // Login via mock WX callback -> receive JWT token
  const { res: loginRes, body: loginBody } = await jsonFetch(`${BASE_URL}/v1/auth/wx/callback?code=e2e-seed`);
  assert.equal(loginRes.status, 200, `login http status unexpected: ${loginRes.status}`);
  assert.equal(loginBody.code, 0, `login failed: ${JSON.stringify(loginBody)}`);
  assert.ok(loginBody.data?.token);
  assert.ok(loginBody.data?.user?.id);
  const token = loginBody.data.token;

  // Authenticated profile fetch should succeed
  const { res: meRes, body: meBody } = await jsonFetch(`${BASE_URL}/v1/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(meRes.status, 200);
  assert.equal(meBody.code, 0);
  assert.equal(meBody.data?.user?.id, loginBody.data.user.id);

  // Render mock resume PDF -> expect byte length
  const { body: renderBody } = await jsonFetch(`${BASE_URL}/v1/render/mock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(renderBody.code, 0);
  assert.ok(renderBody.data?.bytes > 0);

  // Request download signature and verify it serves bytes
  const fileId = 'resume-demo.pdf';
  const { body: downloadBody } = await jsonFetch(`${BASE_URL}/v1/file/download?file_id=${encodeURIComponent(fileId)}`);
  assert.equal(downloadBody.code, 0);
  assert.ok(downloadBody.data?.url);
  assert.ok(downloadBody.data?.expiresInSec > 0);

  const downloadRes = await fetch(downloadBody.data.url);
  assert.equal(downloadRes.status, 200);
  assert.equal(downloadRes.headers.get('content-type'), 'application/pdf');
  const pdfBytes = await downloadRes.arrayBuffer();
  assert.ok(pdfBytes.byteLength > 0);

  // Order creation, status polling, and payment callback should transition to paid
  const plan = 'pro';
  const amount = 9900;
  const { body: orderCreate } = await jsonFetch(`${BASE_URL}/v1/order/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ plan, amount }),
  });
  assert.equal(orderCreate.code, 0);
  assert.ok(orderCreate.data?.out_trade_no);
  assert.ok(orderCreate.data?.prepay_id);
  assert.equal(orderCreate.data?.status, 'pending');

  const outTradeNo = orderCreate.data.out_trade_no;

  const { body: orderStatusInitial } = await jsonFetch(`${BASE_URL}/v1/order/status?out_trade_no=${encodeURIComponent(outTradeNo)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(orderStatusInitial.code, 0);
  assert.equal(orderStatusInitial.data?.status, 'pending');
  assert.equal(orderStatusInitial.data?.plan, plan);
  assert.equal(orderStatusInitial.data?.amount, amount);

  const signature = process.env.WXPAY_FAKE_CALLBACK_SIGNATURE || 'wxpay-fake-signature';

  const { body: callbackInvalid } = await jsonFetch(`${BASE_URL}/v1/order/callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Wechatpay-Signature': 'invalid-signature',
    },
    body: JSON.stringify({ out_trade_no: outTradeNo, result: 'SUCCESS', amount }),
  });
  assert.equal(callbackInvalid.code, 403);

  const { body: orderStatusAfterInvalid } = await jsonFetch(`${BASE_URL}/v1/order/status?out_trade_no=${encodeURIComponent(outTradeNo)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(orderStatusAfterInvalid.code, 0);
  assert.equal(orderStatusAfterInvalid.data?.status, 'pending');

  const { body: orderCallback } = await jsonFetch(`${BASE_URL}/v1/order/callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Wechatpay-Signature': signature,
    },
    body: JSON.stringify({ out_trade_no: outTradeNo, result: 'SUCCESS', amount }),
  });
  assert.equal(orderCallback.code, 0);
  assert.equal(orderCallback.data?.status, 'paid');
  assert.ok(orderCallback.data?.paid_at);

  const { body: orderCallbackReplay } = await jsonFetch(`${BASE_URL}/v1/order/callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Wechatpay-Signature': signature,
    },
    body: JSON.stringify({ out_trade_no: outTradeNo, result: 'SUCCESS', amount }),
  });
  assert.equal(orderCallbackReplay.code, 0);
  assert.equal(orderCallbackReplay.data?.status, 'paid');

  const { body: orderStatusFinal } = await jsonFetch(`${BASE_URL}/v1/order/status?out_trade_no=${encodeURIComponent(outTradeNo)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(orderStatusFinal.code, 0);
  assert.equal(orderStatusFinal.data?.status, 'paid');
  assert.ok(orderStatusFinal.data?.paid_at);
});
