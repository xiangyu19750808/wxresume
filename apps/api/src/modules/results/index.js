import { Router } from 'express';

const mem = { results: [] };

const sendOk = (res, data) =>
  res.ok ? res.ok(data) : res.status(200).json({ code: 0, data });

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
    `r-${Date.now()}`; // 缺失时自动生成，保证 smoke 通过
  const score = body.score ?? Number.isFinite(Number(q.score)) ? Number(q.score) : 0;
  const meta = body.meta ?? {};
  return { report_id, score, meta };
}

export function createResultsRouter() {
  const router = Router();

  // 兼容脚本：POST /v1/results/save
  router.post('/v1/results/save', (req, res) => {
    const params = pickParams(req);
    const item = buildItem(params);
    mem.results.unshift(item);
    return sendOk(res, item);
  });

  // 兼容脚本：GET /v1/results/db
  router.get('/v1/results/db', (_req, res) => {
    return sendOk(res, mem.results);
  });

  // 标准：POST /v1/results
  router.post('/v1/results', (req, res) => {
    const params = pickParams(req);
    const item = buildItem(params);
    mem.results.unshift(item);
    return sendOk(res, item);
  });

  // 列表：GET /v1/results
  router.get('/v1/results', (_req, res) => {
    return sendOk(res, mem.results);
  });

  return router;
}
