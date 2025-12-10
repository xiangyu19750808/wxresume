// 快速检查模块9
const { SemanticMatchService } = require('./apps/api/src/analysis/services/semantic-match.service.js');
const service = new SemanticMatchService();

console.log("✅ 模块9基本信息:");
console.log("- 维度名称:", service.dimension);
console.log("- 显示名称:", service.displayName);
console.log("- 图标:", service.icon);
console.log("- 优先级:", service.priority);

// 运行一个快速测试
const quickResume = "3年Java经验，熟悉Spring Boot。";
const quickJD = "招聘Java开发工程师。";

service.analyze(quickResume, quickJD).then(result => {
  console.log("\n✅ 快速测试结果:");
  console.log("- 当前等级:", result.current_grade);
  console.log("- 优化等级:", result.optimized_grade);
  console.log("- 状态:", result.status);
  
  // 验证B→A逻辑
  if (result.current_grade === 'B' && result.optimized_grade === 'A') {
    console.log("- B→A提升: ✅ 工作正常");
  } else if (result.current_grade === 'B') {
    console.log("- B→A提升: ❌ 需要检查");
  } else {
    console.log("- B→A提升: 当前为", result.current_grade, "级");
  }
  
  console.log("\n🎉 模块9验证完成！");
});
