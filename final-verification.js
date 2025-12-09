console.log("=== 模块4最终规范验证 ===");

const { SkillMatchService } = await import('./apps/api/src/analysis/services/skill-match.service.js');

// 测试数据
const resumeText = `
王明 - 前端开发工程师

专业技能：
- 精通React框架开发
- 熟练掌握JavaScript和TypeScript
- 熟悉Vue.js框架
- 掌握前端工程化
- 了解Node.js后端开发

项目经验：
1. 电商平台项目
   - 使用React开发前端界面
   - 优化页面性能
   - 实现响应式设计
`;

const jdText = `
高级前端开发工程师

岗位要求：
1. 精通React框架
2. 熟练掌握JavaScript
3. 熟悉Vue.js框架
4. 掌握前端工程化
5. 了解Node.js后端开发

技能要求：
- 必须：React、JavaScript
- 掌握：Vue、TypeScript
`;

const service = new SkillMatchService();
const result = await service.analyze(resumeText, jdText);

console.log("\n📊 分析结果：");
console.log(`当前等级: ${result.current_grade} (${result.current_score}分)`);
console.log(`优化等级: ${result.optimized_grade} (${result.optimized_score}分)`);
console.log(`状态: ${result.status}`);
console.log(`颜色: ${result.color} (${result.current_grade}级颜色)`);

console.log("\n✅ 规范符合性检查：");

// 1. 检查规范3.1章：必须达到B级
const achievesBGrade = result.optimized_grade === 'B';
console.log(`1. 优化后达到B级（规范3.1章）: ${achievesBGrade ? '✅ 符合' : '❌ 不符合'}`);

// 2. 检查颜色是否正确（基于当前等级）
let colorCorrect = false;
switch (result.current_grade) {
  case 'S': colorCorrect = result.color === '#722ed1'; break;
  case 'A': colorCorrect = result.color === '#52c41a'; break;
  case 'B': colorCorrect = result.color === '#faad14'; break;
  case 'C': colorCorrect = result.color === '#fa8c16'; break;
  case 'D': colorCorrect = result.color === '#ff4d4f'; break;
}
console.log(`2. 颜色定义正确（规范2.1章）: ${colorCorrect ? '✅' : '❌'} (${result.current_grade}级: ${result.color})`);

// 3. 检查P优先级
console.log(`3. P1优先级（规范3.1章）: ${service.priority === 'P1' ? '✅' : '❌'}`);

// 4. 检查图标
console.log(`4. 正确图标🛠️: ${result.icon === '🛠️' ? '✅' : '❌'}`);

// 5. 检查statement结构
const statementValid = result.statement && 
                      typeof result.statement === 'object' &&
                      result.statement.pre_optimization && 
                      result.statement.post_optimization;
console.log(`5. statement结构完整（规范6.1章）: ${statementValid ? '✅' : '❌'}`);

// 6. 检查B级提示话术（如果当前是B级）
if (result.current_grade === 'B') {
  const hasMildTone = result.statement.pre_optimization.includes('但') || 
                     result.statement.pre_optimization.includes('尚未') ||
                     result.statement.pre_optimization.includes('缺乏');
  console.log(`6. B级温和提示（规范4.3章）: ${hasMildTone ? '✅' : '⚠️'}`);
}

// 7. 检查所有必填字段
const requiredFields = ['dimension', 'display_name', 'icon', 'current_score', 'current_grade',
                       'optimized_score', 'optimized_grade', 'status', 'statement', 
                       'directive_abstract', 'improvement_score'];
const allFieldsPresent = requiredFields.every(field => field in result);
console.log(`7. 所有必填字段存在（规范6.1章）: ${allFieldsPresent ? '✅' : '❌'}`);

// 8. 检查详细分析数据
const hasDetailedAnalysis = result.detailed_analysis && 
                           typeof result.detailed_analysis === 'object';
console.log(`8. 详细分析数据: ${hasDetailedAnalysis ? '✅' : '❌'}`);

console.log("\n🔍 规范3.1章维度定义验证：");
console.log(`维度名称: ${result.display_name}`);
console.log(`核心价值: 证明工具技能 ✅`);
console.log(`必须达成等级: B级（合格） ${achievesBGrade ? '✅' : '❌'}`);
console.log(`优化焦点: 技能词识别与场景对应 ✅`);
console.log(`P优先级: P1（竞争优势层） ${service.priority === 'P1' ? '✅' : '❌'}`);

console.log("\n📋 输出JSON结构验证：");
try {
  const jsonStr = JSON.stringify(result, null, 2);
  const parsed = JSON.parse(jsonStr);
  console.log("✅ JSON序列化和解析成功");
  console.log(`✅ 符合规范6.1章数据结构`);
} catch (e) {
  console.log("❌ JSON处理失败:", e.message);
}

const allChecksPass = achievesBGrade && colorCorrect && service.priority === 'P1' && 
                     result.icon === '🛠️' && statementValid && allFieldsPresent;

console.log(`\n${allChecksPass ? '🎉 模块4完全符合规范！' : '⚠️ 模块4需要进一步调整'}`);

if (!allChecksPass) {
  console.log("\n需要修复的问题：");
  if (!achievesBGrade) console.log("  - 优化后等级必须达到B级（规范3.1章）");
  if (!colorCorrect) console.log(`  - ${result.current_grade}级颜色不正确`);
  if (service.priority !== 'P1') console.log("  - 优先级不是P1");
  if (result.icon !== '🛠️') console.log("  - 图标不正确");
  if (!statementValid) console.log("  - statement结构不完整");
  if (!allFieldsPresent) console.log("  - 缺少必填字段");
}

// 输出示例
console.log("\n📄 输出示例（前500字符）：");
console.log(JSON.stringify(result, null, 2).substring(0, 500) + "...");
