// apps/api/src/modules/results/index.js
import { Router } from 'express';

const mem = { results: [] };

function safeNumber(n, def = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : def;
}

function buildItem({ report_id, score = 0, meta = {} }) {
  return {
    id: `res-${Date.now()}`,
    report_id,
    score,
    meta,
    created_at: new Date().toISOString(),
  };
}

function pickParams(req) {
  const body = req.body || {};
  const q = req.query || {};

  const report_id =
    body.report_id ??
    body.reportId ??
    q.report_id ??
    q.reportId ??
    null;                        // <== 别忘了给个兜底

  const score = safeNumber(body.score ?? q.score, 0);
  const meta = (body.meta && typeof body.meta === 'object') ? body.meta : {};

  return { report_id, score, meta };
}

function ok(res, data) {
  if (typeof res.ok === 'function') return res.ok(data);
  return res.json({ code: 0, msg: 'ok', data });
}

function fail(res, status, msg) {
  if (typeof res.fail === 'function') return res.fail(status, msg);
  return res.status(status).json({ code: status, msg, data: null });
}

export function createResultsRouter() {
  const router = Router();

  // 保存（内存模拟；与 /v1/results 行为一致）
  router.post('/v1/results/save', (req, res) => {
    const { report_id, score, meta } = pickParams(req);
    if (!report_id) return fail(res, 400, 'report_id required');

    const item = buildItem({ report_id, score, meta });
    mem.results.unshift(item);
    return ok(res, item);
  });

  // 读取（内存模拟的“DB列表”）
  router.get('/v1/results/db', (_req, res) => {
    return ok(res, mem.results);
  });

  // 兼容的创建接口（与 save 同逻辑）
  router.post('/v1/results', (req, res) => {
    const { report_id, score, meta } = pickParams(req);
    if (!report_id) return fail(res, 400, 'report_id required');

    const item = buildItem({ report_id, score, meta });
    mem.results.unshift(item);
    return ok(res, item);
  });

  // 列表（与 /v1/results/db 一致）
  router.get('/v1/results', (_req, res) => {
    return ok(res, mem.results);
  });

  return router;
}
