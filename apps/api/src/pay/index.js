// apps/api/src/pay/index.js
import express from 'express';
import crypto from 'node:crypto';
import { createWxpayClient, signJsapiParams } from './wxpay.client.js';

function makeNonceStr(len = 32) {
  return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len);
}

export function createPayRouter() {
  const router = express.Router();

  // debug：确认路由可用
  router.post('/jsapi/debug', async (req, res) => {
    res.json({
      code: 0,
      msg: 'ok',
      data: {
        timeStamp: String(Math.floor(Date.now() / 1000)),
        nonceStr: 'debug_nonce_str',
        package: 'prepay_id=debug_prepay_id',
        signType: 'RSA',
        paySign: 'debug_pay_sign',
      },
    });
  });

  // create：真实下单（JSAPI）
  router.post('/jsapi/create', async (req, res) => {
    try {
      const { instance, mchid, appid } = createWxpayClient();

      console.log('[WX PAY DEBUG ENV]', {
        mchid,
        appid,
        env_mchid: process.env.WX_MCHID,
        env_appid: process.env.WX_APPID,
      });

      const notifyUrl = process.env.WX_NOTIFY_URL;
      if (!notifyUrl) throw new Error('WX_NOTIFY_URL missing in .env');

      // 前端必须传 openid（JSAPI 下单必需）
      const { description, out_trade_no, amount } = req.body || {};
      const openid = req.body?.openid || process.env.WX_DEBUG_OPENID;

      if (!openid) throw new Error('openid missing');
      if (!description) throw new Error('description missing');
      if (!out_trade_no) throw new Error('out_trade_no missing');
      if (!amount?.total) throw new Error('amount.total missing (单位：分)');

      const payload = {
        appid,
        mchid,
        description,
        out_trade_no,
        notify_url: notifyUrl,
        amount: { total: Number(amount.total), currency: 'CNY' },
        payer: { openid },
      };

      console.log('[WX PAY DEBUG BODY]', payload);

      // ? 真实调用微信：预下单
      const payResp = await instance.post('/v3/pay/transactions/jsapi', payload);

      const prepayId = payResp?.data?.prepay_id;
      if (!prepayId) throw new Error('no prepay_id from wxpay');

      // ? 生成前端调起参数 + paySign
      const timeStamp = String(Math.floor(Date.now() / 1000));
      const nonceStr = makeNonceStr(32);
      const packageStr = `prepay_id=${prepayId}`;

      const paySign = signJsapiParams({
        appId: appid,
        timeStamp,
        nonceStr,
        packageStr,
      });

      // ? 返回纯 JSON
      res.json({
        code: 0,
        msg: 'ok',
        data: {
          appId: appid,
          timeStamp,
          nonceStr,
          package: packageStr,
          signType: 'RSA',
          paySign,
        },
      });
    } catch (e) {
      // 关键：把微信支付 400 的真实原因吐出来
      console.error('WX_PAY_ERROR_MESSAGE=', e?.message);
      console.error('WX_PAY_ERROR_STATUS=', e?.response?.status);
      console.error('WX_PAY_ERROR_RESPONSE=', e?.response?.data);
      console.error('WX_PAY_ERROR_HEADERS=', e?.response?.headers);

      res.status(400).json({
        code: 1,
        msg: e?.message || 'wxpay error',
        detail: e?.response?.data || null,
      });
    }
  });

  return router;
}
