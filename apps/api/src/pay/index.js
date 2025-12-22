// apps/api/src/pay/index.js
import express from "express";
import fs from "fs";
import crypto from "crypto";
import { createWxpayClient, signJsapiParams } from "./wxpay.client.js";

export function createPayRouter() {
  const router = express.Router();

  /**
   * ? 1) 微信支付回调 /v1/pay/notify
   * - 必须 raw body（Buffer），否则无法解密
   * - 落盘原文
   * - AES-256-GCM 解密 resource
   * - 解密结果落盘
   * - 返回 SUCCESS（微信要求）
   */
  router.post(
    "/notify",
    express.raw({ type: "*/*" }),
    (req, res) => {
      try {
        // 1) 读取 raw body
        const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";

        // 2) 原文落盘（便于对照调试）
        fs.appendFileSync("/tmp/wechat_notify.log", raw + "\n\n");

        // 3) 解析回调 JSON
        const payload = JSON.parse(raw);
        const resource = payload?.resource || {};
        const apiV3Key = process.env.WX_API_V3_KEY;

        if (!apiV3Key) throw new Error("WX_API_V3_KEY missing");
        if (!resource?.ciphertext || !resource?.nonce || !resource?.associated_data) {
          throw new Error("resource fields missing");
        }

        // 4) AES-256-GCM 解密（微信 V3 标准）
        // ciphertext(base64) = 实际密文 + 16字节tag
        const data = Buffer.from(resource.ciphertext, "base64");
        const ciphertext = data.subarray(0, data.length - 16);
        const authTag = data.subarray(data.length - 16);

        const decipher = crypto.createDecipheriv(
          "aes-256-gcm",
          Buffer.from(apiV3Key, "utf8"),
          Buffer.from(resource.nonce, "utf8")
        );

        decipher.setAAD(Buffer.from(resource.associated_data, "utf8"));
        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([
          decipher.update(ciphertext),
          decipher.final(),
        ]).toString("utf8");

        const transaction = JSON.parse(decrypted);

        // 5) 解密结果落盘（下一步你就用它更新订单）
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

        fs.appendFileSync("/tmp/wechat_notify_decrypted.log", JSON.stringify(record) + "\n");

        console.log("[pay.notify] decrypted ok:", record.out_trade_no, record.trade_state);

        // ? 按微信要求返回（必须 200 + SUCCESS）
        return res.status(200).json({ code: "SUCCESS", message: "OK" });
      } catch (err) {
        console.error("[pay.notify] decrypt error:", err?.message || err);

        // ?? 暂时仍返回 SUCCESS，避免微信反复重试轰炸
        return res.status(200).json({ code: "SUCCESS", message: "OK" });
      }
    }
  );

  /**
   * ? 2) JSAPI 下单 /v1/pay/jsapi/create
   * - 统一下单获取 prepay_id
   * - 生成 nonceStr/timeStamp/package/paySign
   * - 返回给小程序 wx.requestPayment
   */
  router.post("/jsapi/create", async (req, res) => {
    try {
      const body = req.body || {};

      const description = body.description || "测试支付";
      const outTradeNo = body.out_trade_no || body.outTradeNo || `TEST_${Date.now()}`;
      const total = Number(body?.amount?.total ?? 1);

      if (!Number.isFinite(total) || total <= 0) {
        return res.json({ code: 1, msg: "amount.total invalid", data: null });
      }

      const notifyUrl = process.env.WX_NOTIFY_URL || "https://yiersanai.com/v1/pay/notify";

      // ? 正确：解构出 instance，并用它发请求
      const { instance, mchid, appid } = createWxpayClient();

      // openid：优先前端传；否则走你的调试 openid
      const openid = body.openid || process.env.WX_DEBUG_OPENID;
      if (!openid) {
        return res.json({ code: 1, msg: "openid missing", data: null });
      }

      // ? 统一下单（V3）
      const resp = await instance.post("/v3/pay/transactions/jsapi", {
        mchid,
        appid,
        description,
        out_trade_no: outTradeNo,
        notify_url: notifyUrl,
        amount: { total, currency: "CNY" },
        payer: { openid },
      });

      const prepayId = resp?.data?.prepay_id;
      if (!prepayId) {
        return res.json({ code: 1, msg: "prepay_id missing", data: resp?.data || null });
      }

      // ? 生成调起参数
      const timeStamp = String(Math.floor(Date.now() / 1000));
      const nonceStr = crypto.randomBytes(16).toString("hex"); // 32位 hex
      const packageStr = `prepay_id=${prepayId}`;

      const paySign = signJsapiParams({
        appId: appid,
        timeStamp,
        nonceStr,
        packageStr,
      });

      return res.json({
        code: 0,
        msg: "ok",
        data: {
          appId: appid,
          timeStamp,
          nonceStr,
          package: packageStr,
          signType: "RSA",
          paySign,
          prepay_id: prepayId,
        },
      });
    } catch (err) {
      console.error("[pay.jsapi.create] error:", err?.response?.data || err?.message || err);
      return res.json({
        code: 1,
        msg: err?.response?.data?.message || err?.message || "create order failed",
        data: err?.response?.data || null,
      });
    }
  });

  return router;
}
