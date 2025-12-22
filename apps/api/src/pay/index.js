import express from 'express';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createWxpayClient, signJsapiParams } from './wxpay.client.js';

let prismaPromise;

async function getPrisma() {
  if (prismaPromise) return prismaPromise;

  prismaPromise = import('@prisma/client').then(({ PrismaClient }) => {
    const globalForPrisma = globalThis;
    const prisma =
      globalForPrisma.__wxresumePayPrisma || new PrismaClient();

    if (!globalForPrisma.__wxresumePayPrisma) {
      globalForPrisma.__wxresumePayPrisma = prisma;
    }
    return prisma;
  });

  return prismaPromise;
}

export function createPayRouter() {
  const router = express.Router();

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
      const body = req.body || {};

      const description = body.description || '测试支付';
      const outTradeNo = body.out_trade_no || body.outTradeNo || `TEST_${Date.now()}`;
      const total = Number(body?.amount?.total ?? 1);

      if (!Number.isFinite(total) || total <= 0) {
        return res.json({ code: 1, msg: 'amount.total invalid', data: null });
      }

      const notifyUrl = process.env.WX_NOTIFY_URL || 'https://yiersanai.com/v1/pay/notify';

      const { instance, mchid, appid } = createWxpayClient();

      const openid = body.openid || process.env.WX_DEBUG_OPENID;
      if (!openid) {
        return res.json({ code: 1, msg: 'openid missing', data: null });
      }

      const resp = await instance.post('/v3/pay/transactions/jsapi', {
        mchid,
        appid,
        description,
        out_trade_no: outTradeNo,
        notify_url: notifyUrl,
        amount: { total, currency: 'CNY' },
        payer: { openid },
      });

      const prepayId = resp?.data?.prepay_id;
      if (!prepayId) {
        return res.json({ code: 1, msg: 'prepay_id missing', data: resp?.data || null });
      }

      try {
        const prisma = await getPrisma();
        const user = await prisma.user.upsert({
          where: { openid },
          update: {},
          create: { openid },
        });

        await prisma.order.upsert({
          where: { out_trade_no: outTradeNo },
          create: {
            out_trade_no: outTradeNo,
            wx_prepay_id: prepayId,
            amount: total,
            status: 'CREATED',
            created_at: new Date(),
            user_id: user.id,
            plan: body.plan || 'wxpay',
          },
          update: {
            wx_prepay_id: prepayId,
            amount: total,
            status: 'CREATED',
            user_id: user.id,
            plan: body.plan || 'wxpay',
          },
        });
      } catch (dbErr) {
        console.error('[pay.jsapi.create][db] failed', dbErr);
      }

      const timeStamp = String(Math.floor(Date.now() / 1000));
      const nonceStr = crypto.randomBytes(16).toString('hex');
      const packageStr = `prepay_id=${prepayId}`;

      const paySign = signJsapiParams({
        appId: appid,
        timeStamp,
        nonceStr,
        packageStr,
      });

      return res.json({
        code: 0,
        msg: 'ok',
        data: {
          appId: appid,
          timeStamp,
          nonceStr,
          package: packageStr,
          signType: 'RSA',
          paySign,
          prepay_id: prepayId,
        },
      });
    } catch (err) {
      console.error('[pay.jsapi.create] error:', err?.response?.data || err?.message || err);
      return res.json({
        code: 1,
        msg: err?.response?.data?.message || err?.message || 'create order failed',
        data: err?.response?.data || null,
      });
    }
  });

  router.post('/notify', async (req, res) => {
    try {
      const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';

      fs.appendFileSync('/tmp/wechat_notify.log', `${raw}\n\n`);

      const payload = JSON.parse(raw);
      const resource = payload?.resource || {};
      const apiV3Key = process.env.WX_API_V3_KEY;

      if (!apiV3Key) throw new Error('WX_API_V3_KEY missing');
      if (!resource?.ciphertext || !resource?.nonce || !resource?.associated_data) {
        throw new Error('resource fields missing');
      }

      const data = Buffer.from(resource.ciphertext, 'base64');
      const ciphertext = data.subarray(0, data.length - 16);
      const authTag = data.subarray(data.length - 16);

      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        Buffer.from(apiV3Key, 'utf8'),
        Buffer.from(resource.nonce, 'utf8')
      );

      decipher.setAAD(Buffer.from(resource.associated_data, 'utf8'));
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString('utf8');

      const transaction = JSON.parse(decrypted);

      const record = {
        id: payload?.id,
        event_type: payload?.event_type,
        create_time: payload?.create_time,
        summary: payload?.summary,
        out_trade_no: transaction?.out_trade_no,
        transaction_id: transaction?.transaction_id,
        trade_state: transaction?.trade_state,
        success_time: transaction?.success_time,
        openid: transaction?.payer?.openid,
        amount: transaction?.amount,
      };

      fs.appendFileSync('/tmp/wechat_notify_decrypted.log', `${JSON.stringify(record)}\n`);

      console.log('[pay.notify] decrypted ok:', record.out_trade_no, record.trade_state);

      if (
        payload?.event_type === 'TRANSACTION.SUCCESS' &&
        transaction?.trade_state === 'SUCCESS'
      ) {
        try {
          const prisma = await getPrisma();

          await prisma.order.updateMany({
            where: { out_trade_no: transaction.out_trade_no },
            data: {
              status: 'PAID',
              paid_at: transaction.success_time
                ? new Date(transaction.success_time)
                : new Date(),
            },
          });
        } catch (dbErr) {
          console.error('[pay.notify][db] update failed', dbErr);
        }
      }
    } catch (err) {
      console.error('[pay.notify] decrypt error:', err?.message || err);
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
