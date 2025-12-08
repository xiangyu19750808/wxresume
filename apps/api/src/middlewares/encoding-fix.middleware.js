// 编码修复中间件
function encodingFixMiddleware(req, res, next) {
  // 保存原始body
  let rawBody = '';
  
  req.on('data', chunk => {
    rawBody += chunk.toString('binary'); // 保持二进制格式
  });
  
  req.on('end', () => {
    try {
      // 尝试多种编码方式解码
      let decodedBody;
      
      // 尝试1: UTF-8
      try {
        decodedBody = Buffer.from(rawBody, 'binary').toString('utf8');
        console.log("使用UTF-8解码成功");
      } catch (e) {
        console.log("UTF-8解码失败:", e.message);
      }
      
      // 尝试2: GBK/GB2312（常见中文编码）
      try {
        const iconv = require('iconv-lite');
        decodedBody = iconv.decode(Buffer.from(rawBody, 'binary'), 'gbk');
        console.log("使用GBK解码成功");
      } catch (e) {
        console.log("GBK解码失败（可能需要安装iconv-lite）");
      }
      
      // 尝试3: Latin1作为后备
      if (!decodedBody) {
        decodedBody = Buffer.from(rawBody, 'binary').toString('latin1');
        console.log("使用Latin1解码");
      }
      
      // 解析JSON
      if (decodedBody) {
        try {
          req.body = JSON.parse(decodedBody);
          req.rawBody = rawBody; // 保存原始二进制数据
          console.log("JSON解析成功");
        } catch (e) {
          console.log("JSON解析失败:", e.message);
        }
      }
      
      next();
    } catch (error) {
      console.error("编码修复中间件错误:", error);
      next(error);
    }
  });
}

module.exports = encodingFixMiddleware;
