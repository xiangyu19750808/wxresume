import { HardRequirementService } from './apps/api/src/analysis/services/hard-requirement.service.js';

async function test() {
  const service = new HardRequirementService();
  
  const jdText = "高级前端工程师要求：1. 学历：本科及以上 2. 工作经验：3年以上前端开发经验";
  const resume1 = "张三 教育背景：硕士 工作经验：5年前端开发经验";
  const resume2 = "李四 教育背景：大专 工作经验：1年前端开发经验";
  
  console.log("=== 测试简历1（高匹配）===");
  const result1 = await service.analyze(resume1, jdText);
  console.log("分数:", result1.current_score, "问题:", result1.issue_count);
  
  console.log("\n=== 测试简历2（低匹配）===");
  const result2 = await service.analyze(resume2, jdText);
  console.log("分数:", result2.current_score, "问题:", result2.issue_count);
  result2.issues.forEach(issue => {
    console.log(" 问题:", issue.description);
  });
}

test().catch(console.error);
