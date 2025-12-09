import { ATSCompatibilityService } from './ats-compatibility.service.js';
import { HardRequirementService } from './hard-requirement.service.js';
import { KeywordDensityService } from './keyword-density.service.js';
import { BaseDimensionService } from './base-dimension.service.js';

export class DiagnoseService {
  constructor() {
    this.analyzers = {
      ats_compatibility: new ATSCompatibilityService(),
      hard_requirements: new HardRequirementService(),
      keyword_density: new KeywordDensityService(),
      // 其他分析器将在后续添加
    };
  }

  async runDiagnose(resumeText, jdText) {
    console.log("=== DiagnoseService开始九维分析 ===");
    
    const results = {};

    // 顺序执行所有分析
    for (const [dimension, analyzer] of Object.entries(this.analyzers)) {
      try {
        console.log(`开始分析: ${analyzer.displayName}`);
        const result = await analyzer.analyze(resumeText, jdText);
        results[dimension] = result;
        console.log(`✅ ${analyzer.displayName} 分析完成`);
      } catch (error) {
        console.error(`❌ ${analyzer.displayName} 分析失败:`, error);
        results[dimension] = this.createErrorResult(dimension, error);
      }
    }

    // 按优先级排序输出
    const orderedResults = {};
    const priorityOrder = ['ats_compatibility', 'hard_requirements', 'keyword_density'];
    
    priorityOrder.forEach(dim => {
      if (results[dim]) {
        orderedResults[dim] = results[dim];
      }
    });

    // 添加其他维度（如果有）
    Object.keys(results).forEach(dim => {
      if (!priorityOrder.includes(dim)) {
        orderedResults[dim] = results[dim];
      }
    });

    console.log("=== 九维分析完成 ===");
    return orderedResults;
  }

  createErrorResult(dimension, error) {
    const errorMessages = {
      ats_compatibility: "ATS兼容性分析失败",
      hard_requirements: "硬性要求匹配分析失败",
      keyword_density: "关键词密度分析失败"
    };

    return {
      dimension,
      display_name: errorMessages[dimension] || "分析失败",
      icon: "❌",
      color: "#ff4d4f",
      current_score: 0,
      current_grade: "D",
      optimized_score: 50,
      optimized_grade: "C",
      status: "⏳ 待优化",
      improvement_score: 50,
      statement: `分析过程中出现错误: ${error.message}`,
      directive_abstract: "系统错误，请稍后重试",
      issue_count: 1,
      issues: [{
        penalty: 0,
        description: "系统分析错误",
        suggestion: "请联系技术支持"
      }]
    };
  }
}
