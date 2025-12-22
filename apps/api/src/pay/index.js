import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createWxpayClient } from './wxpay.js';

let prismaPromise;

async function getPrisma() {
  if (prismaPromise) return prismaPromise;
  if (!process.env.DB_URL) {
    process.env.DB_URL = 'file:./prisma/dev.db';
  }
  prismaPromise = import('@prisma/client').then(({ PrismaClient }) => {
    const globalForPrisma = globalThis;
    const prismaClient = globalForPrisma.__wxresumePayPrisma || new PrismaClient();
    if (!globalForPrisma.__wxresumePayPrisma) {
      globalForPrisma.__wxresumePayPrisma = prismaClient;
    }
    return prismaClient;
  });
  return prismaPromise;
}

function randomNonce(length = 16) {
  return crypto.randomBytes(length).toString('hex');
}

function generateOutTradeNo() {
  return `wx_${Date.now().toString(36)}${randomNonce(4)}`;
}

function normalizeAmount(value) {
  const amount = Number.parseInt(value, 10);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

function signPayment({ appId, timeStamp, nonceStr, packageValue }) {
  const payload = `${appId}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`;
  const privateKey = process.env.WX_PRIVATE_KEY || process.env.WX_MCH_PRIVATE_KEY;
  if (!privateKey) {
    return crypto.createHash('sha256').update(payload).digest('hex');
  }
  return crypto.sign('RSA-SHA256', Buffer.from(payload), privateKey).toString('base64');
}

function decryptResource(resource = {}, apiV3Key) {
  if (!resource?.ciphertext || !resource?.nonce) return null;
  if (!apiV3Key || apiV3Key.length !== 32) {
    throw new Error('WX_API_V3_KEY must be 32 bytes');
  }

  const cipherBuffer = Buffer.from(resource.ciphertext, 'base64');
  const authTag = cipherBuffer.subarray(cipherBuffer.length - 16);
  const data = cipherBuffer.subarray(0, cipherBuffer.length - 16);
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(apiV3Key, 'utf8'),
    Buffer.from(resource.nonce, 'utf8')
  );
  if (resource.associated_data) {
    decipher.setAAD(Buffer.from(resource.associated_data, 'utf8'));
  }
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  return JSON.parse(decrypted);
}

export function createPayRouter(options = {}) {
  const router = express.Router();
  const wxpayClientFactory = options.createWxpayClient || createWxpayClient;

  router.use('/notify', express.raw({ type: '*/*' }));

  const jsonParser = express.json();
  const urlencodedParser = express.urlencoded({ extended: true });
  router.use((req, res, next) => {
    if (req.path.startsWith('/notify')) return next();
    jsonParser(req, res, (err) => {
      if (err) return next(err);
      urlencodedParser(req, res, next);
    });
  });

  router.post('/jsapi/create', async (req, res) => {
    try {
      const openid =
        (typeof req.body?.openid === 'string' && req.body.openid.trim()) ||
        (process.env.WX_DEBUG_OPENID || '').trim();
      const amount = normalizeAmount(req.body?.amount);

      if (!openid) {
        return res.status(400).json({ code: 400, msg: 'openid required' });
      }
      if (!amount) {
        return res.status(400).json({ code: 400, msg: 'amount required' });
      }

      const prisma = await getPrisma();
      const user = await prisma.user.upsert({
        where: { openid },
        update: {},
        create: { openid },
      });

      const outTradeNo =
        (typeof req.body?.out_trade_no === 'string' && req.body.out_trade_no.trim()) ||
        generateOutTradeNo();

      const appId = process.env.WX_APP_ID || 'wxresume-app';
      const wxpayClient = wxpayClientFactory();
      const { data } = await wxpayClient.instance.post('/v3/pay/transactions/jsapi', {
        appid: appId,
        mchid: process.env.WX_MCH_ID || 'mock-mchid',
        description: req.body?.description || 'wxresume order',
        out_trade_no: outTradeNo,
        notify_url: process.env.WX_NOTIFY_URL || 'https://example.com/v1/pay/notify',
        amount: {
          total: amount,
          currency: 'CNY',
        },
        payer: { openid },
      });

      const prepayId = data?.prepay_id;
      if (!prepayId) {
        return res.status(502).json({ code: 502, msg: 'prepay_id missing' });
      }

      await prisma.order.upsert({
        where: { out_trade_no: outTradeNo },
        create: {
          user_id: user.id,
          plan: req.body?.plan || 'wxpay',
          amount,
          status: 'CREATED',
          wx_prepay_id: prepayId,
          out_trade_no: outTradeNo,
        },
        update: {
          user_id: user.id,
          plan: req.body?.plan || 'wxpay',
          amount,
          status: 'CREATED',
          wx_prepay_id: prepayId,
        },
      });

      const timeStamp = Math.floor(Date.now() / 1000).toString();
      const nonceStr = randomNonce(8);
      const packageValue = `prepay_id=${prepayId}`;
      const paySign = signPayment({ appId, timeStamp, nonceStr, packageValue });

      return res.json({
        appId,
        timeStamp,
        nonceStr,
        package: packageValue,
        signType: 'RSA',
        paySign,
        out_trade_no: outTradeNo,
      });
    } catch (err) {
      console.error('[pay.jsapi.create] failed', err);
      return res.status(500).json({ code: 500, msg: 'wxpay create failed' });
    }
  });

  router.post('/notify', async (req, res) => {
    try {
      const rawBody = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(req.body ? String(req.body) : '');

      fs.appendFileSync('/tmp/wechat_notify.log', `${rawBody.toString('utf8')}\n`);

      let payload = {};
      try {
        payload = rawBody.length ? JSON.parse(rawBody.toString('utf8')) : {};
      } catch (err) {
        console.warn('[pay.notify] invalid JSON payload', err);
      }

      let decrypted = null;
      try {
        decrypted = decryptResource(payload.resource || {}, process.env.WX_API_V3_KEY);
        if (decrypted) {
          fs.appendFileSync(
            '/tmp/wechat_notify_decrypted.log',
            `${JSON.stringify(decrypted)}\n`
          );
        }
      } catch (err) {
        console.warn('[pay.notify] decrypt failed', err);
      }

      if (
        payload.event_type === 'TRANSACTION.SUCCESS' &&
        decrypted?.trade_state === 'SUCCESS'
      ) {
        const outTradeNo = decrypted.out_trade_no;
        if (outTradeNo) {
          const prisma = await getPrisma();
          await prisma.order.updateMany({
            where: { out_trade_no: outTradeNo },
            data: {
              status: 'PAID',
              paid_at: decrypted.success_time ? new Date(decrypted.success_time) : new Date(),
            },
          });
        }
      }
    } catch (err) {
      console.error('[pay.notify] failed', err);
    }

    return res.status(200).json({ code: 'SUCCESS', message: 'OK' });
  });

  router.get('/order/status/:out_trade_no', async (req, res) => {
    try {
      const outTradeNo = req.params.out_trade_no;
      const prisma = await getPrisma();
      const order = await prisma.order.findUnique({
        where: { out_trade_no: outTradeNo },
        select: { status: true, paid_at: true },
      });
      if (!order) {
        return res.status(404).json({ code: 404, msg: 'order not found' });
      }
      return res.json({
        status: order.status,
        paid_at: order.paid_at ? order.paid_at.toISOString() : null,
      });
    } catch (err) {
      console.error('[pay.order.status] failed', err);
      return res.status(500).json({ code: 500, msg: 'status query failed' });
    }
  });

  return router;
}
