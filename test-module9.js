// 测试模块9：语义匹配契合度
console.log("=== 测试模块9：语义匹配契合度分析器（最后一个模块！） ===");

const { SemanticMatchService } = await import('./apps/api/src/analysis/services/semantic-match.service.js');
const service = new SemanticMatchService();

// 测试用例
const tests = [
  {
    name: "积极表达良好",
    resume: "通过优化系统架构，成功将性能提升300%，为公司节省大量成本",
    jd: "要求能够带来积极成果，创造价值"
  },
  {
    name: "逻辑性一般",
    resume: "做过一些项目，有工作经验",
    jd: "需要逻辑思维清晰，能够系统解决问题"
  },
  {
    name: "风格匹配",
    resume: "以创新思维驱动技术变革，通过系统性优化实现突破",
    jd: "寻找创新思维者，能够推动系统性变革和突破"
  }
];

for (const test of tests) {
  console.log(`\n🧪 ${test.name}`);
  console.log("-".repeat(40));
  
  const result = await service.analyze(test.resume, test.jd);
  
  console.log(`当前: ${result.current_grade}级 (${result.current_score}分)`);
  console.log(`优化: ${result.optimized_grade}级 (${result.optimized_score}分)`);
  console.log(`状态: ${result.status}`);
  console.log(`建议: ${result.directive_abstract}`);
  
  // 验证规范
  console.log(`B→A提升: ${result.optimized_grade === 'A' || result.optimized_grade === 'S' ? '✅' : '❌'}`);
}

console.log("\n=== 模块9规范检查 ===");
console.log("维度名称:", service.dimension === "semantic_match" ? "✅" : "❌");
console.log("显示名称:", service.displayName === "语义匹配契合度" ? "✅" : "❌");
console.log("图标:", service.icon === "🎭" ? "✅" : "❌");
console.log("优先级:", service.priority === "P2" ? "✅" : "❌");

console.log("\n🎉 模块9开发完成！九维分析系统全部模块开发完毕！");
