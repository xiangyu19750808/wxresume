import crypto from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';

const privateKey = fs.readFileSync('/root/wxresume/apps/api/wxpay/apiclient_key.pem', 'utf8').trim();
// 微信支付基础配置
const MCH_ID = process.env.WXPAY_MCH_ID || '1728914815';
const SERIAL_NO = process.env.WXPAY_SERIAL_NO || '69A2A1234788FE971FD4B415DEA1EE5C9D5FF662';
const APPID = process.env.WXPAY_APPID || 'wx87ca4e3a9535a654';

// 调试信息（可选，能帮你确认当前读取的是哪里的值）
if (!process.env.WXPAY_MCH_ID) {
  console.log('⚠️ 提示：未检测到 .env 配置，正在使用默认/Mock配置运行');
}

// 签名生成函数
function generateSignature(method, url, timestamp, nonce, body) {
  const message = `${method}\n${url}\n${timestamp}\n${nonce}\n${body}\n`;
  return crypto.createSign('RSA-SHA256').update(message).sign(privateKey, 'base64');
}

const pay = {
  transactions_jsapi: (params) => {
    return new Promise((resolve, reject) => {
      const url = '/v3/pay/transactions/jsapi';
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = crypto.randomBytes(16).toString('hex');
      const body = JSON.stringify(params);
      
      const signature = generateSignature('POST', url, timestamp, nonce, body);
      const authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${MCH_ID}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${SERIAL_NO}"`;

      const options = {
        hostname: 'api.mch.weixin.qq.com',
        path: url,
        method: 'POST',
        headers: {
          'Authorization': authorization,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Native-Node-HTTPS',
          'Content-Length': Buffer.byteLength(body)
        }
      };

      console.log('>>> [原生支付] 发起 V3 请求:', params.out_trade_no);

      const req = https.request(options, (res) => {
        let resData = '';
        res.on('data', (chunk) => resData += chunk);
        res.on('end', () => {
          try {
            const parsedData = resData ? JSON.parse(resData) : {};
            resolve({ status: res.statusCode, data: parsedData });
          } catch (e) {
            resolve({ status: res.statusCode, data: resData });
          }
        });
      });

      req.on('error', (e) => {
        console.error('>>> [原生支付] 请求失败:', e);
        reject(e);
      });

      req.write(body);
      req.end();
    });
  }
};

console.log('>>> [微信支付] ✅ 纯原生 Node.js HTTPS 驱动加载成功（零依赖模式）');
export default pay;
