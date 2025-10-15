// tests/e2e/core-flow.spec.js
// Node 20 内置 test runner + fetch；不依赖第三方库
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const PORT = Number(process.env.PORT || 9080);
const BASE = `http://127.0.0.1:${PORT}`;
const E2E_ENV = {
  ...process.env,
  NODE_ENV: 'test',
  PORT: String(PORT),
  JWT_SECRET: process.env.JWT_SECRET || 'ci-secret',
  // 允许本地请求；你的服务默认不开 CORS 阻断非浏览器，这里只是显式给个空白名单
  ALLOWED_ORIGINS: ''
};

// 启动 API 并等待“API listening on ...”日志
async function bootServer() {
  const child = spawn('node', ['apps/api/src/server.js'], {
    env: E2E_ENV,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let ready = false;
  const waitReady = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('server boot timeout'));
    }, 15_000);

    const onLine = (buf) => {
      const line = buf.toString();
      if (line.includes('API listening on')) {
        ready = true;
        clearTimeout(timer);
        child.stdout.off('data', onLine);
        resolve();
      }
    };
    child.on('error', reject);
    child.stdout.on('data', onLine);
  });

  try {
    await waitReady;
  } catch (e) {
    // 打印下日志便于 CI 排查
    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);
    child.kill('SIGKILL');
    throw e;
  }

  return {
    proc: child,
    async close() {
      // 尽量优雅退出，否则强杀
      child.kill('SIGTERM');
      await delay(500);
      if (!child.killed) child.kill('SIGKILL');
    }
  };
}

async function jfetch(path, init) {
  const res = await fetch(`${BASE}${path}`, init);
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return { res, json: await res.json() };
  }
  return { res, json: null };
}

test('core flow: health → render → download → order', async (t) => {
  const server = await bootServer();
  t.after(async () => {
    await server.close();
  });

  // 1) health
  {
    const { res, json } = await jfetch('/v1/health');
    assert.equal(res.status, 200);
    assert.equal(json?.code, 0);
  }

  // 2) render resume （返回假签名 URL）
  let signedUrl = '';
  {
    const { res, json } = await jfetch('/v1/render/resume', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ templateId: 'classic' })
    });
    assert.equal(res.status, 200);
    assert.equal(json?.code, 0);
    assert.ok(json?.data?.url, 'signed url');
    assert.ok(Number(json?.data?.bytes) > 0);
    signedUrl = json.data.url;
  }

  // 3) 下载签名 URL（mock 文件服务）
  {
    const dl = await fetch(signedUrl);
    assert.equal(dl.status, 200);
    // 最小 mock PDF 字节流，长度 > 0
    const buf = await dl.arrayBuffer();
    assert.ok(buf.byteLength > 0);
  }

  // 4) 订单创建 → 回调 → 查询状态=paid
  let outTradeNo = '';
  {
    const { res, json } = await jfetch('/v1/order/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plan: 'basic', amount: 1990 })
    });
    assert.equal(res.status, 200);
    assert.equal(json?.code, 0);
    outTradeNo = json.data.out_trade_no;
    assert.ok(outTradeNo);
  }
  {
    const { res, json } = await jfetch('/v1/order/callback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ out_trade_no: outTradeNo, result: 'SUCCESS', amount: 1990 })
    });
    assert.equal(res.status, 200);
    assert.equal(json?.code, 0);
    assert.equal(json?.data?.status, 'paid');
  }
  {
    const { res, json } = await jfetch(`/v1/order/status?out_trade_no=${encodeURIComponent(outTradeNo)}`);
    assert.equal(res.status, 200);
    assert.equal(json?.code, 0);
    assert.equal(json?.data?.status, 'paid');
  }
});
