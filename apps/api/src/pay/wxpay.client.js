// apps/api/src/pay/wxpay.client.js
import fs from "node:fs";
import crypto from "node:crypto";
import axios from "axios";
import WxPayPkg from "wechatpay-axios-plugin";

const {
  Wechatpay,
  Rsa,
} = WxPayPkg;

// 生成 nonce
function nonceStr(len = 32) {
  return crypto.randomBytes(Math.ceil(len / 2)).toString("hex").slice(0, len);
}

export function createWxpayClient() {
  const mchid = process.env.WX_MCHID;   // 必须是 1728914815
  const appid = process.env.WX_APPID;   // 必须是 wx87...
  const serialNo = process.env.WX_CERT_SERIAL_NO;
  const privateKeyPath = process.env.WX_PRIVATE_KEY_PATH;
  const apiV3Key = process.env.WX_API_V3_KEY;

  if (!mchid || !appid || !serialNo || !privateKeyPath || !apiV3Key) {
    throw new Error('WXPay ENV missing');
  }

  const privateKey = fs.readFileSync(privateKeyPath);

  // axios 实例
  const client = axios.create({
    baseURL: "https://api.mch.weixin.qq.com",
    timeout: 15000,
  });

  // 给每个请求自动签名（Authorization: WECHATPAY2-SHA256-RSA2048 ...）
  client.interceptors.request.use((config) => {
    const method = (config.method || "GET").toUpperCase();
    const urlPath = new URL(config.url, config.baseURL).pathname + (new URL(config.url, config.baseURL).search || "");
    const ts = Math.floor(Date.now() / 1000).toString();
    const nonce = nonceStr(32);
    const body = config.data ? JSON.stringify(config.data) : "";

    const message = `${method}\n${urlPath}\n${ts}\n${nonce}\n${body}\n`;
    const signature = Rsa.sign(message, privateKey); // base64

    config.headers = config.headers || {};
    config.headers["Accept"] = "application/json";
    config.headers["Content-Type"] = "application/json";
    config.headers["Authorization"] =
      `WECHATPAY2-SHA256-RSA2048 mchid="${mchid}",nonce_str="${nonce}",timestamp="${ts}",serial_no="${serialNo}",signature="${signature}"`;

    return config;
  });

  return { instance: client, mchid, appid: process.env.WX_APPID };
}

// 生成 JSAPI paySign（给前端 wx.requestPayment 用）
export function signJsapiParams({ appId, timeStamp, nonceStr, packageStr }) {
  const privateKeyPath = process.env.WX_PRIVATE_KEY_PATH;
  const privateKey = fs.readFileSync(privateKeyPath);

  const message = `${appId}\n${timeStamp}\n${nonceStr}\n${packageStr}\n`;
  const paySign = Rsa.sign(message, privateKey);

  return paySign;
}