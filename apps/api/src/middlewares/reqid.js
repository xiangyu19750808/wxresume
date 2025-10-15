// apps/api/src/middlewares/reqid.js
import { randomUUID } from 'node:crypto';

const RESERVED_RESPONSE_KEYS = new Set(['code', 'msg', 'data', 'requestId']);

function normalizePayload(payload, requestId) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }

  const normalized = { ...payload };

  if (!('requestId' in normalized)) {
    normalized.requestId = requestId;
  }

  if ('code' in normalized) {
    if (!('msg' in normalized)) {
      normalized.msg = normalized.code === 0 ? 'ok' : 'error';
    }
  }

  if (!('data' in normalized)) {
    const rest = {};
    for (const key of Object.keys(normalized)) {
      if (!RESERVED_RESPONSE_KEYS.has(key)) {
        rest[key] = normalized[key];
        delete normalized[key];
      }
    }
    normalized.data = Object.keys(rest).length ? rest : null;
  }

  return normalized;
}

export function reqid() {
  return (req, res, next) => {
    const requestId = randomUUID();
    req.requestId = requestId;

    res.setHeader('X-Request-ID', requestId);

    res.ok = (data = null) => {
      const body = normalizePayload({ code: 0, data, requestId }, requestId);
      return res.status(200).json(body);
    };

    res.fail = (status = 500, msg = 'error', extra = null) => {
      const body = normalizePayload({ code: status, msg, data: extra, requestId }, requestId);
      if (status >= 500) {
        const errorLog = {
          level: 'error',
          timestamp: new Date().toISOString(),
          requestId,
          message: msg,
        };
        try {
          console.error(JSON.stringify(errorLog));
        } catch {
          console.error(errorLog);
        }
      }
      return res.status(status).json(body);
    };

    next();
  };
}
