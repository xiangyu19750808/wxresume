// 检查输出格式是否符合规范
console.log("=== 检查模块4输出格式 ===");

const { SkillMatchService } = await import('./apps/api/src/analysis/services/skill-match.service.js');

const resumeText = `
李四 - 前端开发工程师

专业技能：
- 熟悉React，有项目开发经验
- 掌握JavaScript基础知识
`;

const jdText = `
前端开发工程师

要求：
1. 精通React框架
2. 熟练掌握JavaScript
`;

const service = new SkillMatchService();
const result = await service.analyze(resumeText, jdText);

console.log("\n=== 实际输出结构 ===");
console.log("维度字段检查：");

// 必填字段检查
const requiredFields = [
  'dimension',
  'display_name', 
  'icon',
  'current_score',
  'current_grade',
  'optimized_score',
  'optimized_grade',
  'status',
  'statement',
  'directive_abstract',
  'improvement_score'
];

requiredFields.forEach(field => {
  const hasField = field in result;
  const value = result[field];
  console.log(`${hasField ? '✅' : '❌'} ${field}: ${JSON.stringify(value)}`);
});

console.log("\n=== statement结构检查 ===");
if (result.statement) {
  console.log(`✅ statement是对象: ${typeof result.statement === 'object'}`);
  console.log(`✅ pre_optimization存在: ${'pre_optimization' in result.statement}`);
  console.log(`✅ post_optimization存在: ${'post_optimization' in result.statement}`);
  console.log(`pre_optimization内容: ${result.statement.pre_optimization}`);
  console.log(`post_optimization内容: ${result.statement.post_optimization}`);
} else {
  console.log("❌ statement不存在");
}

console.log("\n=== 规范符合性详细检查 ===");

// 1. 检查等级是否正确（S/A/B/C/D）
const validGrades = ['S', 'A', 'B', 'C', 'D'];
console.log(`当前等级是否有效: ${validGrades.includes(result.current_grade) ? '✅' : '❌'}`);
console.log(`优化等级是否有效: ${validGrades.includes(result.optimized_grade) ? '✅' : '❌'}`);

// 2. 检查icon是否正确
console.log(`图标是否正确: ${result.icon === '🛠️' ? '✅' : '❌'}`);

// 3. 检查status格式
const validStatusPatterns = ['🔴 急需优化', '🟡 建议优化', '✅ 已达标', '🟢 状态良好', '⏳ 待优化'];
console.log(`状态格式: ${result.status} ${validStatusPatterns.includes(result.status) ? '✅' : '⚠️'}`);

// 4. 检查分数范围
console.log(`当前分数范围(0-100): ${result.current_score >= 0 && result.current_score <= 100 ? '✅' : '❌'}`);
console.log(`优化分数范围(0-100): ${result.optimized_score >= 0 && result.optimized_score <= 100 ? '✅' : '❌'}`);

// 5. 检查improvement_score计算
const expectedImprovement = result.optimized_score - result.current_score;
console.log(`improvement_score计算正确: ${result.improvement_score === expectedImprovement ? '✅' : '❌'}`);

// 6. 检查是否符合B级目标（规范3.1章要求）
console.log("\n=== 规范3.1章检查 ===");
console.log(`维度名称: ${result.display_name}`);
console.log(`核心价值: 证明工具技能`);
console.log(`必须达到等级: B级（合格）`);
console.log(`优化后等级: ${result.optimized_grade} ${result.optimized_grade === 'B' ? '✅ 符合' : '❌ 不符合'}`);
console.log(`优化焦点: 技能词识别与场景对应`);
console.log(`P优先级: P1（竞争优势层） ${service.priority === 'P1' ? '✅' : '❌'}`);

// 7. 检查statement是否符合4.3章B级提示规范
console.log("\n=== 规范4.3章检查（B级提升提示） ===");
if (result.current_grade === 'B') {
  console.log(`B级提示基调: "有优化空间以增强竞争力"`);
  console.log(`当前statement: ${result.statement.pre_optimization}`);
  
  // 检查是否包含"但"等温和提示词
  const hasMildTone = result.statement.pre_optimization.includes('但') || 
                      result.statement.pre_optimization.includes('尚未') ||
                      result.statement.pre_optimization.includes('缺乏');
  console.log(`是否温和提示: ${hasMildTone ? '✅' : '⚠️'}`);
}

// 8. 检查输出JSON是否可以直接用于规范6.1章
console.log("\n=== 规范6.1章JSON结构检查 ===");
try {
  const jsonOutput = JSON.stringify(result, null, 2);
  console.log("✅ 输出可序列化为JSON");
  console.log(`输出大小: ${jsonOutput.length} 字符`);
} catch (e) {
  console.log("❌ JSON序列化失败:", e.message);
}

console.log("\n=== 完整输出预览 ===");
console.log(JSON.stringify(result, null, 2).substring(0, 1000) + "...");
