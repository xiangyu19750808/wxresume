// 测试编码问题的脚本
const http = require('http');

const testData = {
  resumeText: "李四\n教育背景：大专，软件工程\n工作经验：1年前端开发经验\n技能：了解React、Vue",
  jdText: "高级前端工程师\n要求：\n1. 学历：本科及以上\n2. 工作经验：3年以上前端开发经验\n3. 证书：要求具备PMP证书\n4. 技能：精通React、熟练Vue、掌握TypeScript"
};

const postData = JSON.stringify(testData);

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/v1/analysis/diagnose',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(postData, 'utf8')
  }
};

console.log("发送测试请求...");
console.log("请求体长度:", Buffer.byteLength(postData, 'utf8'));
console.log("请求体前200字节:", postData.substring(0, 200));

const req = http.request(options, (res) => {
  console.log(`状态码: \${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log("响应接收完成");
    try {
      const result = JSON.parse(data);
      console.log("硬性要求分数:", result.data?.hard_requirements?.current_score);
    } catch (e) {
      console.log("解析响应失败:", e.message);
    }
  });
});

req.on('error', (e) => {
  console.error(`请求错误: \${e.message}`);
});

// 使用正确的编码写入数据
req.write(postData, 'utf8');
req.end();
