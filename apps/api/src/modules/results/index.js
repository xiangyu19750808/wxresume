import { Router } from 'express';

const mem = { results: [] };

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
    `r-${Date.now()}`;
  const score = body.score ?? (Number.isFinite(Number(q.score)) ? Number(q.score) : 0);
  const meta = body.meta ?? {};
  return { report_id, score, meta };
}

export function createResultsRouter() {
  const router = Router();

  router.post('/v1/results/save', (req, res) => {
    const params = pickParams(req);
    const item = buildItem(params);
    mem.results.unshift(item);
    return res.json({ code: 0, data: item });
  });

  router.get('/v1/results/db', (_req, res) => {
    return res.json({ code: 0, data: mem.results });
  });

  router.post('/v1/results', (req, res) => {
    const params = pickParams(req);
    const item = buildItem(params);
    mem.results.unshift(item);
    return res.json({ code: 0, data: item });
  });

  router.get('/v1/results', (_req, res) => {
    return res.json({ code: 0, data: mem.results });
  });

  return router;
}
