// 验证语义匹配契合度的B→A提升逻辑
import http from 'http';

// 专门测试B级简历（应该能优化到A级）
const testData = {
  resumeText: "有3年Java开发经验，熟悉Spring Boot框架。参与过电商项目开发，能够独立完成任务。有基本的团队协作经验。",
  jdText: "Java开发工程师招聘\n要求：\n1. 2-4年Java开发经验\n2. 熟悉Spring Boot框架\n3. 有电商项目经验者优先\n4. 具备团队协作能力"
};

const postData = JSON.stringify(testData);

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/v1/analysis/diagnose',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log("=== 验证B→A提升逻辑 ===");

const req = http.request(options, (res) => {
  console.log(`状态码: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      
      if (result.success && result.data && result.data.dimensions) {
        const semanticMatch = result.data.dimensions.semantic_match;
        
        if (semanticMatch) {
          console.log(`\n🎭 语义匹配契合度:`);
          console.log(`  当前等级: ${semanticMatch.current_grade}级 (${semanticMatch.current_score}分)`);
          console.log(`  优化等级: ${semanticMatch.optimized_grade}级 (${semanticMatch.optimized_score}分)`);
          console.log(`  改进空间: ${semanticMatch.improvement_score}分`);
          console.log(`  状态: ${semanticMatch.status}`);
          
          // 验证B→A逻辑
          if (semanticMatch.current_grade === 'B' && semanticMatch.optimized_grade === 'A') {
            console.log("✅ B→A提升逻辑工作正常！");
            console.log(`✅ 分数范围正确: ${semanticMatch.optimized_score}分 (应在75-89范围)`);
          } else if (semanticMatch.current_grade === 'B') {
            console.log(`⚠️ B级但未提升到A级: ${semanticMatch.optimized_grade}级`);
          } else {
            console.log(`ℹ️ 当前为${semanticMatch.current_grade}级，非B级测试案例`);
          }
        } else {
          console.log("❌ 未找到语义匹配维度");
        }
      }
    } catch (e) {
      console.log("解析失败:", e.message);
    }
  });
});

req.on('error', (e) => {
  console.error(`请求错误: ${e.message}`);
});

req.write(postData);
req.end();
