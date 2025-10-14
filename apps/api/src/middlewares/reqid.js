import { randomUUID } from 'node:crypto';

export function reqid() {
  return (req, res, next) => {
    const rid = req.headers['x-request-id'] || randomUUID();
    req.requestId = rid;
    res.setHeader('X-Request-ID', rid);

    // 统一成功
    res.ok = (data = null, msg = 'ok') =>
      res.json({ code: 0, msg, data, requestId: rid });

    // 统一失败
    res.fail = (status = 500, code = status, msg = 'error') => {
      res.status(status);
      return res.json({ code, msg, requestId: rid });
    };

    next();
  };
}
