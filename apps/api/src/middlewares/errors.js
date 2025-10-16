export default function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const message = err?.message || 'Internal Server Error';

  if (process.env.NODE_ENV !== 'test') {
    const errorLog = {
      level: 'error',
      timestamp: new Date().toISOString(),
      requestId: req?.requestId,
      message,
      stack: err?.stack,
    };
    try {
      console.error(JSON.stringify(errorLog));
    } catch (_) {
      console.error(message);
    }
  }

  if (typeof res.fail === 'function') {
    return res.fail(500, message);
  }

  return res.status(500).json({
    code: 500,
    msg: message,
    data: null,
    requestId: req?.requestId,
  });
}
