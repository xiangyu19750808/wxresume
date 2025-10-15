// tests/e2e/core-flow.spec.js
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
  ALLOWED_ORIGINS: ''
};

async function fetchJson(path, init) {
  const res = await fetch(`${BASE}${path}`, init);
  const json = await res.json().catch(() => null);
  return { res, json };
}

async function waitServerReady(maxMs = 45_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const { res, json } = await fetchJson('/v1/health');
      if (res.ok && json?.code === 0) return true;
    } catch {}
    await delay(500);
  }
  return false;
}

async function bootServer() {
  const child = spawn('node', ['apps/api/src/server.js'], {
    env: E2E_ENV,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (b) => process.stdout.write(b));
  child.stderr.on('data', (b) => process.stderr.write(b));

  const ready = await waitServerReady(45_000);
  if (!ready) {
    child.kill('SIGKILL');
    throw new Error('server boot timeout (health not ready within 45s)');
  }
  return {
    proc: child,
    async close() {
      child.kill('SIGTERM');
      await delay(800);
      if (!child.killed) child.kill('SIGKILL');
    },
  };
}

test('core flow: health → download → order', async (t) => {
  const server = await bootServer();
  t.after(async () => { await server.close(); });

  // health
  {
    const { res, json } = await fetchJson('/v1/health');
    assert.equal(res.status, 200);
    assert.equal(json?.code, 0);
  }

  // file download (mock signed url)
  let signedUrl = '';
  {
    const fileId = `resume-${Date.now()}.pdf`;
    const { res, json } = await fetchJson(`/v1/file/download?file_id=${encodeURIComponent(fileId)}`);
    assert.equal(res.status, 200);
    const payload = json?.data ? json : { code: 0, data: json };
    assert.equal(payload.code, 0);
    assert.ok(payload.data?.url);
    signedUrl = payload.data.url;
  }
  {
    const d = await fetch(signedUrl);
    assert.equal(d.status, 200);
    const buf = await d.arrayBuffer();
    assert.ok(buf.byteLength > 0);
  }

  // order create → callback → status
  let outTradeNo = '';
  {
    const { res, json } = await fetchJson('/v1/order/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plan: 'basic', amount: 1990 })
    });
    assert.equal(res.status, 200);
    const payload = json?.data ? json : { code: 0, data: json };
    assert.equal(payload.code, 0);
    outTradeNo = payload.data.out_trade_no;
  }
  {
    const { res, json } = await fetchJson('/v1/order/callback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ out_trade_no: outTradeNo, result: 'SUCCESS', amount: 1990 })
    });
    assert.equal(res.status, 200);
    const payload = json?.data ? json : { code: 0, data: json };
    assert.equal(payload.code, 0);
    assert.equal(payload.data?.status, 'paid');
  }
  {
    const { res, json } = await fetchJson(`/v1/order/status?out_trade_no=${encodeURIComponent(outTradeNo)}`);
    assert.equal(res.status, 200);
    const payload = json?.data ? json : { code: 0, data: json };
    assert.equal(payload.code, 0);
    assert.equal(payload.data?.status, 'paid');
  }
});
