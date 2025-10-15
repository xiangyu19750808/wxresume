import { randomUUID } from 'node:crypto';

export function reqid() {
  return (req, res, next) => {
    const id = randomUUID();
    req.requestId = id;
    res.setHeader('X-Request-ID', id);

    // 统一响应助手
    res.ok = (data = null, msg = 'ok') => {
      return res.json({ code: 0, msg, data, requestId: id });
    };
    res.fail = (code = 500, msg = 'error', data = null) => {
      return res.status(code === 0 ? 500 : code).json({ code, msg, data, requestId: id });
    };

    next();
  };
}
