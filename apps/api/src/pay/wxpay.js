import crypto from 'node:crypto';

function randomId(prefix = 'wx') {
  return `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`;
}

export function createWxpayClient() {
  return {
    instance: {
      async post(url, payload = {}) {
        return {
          data: {
            prepay_id: payload?.out_trade_no
              ? `mock-prepay-${payload.out_trade_no}`
              : randomId('prepay'),
          },
        };
      },
    },
  };
}
