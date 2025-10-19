const DEFAULT_FAKE_SIGNATURE = 'wxpay-fake-signature';

function normaliseHeaders(headers = {}) {
  if (headers && typeof headers.get === 'function') {
    return new Proxy(
      {},
      {
        get(_, prop) {
          if (typeof prop !== 'string') return undefined;
          return headers.get(prop) ?? headers.get(prop.toLowerCase());
        },
        has(_, prop) {
          if (typeof prop !== 'string') return false;
          return (
            headers.get(prop) !== undefined ||
            headers.get(prop.toLowerCase()) !== undefined
          );
        },
      }
    );
  }

  const entries = Object.create(null);
  for (const [key, value] of Object.entries(headers)) {
    entries[key] = value;
    if (typeof key === 'string') {
      entries[key.toLowerCase()] = value;
    }
  }
  return entries;
}

function ensureSignature(headers) {
  const normalised = normaliseHeaders(headers);
  return (
    normalised['wechatpay-signature'] ||
    normalised['wxpay-signature'] ||
    normalised['x-wxpay-signature'] ||
    normalised['x-wechatpay-signature']
  );
}

function resolveOutTradeNo(query = {}) {
  return (
    query.out_trade_no ||
    query.outTradeNo ||
    `FAKE-${Math.random().toString(36).slice(2, 10)}`
  );
}

function resolveTransactionId(outTradeNo) {
  return `fake-transaction-${outTradeNo}`;
}

export async function unifiedOrder(query = {}) {
  const outTradeNo = resolveOutTradeNo(query);
  return {
    prepay_id: `fake-prepay-${outTradeNo}`,
    trade_state: 'SUCCESS',
    trade_state_desc: 'Fake payment completed immediately.',
    out_trade_no: outTradeNo,
    transaction_id: resolveTransactionId(outTradeNo),
    amount: query.amount ?? { total: 0, currency: 'CNY' },
    payer: query.payer ?? { openid: query.openid ?? 'fake-openid' },
    paid_at: new Date().toISOString(),
    raw: {
      ...query,
    },
  };
}

export async function query(outTradeNoOrQuery = {}) {
  const outTradeNo =
    typeof outTradeNoOrQuery === 'string'
      ? outTradeNoOrQuery
      : resolveOutTradeNo(outTradeNoOrQuery);

  return {
    trade_state: 'SUCCESS',
    trade_state_desc: 'Fake payment completed immediately.',
    out_trade_no: outTradeNo,
    transaction_id: resolveTransactionId(outTradeNo),
    paid_at: new Date().toISOString(),
    raw: {
      out_trade_no: outTradeNo,
    },
  };
}

export async function verifyCallback(headers = {}, body = {}) {
  const signature = ensureSignature(headers);
  const expectedSignature =
    process.env.WXPAY_FAKE_CALLBACK_SIGNATURE ?? DEFAULT_FAKE_SIGNATURE;

  if (!signature || signature !== expectedSignature) {
    const error = new Error('Invalid WeChat Pay callback signature.');
    error.code = 'ERR_WXPAY_INVALID_SIGNATURE';
    throw error;
  }

  const resource = body.resource ?? body;
  const outTradeNo = resource.out_trade_no ?? resource.outTradeNo;

  return {
    verified: true,
    event_type: body.event_type ?? body.eventType ?? 'TRANSACTION.SUCCESS',
    out_trade_no: outTradeNo,
    transaction_id:
      resource.transaction_id ?? resolveTransactionId(outTradeNo ?? 'unknown'),
    success_time: resource.success_time ?? new Date().toISOString(),
    raw: body,
  };
}

export const __internal = {
  ensureSignature,
  normaliseHeaders,
  resolveOutTradeNo,
};
