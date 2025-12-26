import pay from './wxpay.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { Router } from 'express';
import { prisma } from '../db.js';

const PRIVATE_KEY_PATH = process.env.WXPAY_PRIVATE_KEY_PATH || '/root/wxresume/apps/api/wxpay/apiclient_key.pem';
const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8').trim();
const APPID = process.env.WXPAY_APPID || 'wx87ca4e3a9535a654';
const MCHID = process.env.WXPAY_MCH_ID || '1728914815';
const API_V3_KEY = process.env.WXPAY_API_V3_KEY || '';

// 回调解密工具
function decryptResource(resource, apiV3Key) {
  try {
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

  // 1. 创建订单
  router.post('/jsapi/create', async (req, res) => {
    // 显式解构参数
    const { openid, amount, description, plan } = req.body;
    
    // --- 【关键修复：金额解析】 ---
    // 1. 确保能够解析前端传来的字符串或数字金额
    const inputAmount = parseFloat(amount);
    // 2. 转换为分（微信支付单位），防止精度丢失。如果转换失败则默认使用 0.01 (1分) 用于测试安全
    const finalAmountInCents = !isNaN(inputAmount) ? Math.round(inputAmount * 100) : 1; 
    
    console.log(`>>> [下单请求核对] 用户: ${openid}, 原始金额: ${amount}, 最终分值: ${finalAmountInCents}, 方案: ${plan}`);

    try {
      // 检查用户是否存在，不存在则创建
      let user = await prisma.user.findUnique({ where: { openid } });
      if (!user) {
        user = await prisma.user.create({
          data: { id: `u_${Date.now()}`, openid, nickname: '微信用户' }
        });
      }

      const tradeNo = `RE${Date.now()}${Math.random().toString(36).slice(-3).toUpperCase()}`;

      // 向微信请求支付凭证
      const result = await pay.transactions_jsapi({
        appid: APPID,
        mchid: MCHID,
        description: description || `九维诊断-${plan || '服务'}`,
        out_trade_no: tradeNo,
        notify_url: process.env.WXPAY_NOTIFY_URL,
        amount: { 
          total: finalAmountInCents, // ✅ 这里的金额必须是动态的
          currency: 'CNY' 
        },
        payer: { openid }
      });

      const resData = result.data || result;
      const prepayId = resData.prepay_id;

      if (!prepayId) {
        console.error('❌ 微信响应异常:', resData);
        throw new Error("获取prepay_id失败");
      }

      // 存入数据库
      await prisma.order.create({
        data: {
          id: crypto.randomUUID(),
          out_trade_no: tradeNo,
          amount: finalAmountInCents,
          status: 'CREATED',
          plan: plan || 'SINGLE',
          wx_prepay_id: prepayId,
          user_id: user.id
        }
      });

      // 生成支付签名
      const timeStamp = Math.floor(Date.now() / 1000).toString();
      const nonceStr = crypto.randomBytes(16).toString('hex');
      const packageStr = `prepay_id=${prepayId}`;
      const paySign = crypto.createSign('RSA-SHA256')
                           .update(`${APPID}\n${timeStamp}\n${nonceStr}\n${packageStr}\n`)
                           .sign(privateKey, 'base64');

      console.log(`✅ 下单成功: ${tradeNo}, PrepayID: ${prepayId}`);

      res.json({ 
        appId: APPID, 
        timeStamp, 
        nonceStr, 
        package: packageStr, 
        signType: 'RSA', 
        paySign, 
        out_trade_no: tradeNo 
      });
    } catch (err) {
      const errorDetail = err.response?.data || err.message;
      console.error('❌ 下单失败详情:', errorDetail);
      res.status(500).json({ error: '下单失败', details: errorDetail });
    }
  });

  // 2. 回调处理
  router.post('/notify', async (req, res) => {
    console.log('>>> [支付回调] 收到微信通知信号');
    try {
      const decrypted = decryptResource(req.body.resource, API_V3_KEY);
      if (decrypted && decrypted.trade_state === 'SUCCESS') {
        const tradeNo = decrypted.out_trade_no;
        console.log(`✅ [支付回调] 验证通过，订单号: ${tradeNo}`);

        const order = await prisma.order.findUnique({ where: { out_trade_no: tradeNo } });
        if (order && order.status !== 'PAID') {
          // 开启事务：更新订单状态 + 发放会员权益
          await prisma.$transaction([
            prisma.order.update({ 
              where: { id: order.id }, 
              data: { status: 'PAID', paid_at: new Date() } 
            }),
            prisma.user.update({
              where: { id: order.user_id },
              data: { 
                role: 'VIP', 
                vip_expire_at: new Date(Date.now() + 365*24*60*60*1000) 
              }
            })
          ]);
          console.log(`🚀 [权益发放] 用户 ${order.user_id} 已升级为 VIP`);
        }
      } else {
        console.warn('⚠️ [回调提示] 支付未成功或解密失败');
      }
    } catch (err) {
      console.error('❌ [回调执行异常]:', err.message);
    }
    // 无论如何返回 200 给微信，防止微信频繁重试
    res.status(200).send({ code: 'SUCCESS', message: '成功' });
  });

  return router;
};