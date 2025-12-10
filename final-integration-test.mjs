// 最终集成测试：语义匹配契合度分析器
import { SemanticMatchService } from './apps/api/src/analysis/services/semantic-match.service.js';

console.log("=== 🎭 语义匹配契合度分析器 - 最终集成测试 ===\n");

const service = new SemanticMatchService();

// 测试用例：模拟真实场景
const testCases = [
  {
    name: "典型B级简历 → A级优化",
    description: "标准的中级工程师简历，应该有B级，优化到A级",
    resume: "5年Java开发经验，熟悉Spring Boot框架和微服务架构。参与过电商系统开发，负责订单和支付模块。有团队协作经验，能够独立完成任务。",
    jd: "招聘Java开发工程师，要求3-5年经验，熟悉Spring Boot，有电商系统开发经验。需要团队协作能力和独立开发能力。",
    expected: { current: "B", optimized: "A" }
  },
  {
    name: "优秀简历（接近A级）",
    description: "表现良好的简历，可能直接达到A级",
    resume: "资深Java工程师，6年经验，精通微服务和分布式系统。曾主导高并发系统设计，性能优化显著。带领团队完成多个重要项目。",
    jd: "高级Java工程师，要求5年以上经验，精通微服务架构，有高并发系统经验，具备技术领导能力。",
    expected: { current: "A", optimized: "A" }
  },
  {
    name: "基础简历（C级）",
    description: "初级工程师简历，应该是C级",
    resume: "1年Java开发经验，会使用Spring Boot。参与过项目开发，能够完成基本任务。",
    jd: "初级Java开发工程师，要求1-2年经验，熟悉Spring Boot，有学习能力。",
    expected: { current: "C", optimized: "B" }
  }
];

console.log("运行最终集成测试...\n");

let allPassed = true;

for (const test of testCases) {
  console.log(`🧪 ${test.name}`);
  console.log(`📝 ${test.description}`);
  console.log("-".repeat(50));
  
  const result = await service.analyze(test.resume, test.jd);
  
  console.log(`当前: ${result.current_grade}级 (${result.current_score}分) | 期望: ${test.expected.current}级`);
  console.log(`优化: ${result.optimized_grade}级 (${result.optimized_score}分) | 期望: ${test.expected.optimized}级`);
  console.log(`状态: ${result.status}`);
  console.log(`改进: ${result.improvement_score}分`);
  
  // 检查结果
  const currentMatch = result.current_grade === test.expected.current;
  const optimizedMatch = result.optimized_grade === test.expected.optimized;
  
  if (currentMatch && optimizedMatch) {
    console.log("✅ 测试通过");
  } else {
    console.log("❌ 测试失败");
    if (!currentMatch) console.log(`  当前等级不匹配: 期望${test.expected.current}, 实际${result.current_grade}`);
    if (!optimizedMatch) console.log(`  优化等级不匹配: 期望${test.expected.optimized}, 实际${result.optimized_grade}`);
    allPassed = false;
  }
  
  // 特殊检查：B→A提升
  if (result.current_grade === 'B') {
    console.log(`B→A提升检查: ${result.optimized_grade === 'A' ? '✅ 成功' : '❌ 失败'}`);
  }
  
  console.log("\n详细分析:");
  console.log(`- 积极词数量: ${result.detailed_analysis.positivity_count}`);
  console.log(`- 逻辑词数量: ${result.detailed_analysis.logic_count}`);
  console.log(`- 风格匹配词: ${result.detailed_analysis.style_match_count}`);
  
  console.log("\n" + "=".repeat(50) + "\n");
}

// 专项测试：B→A提升逻辑
console.log("=== 🔍 B→A提升逻辑专项验证 ===\n");

const bTestResume = "3年Java开发经验，熟悉Spring Boot。参与过2个电商项目，能够独立开发功能模块。有基本的团队协作经验。";
const bTestJD = "Java开发工程师，要求2-4年经验，熟悉Spring Boot，有电商项目经验，能够独立完成任务。";

const bTestResult = await service.analyze(bTestResume, bTestJD);
console.log(`测试用例: 中级Java工程师`);
console.log(`当前等级: ${bTestResult.current_grade}级 (期望: B级)`);
console.log(`优化等级: ${bTestResult.optimized_grade}级 (期望: A级)`);

const bToAPassed = bTestResult.current_grade === 'B' && bTestResult.optimized_grade === 'A';
console.log(`B→A提升: ${bToAPassed ? '✅ 成功' : '❌ 失败'}`);

if (bToAPassed) {
  console.log("\n🎉 B→A提升逻辑验证通过！");
} else {
  console.log(`\n⚠️ B→A提升逻辑需要调整: 当前${bTestResult.current_grade} → 优化${bTestResult.optimized_grade}`);
}

console.log("\n=== 🎯 最终测试结果 ===");
if (allPassed && bToAPassed) {
  console.log("✅ 所有测试通过！");
  console.log("✅ 模块9生产就绪！");
  console.log("✅ B→A提升逻辑正确实现！");
  console.log("✅ 可以集成到九维分析系统！");
} else {
  console.log("⚠️ 部分测试失败，需要调整");
}

console.log("\n🚀 模块9开发完成！");
