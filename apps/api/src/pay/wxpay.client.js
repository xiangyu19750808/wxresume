import crypto from 'node:crypto';
import { createWxpayClient } from './wxpay.js';

function signPayload(payload) {
  const privateKey = process.env.WX_PRIVATE_KEY || process.env.WX_MCH_PRIVATE_KEY;
  if (!privateKey) {
    return crypto.createHash('sha256').update(payload).digest('hex');
  }
  return crypto.sign('RSA-SHA256', Buffer.from(payload), privateKey).toString('base64');
}

export function signJsapiParams({ appId, timeStamp, nonceStr, packageStr }) {
  const payload = `${appId}\n${timeStamp}\n${nonceStr}\n${packageStr}\n`;
  return signPayload(payload);
}

export { createWxpayClient };
