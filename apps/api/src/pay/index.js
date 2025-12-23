
import pay from './wxpay.js';

import crypto from 'node:crypto';

import fs from 'node:fs';

import { Router } from 'express';

import { prisma } from '../db.js';



const privateKey = fs.readFileSync('/root/wxresume/apps/api/wxpay/apiclient_key.pem', 'utf8').trim();

const APPID = 'wx87ca4e3a9535a654';

const API_V3_KEY = process.env.WXPAY_API_V3_KEY;


function decryptResource(resource, apiV3Key) {

  try {

    if (!resource || !resource.ciphertext) return null;

    const ciphertext = Buffer.from(resource.ciphertext, 'base64');

    const authTag = ciphertext.subarray(ciphertext.length - 16);

    const data = ciphertext.subarray(0, ciphertext.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(apiV3Key, 'utf8'), Buffer.from(resource.nonce, 'utf8'));

    decipher.setAuthTag(authTag);

    if (resource.associated_data) decipher.setAAD(Buffer.from(resource.associated_data, 'utf8'));

    return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8'));

  } catch (err) { return null; }

}



export const createPayRouter = () => {

  const router = Router();



  router.post('/jsapi/create', async (req, res) => {

    const { openid, amount, description, out_trade_no, plan } = req.body;

    try {

      const user = await prisma.user.findUnique({ where: { openid } });

      if (!user) throw new Error('用户不存在');



      const result = await pay.transactions_jsapi({

        appid: APPID, mchid: '1728914815',

        description: description || `会员订阅-${plan}`,

        out_trade_no,

        notify_url: 'https://yiersanai.com/v1/pay/notify',

        amount: { total: Math.round(parseFloat(amount) * 100), currency: 'CNY' },

        payer: { openid }

      });



      const prepayId = result.data.prepay_id;

      await prisma.order.upsert({

        where: { out_trade_no },

        create: {

          id: crypto.randomUUID(),

          out_trade_no,

          amount: Math.round(parseFloat(amount) * 100),

          status: 'CREATED',

          plan: plan || 'SINGLE',

          wx_prepay_id: prepayId,

          user_id: user.id,

          updated_at: new Date()

        },

        update: { wx_prepay_id: prepayId, updated_at: new Date() }

      });



      const timeStamp = Math.floor(Date.now() / 1000).toString();

      const nonceStr = crypto.randomBytes(16).toString('hex');

      const packageStr = `prepay_id=${prepayId}`;

      const message = `${APPID}\n${timeStamp}\n${nonceStr}\n${packageStr}\n`;

      const paySign = crypto.createSign('RSA-SHA256').update(message).sign(privateKey, 'base64');

      res.json({ timeStamp, nonceStr, package: packageStr, signType: 'RSA', paySign });

    } catch (err) {

      res.status(500).json({ error: err.message });

    }

  });



  router.post('/notify', async (req, res) => {

    try {

      const decrypted = decryptResource(req.body.resource, API_V3_KEY);

      if (decrypted && decrypted.trade_state === 'SUCCESS') {

        const tradeNo = decrypted.out_trade_no;

        

        // 1. 更新订单状态

        const order = await prisma.order.update({

          where: { out_trade_no: tradeNo },

          data: { status: 'PAID', paid_at: new Date() }

        });



        // 2. 计算过期时间

        let expireDate = new Date();

        if (order.plan === 'MONTH') {

          expireDate.setMonth(expireDate.getMonth() + 1);

        } else if (order.plan === 'QUARTER') {

          expireDate.setMonth(expireDate.getMonth() + 3);

        } else {

          expireDate.setFullYear(expireDate.getFullYear() + 50); // 单次给50年

        }



        // 3. 升级用户权益

        await prisma.user.update({

          where: { id: order.user_id },

          data: {

            role: 'VIP',

            membership_plan: order.plan,

            vip_expire_at: expireDate,

            updated_at: new Date()

          }

        });

        console.log(`✅ 会员权益已发放: ${order.user_id} (${order.plan})`);

      }

    } catch (err) { console.error('回调失败:', err.message); }

    res.status(200).send({ code: 'SUCCESS' });

  });



  return router;

};

