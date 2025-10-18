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

function attachResponseHelpers(req, res) {
  const requestId = req.requestId;

  const setHeader = (key, value) => {
    if (typeof res.set === 'function') {
      res.set(key, value);
    } else if (typeof res.setHeader === 'function') {
      res.setHeader(key, value);
    }
  };

  setHeader('X-Request-ID', requestId);

  const originalJson = typeof res.json === 'function' ? res.json.bind(res) : null;

  if (originalJson) {
    res.json = function patchedJson(body) {
      return originalJson(normalizePayload(body, requestId));
    };
  }

  res.ok = function ok(data = null, msg = 'ok', code = 0) {
    const payload = {
      code,
      msg,
      data,
      requestId,
    };
    return this.status(200).json(payload);
  };

  res.fail = function fail(code = 500, msg = 'Internal Server Error', data = null, status) {
    const httpStatus = typeof status === 'number'
      ? status
      : code >= 100 && code < 600
      ? code
      : 500;

    const payload = {
      code,
      msg,
      data,
      requestId,
    };

    return this.status(httpStatus).json(payload);
  };
}

export default function requestIdMiddleware(req, res, next) {
  const incoming = req.get?.('x-request-id') || req.headers?.['x-request-id'];
  const requestId = typeof incoming === 'string' && incoming.trim() !== ''
    ? incoming
    : randomUUID();

  req.requestId = requestId;

  attachResponseHelpers(req, res);

  next();
}

export { attachResponseHelpers, normalizePayload };
