// 快速检查维度计数问题
import { DiagnoseService } from './apps/api/src/analysis/services/diagnose.service.js';

const service = new DiagnoseService();

console.log("检查维度分析器数量...");
console.log("analyzers对象:", Object.keys(service.analyzers));
console.log("维度数量:", Object.keys(service.analyzers).length);

// 检查是否有重复或遗漏
const expectedDimensions = [
  'ats_compatibility', 'hard_requirement', 'keyword_density',
  'skill_match', 'core_ability', 'career_risk',
  'education_match', 'function_match', 'semantic_match'
];

expectedDimensions.forEach(dim => {
  const exists = dim in service.analyzers;
  console.log(`${dim}: ${exists ? '✅ 存在' : '❌ 缺失'}`);
});
