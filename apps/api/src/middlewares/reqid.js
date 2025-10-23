// apps/api/src/middlewares/reqid.js
import { randomUUID } from 'node:crypto';

const RESERVED_RESPONSE_KEYS = new Set(['code', 'msg', 'data', 'requestId']);

function normalizePayload(payload, requestId) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }

  const normalized = { ...payload };

  if (!('requestId' in normalized) && requestId) {
    normalized.requestId = requestId;
  }

  if ('code' in normalized && !('msg' in normalized)) {
    normalized.msg = normalized.code === 0 ? 'ok' : 'error';
  }

  if (!('data' in normalized)) {
    const rest = {};
    for (const key of Object.keys(normalized)) {
      if (!RESERVED_RESPONSE_KEYS.has(key)) {
        rest[key] = normalized[key];
        delete normalized[key];
      }
    }
    const hasExtras = Object.keys(rest).length > 0;
    if (hasExtras) {
      normalized.data = rest;
    } else if (requestId) {
      normalized.data = null;
    }
  }

  return normalized;
}

function setHeader(res, key, value) {
  if (typeof res.setHeader === 'function') {
    res.setHeader(key, value);
  } else if (typeof res.header === 'function') {
    res.header(key, value);
  } else if (typeof res.set === 'function') {
    res.set(key, value);
  }
}

function respond(res, status, body) {
  if (typeof res.status === 'function') {
    const maybeResponse = res.status(status);
    if (maybeResponse && typeof maybeResponse.json === 'function') {
      return maybeResponse.json(body);
    }
  }

  if (typeof res.json === 'function') {
    return res.json(body);
  }

  res.statusCode = status;
  res.body = body;
  return res;
}

export function attachResponseHelpers(req, res, providedRequestId) {
  const requestId = providedRequestId ?? req?.requestId ?? randomUUID();

  if (req) {
    req.requestId = requestId;
  }

  if (requestId) {
    setHeader(res, 'X-Request-ID', requestId);
  }

  res.ok = (data = null) => {
    const body = normalizePayload({ code: 0, data }, requestId);
    return respond(res, 200, body);
  };

  res.fail = (status = 500, msg = 'error', extra) => {
    const payload = { code: status, msg };
    if (extra !== undefined) {
      payload.data = extra;
    }
    const body = normalizePayload(payload, requestId);
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
    return respond(res, status, body);
  };

  return requestId;
}

export function reqid() {
  return (req, res, next) => {
    attachResponseHelpers(req, res);
    next();
  };
}
