// tests/e2e/core-flow.spec.js
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
});
