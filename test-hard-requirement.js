// 测试硬性要求匹配
import { HardRequirementService } from './apps/api/src/analysis/services/hard-requirement.service.js';

async function testHardRequirement() {
  const service = new HardRequirementService();
  
  const jdText = `
职位：高级前端工程师
要求：
1. 学历：本科及以上
2. 工作经验：3年以上前端开发经验
3. 证书：要求具备PMP证书
4. 技能：精通React、熟练Vue、掌握TypeScript
`;

  const resumeText1 = `
张三
教育背景：硕士，计算机科学
工作经验：5年前端开发经验
证书：PMP认证、前端开发工程师
技能：精通React、Vue、TypeScript、Node.js
`;

  const resumeText2 = `
李四  
教育背景：大专，软件工程
工作经验：1年前端开发经验
技能：了解React、Vue
`;

  console.log("测试1：匹配度高的简历");
  const result1 = await service.analyze(resumeText1, jdText);
  console.log("分数:", result1.current_score, "等级:", result1.current_grade);
  console.log("问题数量:", result1.issue_count);
  
  console.log("\n测试2：匹配度低的简历");
  const result2 = await service.analyze(resumeText2, jdText);
  console.log("分数:", result2.current_score, "等级:", result2.current_grade);
  console.log("问题数量:", result2.issue_count);
  result2.issues.forEach(issue => {
    console.log("  -", issue.description, "(扣", issue.penalty, "分)");
  });
}

testHardRequirement().catch(console.error);
