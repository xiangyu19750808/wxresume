// apps/api/src/modules/results/index.js
import { Router } from 'express';

const mem = { results: [] };

function safeNumber(n, def = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : def;
}

function buildItem({ report_id = null, score = 0, meta = {} }) {
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
    null;

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

  // 仅保留内存版创建与列表，避免与 server.js 中的 DB 路由冲突
  router.post('/v1/results', (req, res) => {
    const { report_id, score, meta } = pickParams(req);
    const item = buildItem({ report_id, score, meta });
    mem.results.unshift(item);
    return ok(res, item);
  });

  router.get('/v1/results', (_req, res) => {
    return ok(res, mem.results);
  });

  router.get('/v1/results/:rid', (req, res) => {
    const rid = String(req.params.rid || '');
    const item = mem.results.find(x => x.id === rid);
    if (!item) return fail(res, 404, 'not found');
    return ok(res, item);
  });

  return router;
}

export default createResultsRouter;
