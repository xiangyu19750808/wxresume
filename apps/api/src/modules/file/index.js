// apps/api/src/modules/file/index.js
import { Router } from 'express';

const DEFAULT_EXPIRES = 180;

export function createFileRouter() {
  const router = Router();

  // POST /v1/file/download  body: { file_id?: string, key?: string }
  router.post('/v1/file/download', (req, res) => {
    const body = req.body || {};
    const key = body.file_id || body.key;
    if (!key) {
      return res.status(400).json({ code: 400, msg: 'file_id required', data: null, requestId: req.requestId });
    }
    const url = `http://localhost:8080/mock/${encodeURIComponent(key)}?t=${Date.now()}`;
    return res.json({ code: 0, msg: 'ok', data: { url, expiresInSec: DEFAULT_EXPIRES }, requestId: req.requestId });
  });

  // GET /v1/file/download?file_id=xxx
  router.get('/v1/file/download', (req, res) => {
    const key = req.query.file_id || req.query.fileId;
    if (!key) {
      return res.status(400).json({ code: 400, msg: 'file_id required', data: null, requestId: req.requestId });
    }
    const url = `http://localhost:8080/mock/${encodeURIComponent(key)}?t=${Date.now()}`;
    return res.json({ code: 0, msg: 'ok', data: { url, expiresInSec: DEFAULT_EXPIRES }, requestId: req.requestId });
  });

  return router;
}

export default createFileRouter;
