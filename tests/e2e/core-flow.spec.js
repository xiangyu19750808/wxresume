<<<<<<< HEAD
﻿// tests/e2e/core-flow.spec.js
import test from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL || process.env.API_BASE || process.env.API_URL || 'http://127.0.0.1:9080';

async function req(path, init) {
  const res = await fetch(${BASE}, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init && init.headers),
    },
    redirect: 'manual',
  });
  return res;
}

test('core flow: health → login → users/me → render → download → order', async () => {
  // 0) health
  {
    const r = await req('/v1/health');
    assert.equal(r.ok, true, 'health ok');
  }

  // 简单 Cookie 复用
  let cookieJar = '';
  const authedReq = async (path, init) => {
    const res = await fetch(${BASE}, {
      ...init,
      headers: {
        'content-type': 'application/json',
        cookie: cookieJar,
        ...(init && init.headers),
      },
      redirect: 'manual',
    });
    const sc = res.headers.get('set-cookie');
    if (sc) cookieJar = sc;
    return res;
  };

  // 1) 未登录阻断
  {
    const r = await req('/v1/users/me');
    assert.ok([401, 403].includes(r.status), 'unauth should be blocked');
  }

  // 2) 登录（mock）
  {
    const r = await authedReq('/v1/auth/wx/callback?code=dev-ok');
    assert.ok(r.status < 400, 'login ok');
  }

  // 3) 登录后 users/me
  {
    const r = await authedReq('/v1/users/me');
    assert.equal(r.ok, true, 'me ok');
    const j = await r.json();
    assert.ok(j, 'me json');
  }

  // 4) 渲染 PDF
  let fileId = '';
  {
    const r = await authedReq('/v1/render/resume', {
      method: 'POST',
      body: JSON.stringify({
        name: 'E2E Tester',
        title: 'QA',
        items: [{ k: 'skill', v: 'testing' }],
      }),
    });
    assert.equal(r.ok, true, 'render ok');
    const j = await r.json().catch(() => ({}));
    fileId = j?.file_id || j?.id || j?.data?.file_id || '';
    assert.ok(fileId, 'file_id exists');
  }

  // 5) 下载
  {
    const r = await authedReq(/v1/file/download?file_id=);
    assert.equal(r.ok, true, 'download ok');
    const ct = r.headers.get('content-type') || '';
    assert.ok(ct.includes('pdf') || ct.includes('octet-stream'), 'content-type looks like pdf');
  }

  // 6) 订单创建
  let orderId = '';
  {
    const r = await authedReq('/v1/order/create', {
      method: 'POST',
      body: JSON.stringify({ sku: 'resume_pdf', price: 1 }),
    });
    assert.equal(r.ok, true, 'order create ok');
    const j = await r.json().catch(() => ({}));
    orderId = j?.order_id || j?.id || j?.data?.order_id || '';
    assert.ok(orderId, 'order_id exists');
  }

  // 7) 回调（paid）
  {
    const r = await authedReq(/v1/order/callback?order_id=&status=paid);
    assert.equal(r.ok, true, 'order callback ok');
  }

  // 8) 查询状态
  {
    const r = await authedReq(/v1/order/status?id=);
    assert.equal(r.ok, true, 'order status ok');
    const j = await r.json().catch(() => ({}));
    const status = String(j?.status || j?.data?.status || '').toLowerCase();
    assert.ok(status.includes('paid'), 'order paid');
  }
=======
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const PORT = Number(process.env.E2E_PORT || 8080);
const BASE_URL = `http://127.0.0.1:${PORT}`;

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
  serverProcess = spawn('node', ['src/server.js'], {
    env: {
      ...process.env,
      PORT: String(PORT),
      JWT_SECRET: process.env.JWT_SECRET || 'test-secret',
      NODE_ENV: 'test',
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, amount }),
  });
  assert.equal(orderCreate.code, 0);
  assert.ok(orderCreate.data?.out_trade_no);
  assert.ok(orderCreate.data?.prepay_id);

  const outTradeNo = orderCreate.data.out_trade_no;

  const { body: orderStatusInitial } = await jsonFetch(`${BASE_URL}/v1/order/status?out_trade_no=${encodeURIComponent(outTradeNo)}`);
  assert.equal(orderStatusInitial.code, 0);
  assert.equal(orderStatusInitial.data?.status, 'created');
  assert.equal(orderStatusInitial.data?.plan, plan);
  assert.equal(orderStatusInitial.data?.amount, amount);

  const { body: orderCallback } = await jsonFetch(`${BASE_URL}/v1/order/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ out_trade_no: outTradeNo, result: 'SUCCESS', amount }),
  });
  assert.equal(orderCallback.code, 0);
  assert.equal(orderCallback.data?.status, 'paid');

  const { body: orderStatusFinal } = await jsonFetch(`${BASE_URL}/v1/order/status?out_trade_no=${encodeURIComponent(outTradeNo)}`);
  assert.equal(orderStatusFinal.code, 0);
  assert.equal(orderStatusFinal.data?.status, 'paid');
>>>>>>> origin/codex/implement-x-request-id-error-handling
});
