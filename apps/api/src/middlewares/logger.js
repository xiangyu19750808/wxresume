export default function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationNs = process.hrtime.bigint() - start;
    const durationMs = Number(durationNs) / 1e6;
    const ipHeader = req.headers?.['x-forwarded-for'];
    const ip = Array.isArray(ipHeader)
      ? ipHeader[0]
      : typeof ipHeader === 'string'
      ? ipHeader.split(',')[0].trim()
      : undefined;

    const logLine = {
      level: 'info',
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
      ip: ip || req.ip || req.connection?.remoteAddress || null,
      ua: req.get?.('user-agent') || req.headers?.['user-agent'] || '',
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(3)),
    };

    try {
      console.log(JSON.stringify(logLine));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log('{"level":"error","message":"failed to stringify log"}');
    }
  });

  next();
}
