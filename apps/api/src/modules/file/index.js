import { Router } from 'express';

/**
 * 极简版文件下载签名接口（demo）
 * GET /v1/file/download?file_id=resume-*.pdf
 * 返回 { code:0, data:{ url, expiresInSec } }
 */
export function createFileRouter() {
  const router = Router();

  router.get('/v1/file/download', (req, res) => {
    const fileId = req.query.file_id;
    if (!fileId) {
      return res.status(400).json({ code: 400, msg: 'file_id required' });
    }
    // Demo：直接拼本地 mock 地址（与 CosFakeAdapter 一致）
    const url = `http://localhost:8080/mock/${encodeURIComponent(fileId)}?t=${Date.now()}`;
    return res.json({ code: 0, data: { url, expiresInSec: 180 } });
  });

  return router;
}

