/**
 * 核心能力呈现分析器 - 严格对齐《九维分析呈现标准规范》
 * 核心价值：证明解决问题能力 
 * 优化目标：B级向A级提升 
 * P优先级：P1 
 */
import { BaseDimensionService } from './base-dimension.service.js';

export class CoreAbilityService extends BaseDimensionService {
  constructor() {
    super({
      dimension: "core_ability",
      displayName: "核心能力呈现", 
      icon: "💪",
      priority: "P1"
    });
    
    // 能力关键词库
    this.abilities = {
      "问题解决": ["解决", "优化", "处理", "改进", "修复", "调试", "攻克", "难题"],
      "团队协作": ["协作", "合作", "沟通", "协调", "配合", "团队", "跨部门", "对接"],
      "领导力": ["带领", "领导", "管理", "指导", "负责", "主导", "组织", "统筹"],
      "执行力": ["执行", "完成", "实施", "落实", "推进", "达成", "交付", "产出"],
      "分析能力": ["分析", "评估", "判断", "诊断", "识别", "洞察", "研究", "调研"]
    };
  }

  // === 规范定义 (第二章) ===

  mapScoreToGrade(score) {
    if (score >= 90) return "S";
    if (score >= 75) return "A"; // 规范要求 75-89 为 A 
    if (score >= 60) return "B"; // 规范要求 60-74 为 B [cite: 15]
    if (score >= 40) return "C"; // 规范要求 40-59 为 C [cite: 16]
    return "D";
  }

  getGradeColor(grade) {
    const colors = { 
      S: "#52c41a", A: "#1890ff", B: "#faad14", C: "#fa8c16", D: "#ff4d4f" 
    }; // 严格对齐 2.1 颜色规范 [cite: 12, 13, 15, 16, 17]
    return colors[grade] || "#d9d9d9";
  }

  // === 核心逻辑 ===

  async analyze(resumeText, jdText, structuredResume, structuredJD) {
    try {
      console.log("=== 💪 核心能力呈现分析开始（规范驱动版） ===");
      
      const quantifiedPoints = structuredResume?.quantified_list || [];
      const quantifiedCount = structuredResume?.quantified_count || 0;

      // 1. 获取JD需求
      const requiredAbilities = this.getTopAbilities(jdText, 5);
      
      // 2. 匹配分析
      const abilityScores = requiredAbilities.map(reqAbility => {
        return this.scoreAbility(resumeText, reqAbility, quantifiedPoints);
      });
      
      // 3. 计算当前分
      let currentScore = this.calcTotalScore(abilityScores);
      if (quantifiedCount > 0 && currentScore < 40) {
        currentScore = 40 + (quantifiedCount * 5); // 量化基础分补正
      }
      currentScore = Math.min(100, currentScore);
      const currentGrade = this.mapScoreToGrade(currentScore);

      // 4. 计算优化分 (B级向A级提升目标) 
      const optimizedScore = Math.max(78, Math.min(95, currentScore + 20));
      const optimizedGrade = this.mapScoreToGrade(optimizedScore);
      const improvementScore = optimizedScore - currentScore;

      // 5. 确定规范状态标签 [cite: 19, 20, 21]
      let status = "⏳ 待优化";
      if (currentGrade === "D" && optimizedGrade >= "B") status = "🔓 已解决";
      else if (currentGrade === "C" && optimizedGrade >= "A") status = "🔓 已解决";
      else if (improvementScore >= 10) status = "🔄 已提升";
      else if (currentGrade === "A" || currentGrade === "S") status = "✨ 已优化";

      // 6. 识别问题
      const issues = this.identifyIssues(abilityScores, quantifiedCount);
      
      // 7. 生成规范话术 [cite: 49, 60, 71]
      const statement = this.generateStandardStatement(currentGrade);

      return {
        dimension: "core_ability",
        display_name: "核心能力呈现",
        icon: "💪",
        color: this.getGradeColor(currentGrade),
        current_score: Math.round(currentScore),
        current_grade: currentGrade,
        optimized_score: Math.round(optimizedScore),
        optimized_grade: optimizedGrade,
        status: status,
        improvement_score: Math.round(improvementScore),
        statement: {
          pre_optimization: statement.pre,
          post_optimization: "通过成就量化和案例故事化，已将能力呈现提升至安全水平。" 
        },
        directive_abstract: quantifiedCount === 0 ? "补充经历中的量化成果数据" : "加强核心能力的案例深度描述",
        issue_count: issues.length,
        issues: issues.slice(0, 5),
        detailed_analysis: {
          quantified_count: quantifiedCount,
          ability_breakdown: abilityScores
        }
      };
      
    } catch (error) {
      console.error("核心能力呈现分析错误:", error);
      return this.createErrorResult(error);
    }
  }

  // === 算法逻辑保持高效 ===

  scoreAbility(resumeText, ability, quantifiedPoints) {
    const { name, keywords } = ability;
    let evidenceCount = 0;
    keywords.forEach(keyword => {
      const matches = resumeText.match(new RegExp(keyword, 'g'));
      if (matches) evidenceCount += matches.length;
    });
    const quantifiedBonus = quantifiedPoints.filter(p => keywords.some(k => p.includes(k))).length;
    const score = evidenceCount === 0 ? 0 : Math.min(100, 50 + (evidenceCount * 5) + (quantifiedBonus * 15));
    return { name, score, evidenceCount };
  }

  getTopAbilities(jdText, count = 5) {
    const scores = [];
    Object.entries(this.abilities).forEach(([name, keywords]) => {
      let score = 0;
      keywords.forEach(keyword => {
        const matches = jdText.match(new RegExp(keyword, 'g'));
        if (matches) score += (matches.length * 2);
      });
      if (score > 0) scores.push({ name, score, keywords });
    });
    return scores.sort((a, b) => b.score - a.score).slice(0, count);
  }

  calcTotalScore(abilityScores) {
    if (abilityScores.length === 0) return 30;
    return abilityScores.reduce((sum, s) => sum + s.score, 0) / abilityScores.length;
  }

  // === 话术库 (严格对齐第四章规范) ===

  generateStandardStatement(grade) {
    if (grade === "D") return { 
      pre: "您最重要的核心能力未被有效呈现，在同类简历中缺乏基本辨识度。", // 
      post: "通过补充关键能力证明，已解决能力呈现严重不足的问题。"
    };
    if (grade === "C") return { 
      pre: "能力成就描述不够量化具体，HR可能需要花费更多精力来评估您的实际价值。", // 
      post: "通过引入量化指标，已将能力呈现提升至安全水平。"
    };
    if (grade === "B") return { 
      pre: "能力描述完整，但尚未形成强烈的个人品牌差异化，难以让人过目不忘。", // [cite: 71]
      post: "优化后的能力呈现更具竞争优势，提升了个人品牌辨识度。"
    };
    return { 
      pre: "核心能力呈现良好，展现了突出的职业竞争力和成就影响力。", 
      post: "核心能力已达卓越水平，在竞争中形成明显优势。" 
    };
  }

  identifyIssues(abilityScores, quantifiedCount) {
    const issues = [];
    if (quantifiedCount === 0) {
      issues.push({
        type: "no_quantification",
        severity: "serious",
        description: "经历描述缺乏量化数据支持",
        suggestion: "建议在项目经历中增加百分比、金额或具体数字 "
      });
    }
    return issues;
  }
}