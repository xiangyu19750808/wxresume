const { Buffer } = require('node:buffer');
const { StringDecoder } = require('node:string_decoder');
const querystring = require('node:querystring');

function parseLimit(limit, fallback) {
  if (limit === undefined || limit === null) return fallback;
  if (typeof limit === 'number' && Number.isFinite(limit)) {
    return limit;
  }

  if (typeof limit === 'string') {
    const trimmed = limit.trim().toLowerCase();
    const match = trimmed.match(/^(\d+(?:\.\d+)?)(kb|mb|gb|b)?$/);
    if (match) {
      const value = parseFloat(match[1]);
      const unit = match[2] || 'b';
      const multipliers = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 };
      return Math.floor(value * (multipliers[unit] || 1));
    }
  }

  return fallback;
}

function createEntityTooLargeError(limit) {
  const err = new Error('request entity too large');
  err.status = 413;
  err.type = 'entity.too.large';
  err.limit = limit;
  return err;
}

function createParseError(message) {
  const err = new Error(message);
  err.status = 400;
  err.type = 'entity.parse.failed';
  return err;
}

function collectBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    function cleanup() {
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      req.removeListener('error', onError);
    }

    function onData(chunk) {
      size += chunk.length;
      if (limit && size > limit) {
        cleanup();
        reject(createEntityTooLargeError(limit));
        return;
      }
      chunks.push(Buffer.from(chunk));
    }

    function onEnd() {
      cleanup();
      resolve(Buffer.concat(chunks));
    }

    function onError(err) {
      cleanup();
      reject(err);
    }

    req.on('data', onData);
    req.once('end', onEnd);
    req.once('error', onError);
  });
}

function getCharset(contentType, defaultCharset = 'utf-8') {
  if (!contentType) return defaultCharset;
  const match = contentType.toLowerCase().match(/charset=([^;]+)/);
  return match ? match[1].trim() : defaultCharset;
}

function matchesContentType(req, predicate) {
  const contentType = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  return predicate(contentType);
}

function shouldParseBody(req) {
  const method = req.method ? req.method.toUpperCase() : 'GET';
  return !['GET', 'HEAD', 'OPTIONS'].includes(method);
}

function json(options = {}) {
  const limit = parseLimit(options.limit, 1024 * 1024);
  const matcher = options.type
    ? (req) => matchesContentType(req, (value) => value === options.type)
    : (req) => matchesContentType(req, (value) => value.endsWith('/json') || value.endsWith('+json'));

  return function jsonParser(req, res, next) {
    if (req._body || !shouldParseBody(req) || !matcher(req)) {
      return next();
    }

    req._body = true;

    collectBody(req, limit)
      .then((buffer) => {
        if (!buffer.length) {
          req.body = {};
          return next();
        }

        const charset = getCharset(req.headers['content-type']);
        const decoder = new StringDecoder(charset);
        const text = decoder.write(buffer) + decoder.end();

        try {
          req.body = JSON.parse(text);
        } catch (error) {
          next(createParseError('invalid json received'));
          return;
        }

        next();
      })
      .catch((err) => next(err));
  };
}

function text(options = {}) {
  const limit = parseLimit(options.limit, 512 * 1024);
  const matcher = options.type
    ? (req) => matchesContentType(req, (value) => value === options.type)
    : (req) => matchesContentType(req, (value) => value.startsWith('text/'));

  return function textParser(req, res, next) {
    if (req._body || !shouldParseBody(req) || !matcher(req)) {
      return next();
    }

    req._body = true;

    collectBody(req, limit)
      .then((buffer) => {
        const charset = getCharset(req.headers['content-type']);
        const decoder = new StringDecoder(charset);
        req.body = decoder.write(buffer) + decoder.end();
        next();
      })
      .catch((err) => next(err));
  };
}

function raw(options = {}) {
  const limit = parseLimit(options.limit, 512 * 1024);
  const matcher = options.type
    ? (req) => matchesContentType(req, (value) => value === options.type)
    : () => true;

  return function rawParser(req, res, next) {
    if (req._body || !shouldParseBody(req) || !matcher(req)) {
      return next();
    }

    req._body = true;

    collectBody(req, limit)
      .then((buffer) => {
        req.body = buffer;
        next();
      })
      .catch((err) => next(err));
  };
}

function urlencoded(options = {}) {
  const limit = parseLimit(options.limit, 1024 * 1024);
  const matcher = options.type
    ? (req) => matchesContentType(req, (value) => value === options.type)
    : (req) => matchesContentType(req, (value) => value === 'application/x-www-form-urlencoded');

  return function urlencodedParser(req, res, next) {
    if (req._body || !shouldParseBody(req) || !matcher(req)) {
      return next();
    }

    req._body = true;

    collectBody(req, limit)
      .then((buffer) => {
        if (!buffer.length) {
          req.body = {};
          return next();
        }

        const charset = getCharset(req.headers['content-type']);
        const decoder = new StringDecoder(charset);
        const text = decoder.write(buffer) + decoder.end();
        const parsed = querystring.parse(text);
        req.body = parsed;
        next();
      })
      .catch((err) => next(err));
  };
}

module.exports = {
  json,
  raw,
  text,
  urlencoded,
};
