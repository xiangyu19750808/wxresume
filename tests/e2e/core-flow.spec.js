// tests/e2e/core-flow.spec.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { fetch } from 'node-fetch-native'; // Node 20 内置 fetch 也可，用这个兼容性更好

// ---- 配置 ----
const PORT = 9080;
const BASE = `http://127.0.0.1:${PORT}`;

// 在 CI / 本地都使用 node 直接跑 server.js（非 watch），更稳定
function startApi() {
  // 通过 node 直接运行 apps/api/src/server.js
  const child = spawn(
    process.execPath,
    ['apps/api/src/server.js'],
    {
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: String(PORT),
        JWT_SECRET: process.env.JWT_SECRET || 'ci-secret',
        // 允许来自本地 origin 的 CORS（测试里不太用到，但留着）
        ALLOWED_ORIGINS: 'http://localhost:5173,http://127.0.0.1:5173',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  let ready = false;
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');

  child.stdout.on('data', (chunk) => {
    if (/API listening on/i.test(chunk)) {
      ready = true;
    }
  });

  // 超时兜底（CI 慢给 25s）
  const waitReady = (async () => {
    for (let i = 0; i < 50; i += 1) {
      if (ready) return;
      await delay(500);
    }
    throw new Error('API did not start within time limit');
  })();

  return { child, waitReady };
}

async function kill(child) {
  if (!child || child.killed) return;
  child.kill('SIGTERM');
  // 最多等 5s 平滑退出
  const done = Promise.race([
    once(child, 'exit'),
    delay(5000),
  ]);
  await done.catch(() => {});
}

test('e2e: health -> render -> download -> order', async (t) => {
  // 1) 启动 API
  const { child, waitReady } = startApi();
  await waitReady;

  t.after(async () => {
    await kill(child);
  });

  // 2) health
  {
    const res = await fetch(`${BASE}/v1/health`);
    assert.equal(res.ok, true);
    const json = await res.json();
    assert.equal(json.code, 0);
  }

  // 3) render.resume（返回假签名下载链接）
  let fileUrl;
  {
    const res = await fetch(`${BASE}/v1/render/resume`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.ok, true);
    const json = await res.json();
    assert.equal(json.code, 0);
    assert.ok(json.data?.url);
    fileUrl = json.data.url;
  }

  // 4) file.download（通过签名接口）
  {
    const u = new URL(`${BASE}/v1/file/download`);
    const fileId = fileUrl.split('/').pop().split('?')[0]; // 简单取个文件名
    u.searchParams.set('file_id', fileId);
    const res = await fetch(u);
    assert.equal(res.ok, true);
    const json = await res.json();
    assert.equal(json.code, 0);
    assert.ok(/^http:\/\/localhost:8080\/mock\//.test(json.data.url));
  }

  // 5) order.create -> callback -> status
  let outTradeNo;
  {
    const res = await fetch(`${BASE}/v1/order/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plan: 'basic', amount: 1990 }),
    });
    const json = await res.json();
    assert.equal(json.code, 0);
    outTradeNo = json.data.out_trade_no;
    assert.ok(outTradeNo);
  }
  {
    // 模拟支付回调
    const res = await fetch(`${BASE}/v1/order/callback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ out_trade_no: outTradeNo, result: 'SUCCESS', amount: 1990 }),
    });
    const json = await res.json();
    assert.equal(json.code, 0);
    assert.equal(json.data.status, 'paid');
  }
  {
    const u = new URL(`${BASE}/v1/order/status`);
    u.searchParams.set('out_trade_no', outTradeNo);
    const res = await fetch(u);
    const json = await res.json();
    assert.equal(json.code, 0);
    assert.equal(json.data.status, 'paid');
  }
});
