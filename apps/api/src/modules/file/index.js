// apps/api/src/modules/file/index.js
import { Router } from 'express';

const DEFAULT_EXPIRES = 180;

// 兼容 res.ok/res.fail，中间件不存在时走兜底结构
function ok(res, data) {
  if (typeof res.ok === 'function') return res.ok(data);
  const reqId = res.req?.requestId;
  return res.status(200).json({ code: 0, msg: 'ok', data, ...(reqId ? { requestId: reqId } : {}) });
}
function fail(res, status, msg) {
  if (typeof res.fail === 'function') return res.fail(status, msg);
  const reqId = res.req?.requestId;
  return res.status(status).json({ code: status, msg, data: null, ...(reqId ? { requestId: reqId } : {}) });
}

export function createFileRouter() {
  const router = Router();

  // GET /v1/file/download?file_id=xxx
  router.get('/v1/file/download', (req, res) => {
    const key = req.query.file_id || req.query.fileId;
    if (!key) return fail(res, 400, 'file_id required');

    const url = `http://localhost:8080/mock/${encodeURIComponent(key)}?t=${Date.now()}`;
    return ok(res, { url, expiresInSec: DEFAULT_EXPIRES });
  });

  // POST /v1/file/download  body: { file_id?: string, key?: string }
  router.post('/v1/file/download', (req, res) => {
    const body = req.body || {};
    const key = body.file_id || body.key;
    if (!key) return fail(res, 400, 'file_id required');

    const url = `http://localhost:8080/mock/${encodeURIComponent(key)}?t=${Date.now()}`;
    return ok(res, { url, expiresInSec: DEFAULT_EXPIRES });
  });

  return router;
}
