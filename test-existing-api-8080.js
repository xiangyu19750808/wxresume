// 测试现有的 /v1/analysis/diagnose 接口（端口8080）
const http = require('http');

const testData = {
  resumeText: "张三\n5年Java开发经验，熟悉Spring Boot和微服务架构\n参与过电商系统开发\n教育背景：本科计算机科学\n技能：Java, Spring Boot, MySQL, Redis",
  jdText: "Java开发工程师招聘\n要求：\n1. 学历：本科及以上\n2. 工作经验：3年以上Java开发经验\n3. 技术栈：精通Spring Boot，熟悉微服务架构\n4. 有电商系统经验者优先"
};

const postData = JSON.stringify(testData);

const options = {
  hostname: 'localhost',
  port: 8080,  // 使用8080端口
  path: '/v1/analysis/diagnose',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log("=== 测试现有的诊断接口 (端口: 8080) ===");

const req = http.request(options, (res) => {
  console.log(`状态码: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      
      if (result.success) {
        console.log("✅ 接口调用成功");
        
        // 检查是否包含九维分析结果
        const hasNineDimensions = result.data && result.data.dimensions;
        const dimensionCount = hasNineDimensions ? Object.keys(result.data.dimensions).length : 0;
        
        console.log(`九维分析维度数: ${dimensionCount}`);
        console.log(`总体得分: ${result.data?.overview?.final_score || 'N/A'}`);
        
        if (dimensionCount >= 6) {
          console.log("✅ 九维分析集成成功！");
          console.log("包含的维度:");
          Object.keys(result.data.dimensions).forEach(dim => {
            const dimData = result.data.dimensions[dim];
            console.log(`  ${dimData.icon} ${dimData.display_name}: ${dimData.current_grade}级 (${dimData.current_score}分)`);
          });
          
          // 显示总体报告
          if (result.data.overview) {
            console.log("\n📊 总体报告:");
            console.log(`  最终得分: ${result.data.overview.final_score}`);
            console.log(`  等级分布:`, result.data.overview.grade_summary);
            console.log(`  改进效果: ${result.data.overview.estimated_improvement}`);
          }
        } else if (dimensionCount > 0) {
          console.log(`⚠️ 找到${dimensionCount}个维度，可能是不完整集成`);
          console.log("维度列表:", Object.keys(result.data.dimensions));
        } else {
          console.log("⚠️ 未找到九维分析数据，可能是原有接口");
          console.log("响应结构:", Object.keys(result.data || {}));
        }
      } else {
        console.log("❌ 接口返回失败:", result.error);
      }
    } catch (e) {
      console.log("❌ 解析响应失败:", e.message);
      console.log("原始响应（前500字符）:", data.substring(0, Math.min(500, data.length)));
    }
  });
});

req.on('error', (e) => {
  if (e.code === 'ECONNREFUSED') {
    console.error("❌ 连接被拒绝，请确保服务器在8080端口运行");
    console.error("运行命令: cd apps/api && npm run dev");
  } else {
    console.error(`❌ 请求错误: ${e.message}`);
  }
});

req.write(postData);
req.end();
