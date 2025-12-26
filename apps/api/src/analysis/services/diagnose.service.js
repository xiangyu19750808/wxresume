/**
 * 九维分析诊断服务（极致结构化增强版）
 * 集成所有9个核心维度，并引入 Resume/JD 结构化提取工具
 */
import { ATSCompatibilityService } from './ats-compatibility.service.js';
import { HardRequirementService } from './hard-requirement.service.js';
import { KeywordDensityService } from './keyword-density.service.js';
import { SkillMatchService } from './skill-match.service.js';
import { CoreAbilityService } from './core-ability.service.js';
import { CareerRiskService } from './career-risk.service.js';
import { EducationMatchService } from './education-match.service.js';
import { FunctionMatchService } from './function-match.service.js';
import { SemanticMatchService } from './semantic-match.service.js';

// ✅ 引入新创建的结构化工具
import { ResumeParserUtil } from './resume-parser.util.js';
import { JDParserUtil } from './jd-parser.util.js';

export class DiagnoseService {
  constructor() {
    // 按照九维分析规范，按优先级顺序集成所有9个维度
    this.analyzers = {
      // P0优先级 - 生存保障层
      ats_compatibility: new ATSCompatibilityService(),      // ATS兼容性
      hard_requirement: new HardRequirementService(),        // 硬性要求匹配
      keyword_density: new KeywordDensityService(),          // 关键词密度优化
      skill_match: new SkillMatchService(),                  // 技能匹配度
      core_ability: new CoreAbilityService(),                // 核心能力呈现
      career_risk: new CareerRiskService(),                  // 职业风险控制
      
      // P1优先级 - 门槛过滤层
      education_match: new EducationMatchService(),          // 教育背景匹配
      function_match: new FunctionMatchService(),            // 全维度职能匹配
      
      // P2优先级 - 长期契合层
      semantic_match: new SemanticMatchService()             // 语义匹配契合度
    };
  }

  async diagnose(resumeText, jdText) {
    console.log("\n=== 🚀 九维分析诊断服务开始（极致结构化版） ===");
    
    // ✅ 第1步：前置结构化提取
    // 这样做的好处是：只需提取一次，所有维度共享精准数据，不再重复正则搜索
    const structuredResume = ResumeParserUtil.parse(resumeText);
    const structuredJD = JDParserUtil.parse(jdText);

    console.log(`[结构化完成] 简历量化点: ${structuredResume?.quantified_count || 0}, JD技能要求: ${structuredJD?.skills_required?.length || 0}个`);

    const results = {};

    // 按优先级顺序分析所有维度
    const priorityOrder = [
      'ats_compatibility', 'hard_requirement', 'keyword_density',
      'skill_match', 'core_ability', 'career_risk',
      'education_match', 'function_match', 'semantic_match'
    ];

    for (const dimension of priorityOrder) {
      try {
        const analyzer = this.analyzers[dimension];
        if (!analyzer) {
          console.warn(`警告: 维度 ${dimension} 的分析器不存在`);
          continue;
        }

        console.log(`\n📊 分析维度: ${analyzer.displayName} (${dimension})`);
        
        // ✅ 第2步：将结构化数据作为第三、四个参数传入（兼容旧 Service）
        // 如果你的子 Service 还没升级接收这些参数，它们会继续用原始 text
        const result = await analyzer.analyze(resumeText, jdText, structuredResume, structuredJD);
        results[dimension] = result;
        
        console.log(`  结果: ${result.current_grade}级 (${result.current_score}分) → 优化: ${result.optimized_grade}级 (${result.optimized_score}分)`);
        console.log(`  状态: ${result.status}, 改进空间: ${result.improvement_score}分`);
        
      } catch (error) {
        console.error(`❌ 维度 ${dimension} 分析失败:`, error);
        results[dimension] = this.createErrorResult(dimension, error);
      }
    }

    // 生成总体报告
    const overview = this.generateOverview(results);

    console.log("\n=== ✅ 九维分析完成 ===");
    console.log(`总体得分: ${overview.final_score}`);
    console.log(`等级分布:`, overview.grade_summary);
    console.log(`预计改进效果: ${overview.estimated_improvement}`);

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
      // P0优先级
      ats_compatibility: "ATS系统兼容性",
      hard_requirement: "硬性要求匹配",
      keyword_density: "关键词排名优化",
      skill_match: "技能匹配度",
      core_ability: "核心能力呈现",
      career_risk: "职业风险控制",
      
      // P1优先级
      education_match: "教育背景匹配",
      function_match: "全维度职能匹配",
      
      // P2优先级
      semantic_match: "语义匹配契合度"
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

    // 估算改进效果（基于问题严重程度）
    const warningCount = gradeCounts.D + gradeCounts.C;
    let improvementEstimate = "无明显改进";

    if (warningCount >= 3) {
      improvementEstimate = "面试率+50%";
    } else if (warningCount >= 1) {
      improvementEstimate = "面试率+30%";
    } else if (gradeCounts.B > 0) {
      improvementEstimate = "面试率+15%";
    } else if (gradeCounts.A > 0 || gradeCounts.S > 0) {
      improvementEstimate = "保持优秀水平";
    }

    return {
      final_score: finalScore,
      grade_summary: gradeCounts,
      dimension_count: dimensionCount,
      estimated_improvement: improvementEstimate,
      has_critical_issues: warningCount > 0
    };
  }
}