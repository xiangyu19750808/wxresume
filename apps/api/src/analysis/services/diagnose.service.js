import { SkillMatchService } from './skill-match.service.js';
import { CoreAbilityService } from './core-ability.service.js';

export class DiagnoseService {
  constructor() {
    this.analyzers = {
      core_ability: new CoreAbilityService(),
      skill_match: new SkillMatchService(),
    };
  }

  async diagnose(resumeText, jdText) {
    console.log("开始简历诊断分析...");
    
    const results = {};
    
    // 分析所有维度
    for (const [dimension, analyzer] of Object.entries(this.analyzers)) {
      try {
        console.log(`分析维度: ${dimension}`);
        const result = await analyzer.analyze(resumeText, jdText);
        results[dimension] = result;
      } catch (error) {
        console.error(`维度 ${dimension} 分析失败:`, error);
        results[dimension] = this.createErrorResult(dimension, error);
      }
    }
    
    // 生成总体报告
    const overview = this.generateOverview(results);
    
    return {
      overview,
      dimensions: results
    };
  }
  
  createErrorResult(dimension, error) {
    return {
      dimension,
      display_name: this.getDisplayName(dimension),
      icon: "❌",
      color: "#ff4d4f",
      current_score: 0,
      current_grade: "D",
      optimized_score: 0,
      optimized_grade: "D",
      status: "错误",
      improvement_score: 0,
      statement: {
        pre_optimization: "分析失败",
        post_optimization: "请重新尝试"
      },
      directive_abstract: "系统错误",
      issue_count: 1,
      issues: [{
        type: "analysis_error",
        severity: "critical",
        description: `分析失败: ${error.message}`,
        suggestion: "请联系技术支持"
      }]
    };
  }
  
  getDisplayName(dimension) {
    const names = {
      core_ability: "核心能力呈现",
      skill_match: "技能匹配度"
    };
    return names[dimension] || dimension;
  }
  
  generateOverview(results) {
    const gradeCounts = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    let totalScore = 0;
    let dimensionCount = 0;
    
    Object.values(results).forEach(result => {
      if (result.current_grade && gradeCounts.hasOwnProperty(result.current_grade)) {
        gradeCounts[result.current_grade]++;
      }
      if (result.current_score) {
        totalScore += result.current_score;
        dimensionCount++;
      }
    });
    
    const finalScore = dimensionCount > 0 ? Math.round(totalScore / dimensionCount) : 0;
    
    // 估算改进效果
    const warningCount = gradeCounts.D + gradeCounts.C;
    let improvementEstimate = "无明显改进";
    
    if (warningCount > 2) {
      improvementEstimate = "面试率+50%";
    } else if (warningCount > 0) {
      improvementEstimate = "面试率+30%";
    } else if (gradeCounts.B > 0) {
      improvementEstimate = "面试率+15%";
    } else {
      improvementEstimate = "保持优秀水平";
    }
    
    return {
      final_score: finalScore,
      grade_summary: gradeCounts,
      estimated_improvement: improvementEstimate
    };
  }
}
