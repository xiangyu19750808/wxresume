// 快速检查模块9（ES模块版本）
import { SemanticMatchService } from './apps/api/src/analysis/services/semantic-match.service.js';

const service = new SemanticMatchService();

console.log("✅ 模块9基本信息:");
console.log("- 维度名称:", service.dimension);
console.log("- 显示名称:", service.displayName);
console.log("- 图标:", service.icon);
console.log("- 优先级:", service.priority);

// 运行一个快速测试
const quickResume = "有5年Java开发经验，熟悉Spring Boot和微服务架构。参与过电商系统开发，优化了系统性能。";
const quickJD = "招聘Java开发工程师，要求有电商系统经验，熟悉Spring Boot和微服务。";

try {
  const result = await service.analyze(quickResume, quickJD);
  
  console.log("\n✅ 快速测试结果:");
  console.log("- 当前等级:", result.current_grade);
  console.log("- 优化等级:", result.optimized_grade);
  console.log("- 状态:", result.status);
  console.log("- 当前分数:", result.current_score);
  console.log("- 优化分数:", result.optimized_score);
  
  // 验证B→A逻辑
  if (result.current_grade === 'B' && result.optimized_grade === 'A') {
    console.log("- B→A提升: ✅ 工作正常");
  } else if (result.current_grade === 'B') {
    console.log("- B→A提升: ❌ 需要检查");
  } else {
    console.log("- B→A提升: 当前为", result.current_grade, "级");
  }
  
  console.log("\n🎉 模块9验证完成！");
} catch (error) {
  console.error("测试失败:", error);
}
