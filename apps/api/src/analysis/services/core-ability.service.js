/**
 * 核心能力呈现分析器（完全规范版）
 * 维度5：核心能力呈现 - 证明解决问题能力
 * 安全等级：B级向A级提升
 * 优先级：P1
 * 用户价值分层：第二层（竞争优势）
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
    
    // 能力关键词库（10种常见能力）
    this.abilities = {
      "问题解决": ["解决", "优化", "处理", "改进", "修复", "调试", "攻克", "难题"],
      "团队协作": ["协作", "合作", "沟通", "协调", "配合", "团队", "跨部门", "对接"],
      "领导力": ["带领", "领导", "管理", "指导", "负责", "主导", "组织", "统筹"],
      "创新能力": ["创新", "设计", "开发", "创造", "发明", "实现", "革新", "突破"],
      "学习能力": ["学习", "掌握", "研究", "探索", "了解", "精通", "深入", "钻研"],
      "执行力": ["执行", "完成", "实施", "落实", "推进", "达成", "交付", "产出"],
      "沟通能力": ["沟通", "表达", "汇报", "演讲", "演示", "讲解", "说服", "谈判"],
      "分析能力": ["分析", "评估", "判断", "诊断", "识别", "洞察", "研究", "调研"],
      "项目管理": ["项目", "规划", "计划", "进度", "控制", "跟踪", "监控", "协调"],
      "责任心": ["负责", "认真", "细致", "严谨", "可靠", "担当", "敬业", "踏实"]
    };
  }
  
  // 覆盖基类的mapScoreToGrade方法，确保符合规范
  mapScoreToGrade(score) {
    // 严格遵循规范第2.1章：75分以上为A级
    if (score >= 90) return "S";
    if (score >= 75) return "A";  // 75-89分为A级（规范要求）
    if (score >= 60) return "B";  // 60-74分为B级  
    if (score >= 40) return "C";  // 40-59分为C级
    return "D";                   // 0-39分为D级
  }
  
  // 覆盖基类的getGradeColor方法，确保符合规范
  getGradeColor(grade) {
    // 严格遵循规范第2.1章的颜色值
    const colors = {
      S: "#52c41a", // 绿色
      A: "#1890ff", // 蓝色（规范要求：A级）
      B: "#faad14", // 黄色/橙色（规范要求：B级）
      C: "#fa8c16", // 橙色（规范要求：C级）
      D: "#ff4d4f"  // 红色（规范要求：D级）
    };
    return colors[grade] || "#d9d9d9";
  }
  
  // 覆盖基类的determineStatus方法
  determineStatus(currentGrade, optimizedGrade, improvementScore) {
    // 遵循规范第2.2章
    if (currentGrade === "S") return "🏆 卓越";
    if (optimizedGrade === "S") return "🚀 冲刺";
    if (optimizedGrade > currentGrade) {
      return improvementScore >= 15 ? "📈 显著提升" : "⬆️ 待提升";
    }
    if (currentGrade === "A") return "✅ 良好";
    return "⏳ 待优化";
  }
  
  async analyze(resumeText, jdText) {
    try {
      console.log("=== 💪 核心能力呈现分析开始 ===");
      
      // 1. 从JD提取TOP5能力需求
      const requiredAbilities = this.getTopAbilities(jdText, 5);
      console.log("JD需求能力:", requiredAbilities.map(a => a.name));
      
      // 2. 分析简历中的能力匹配度
      const abilityScores = requiredAbilities.map(reqAbility => {
        return this.scoreAbility(resumeText, reqAbility);
      });
      
      // 3. 计算当前分数和等级
      const currentScore = this.calcTotalScore(abilityScores);
      const currentGrade = this.mapScoreToGrade(currentScore);
      
      // 4. 计算优化后分数和等级（强制B→A提升）
      const optimizedScore = this.calculateOptimizedScore(currentScore, abilityScores);
      const optimizedGrade = this.mapScoreToGrade(optimizedScore);
      const improvementScore = optimizedScore - currentScore;
      
      // 5. 确定状态标签（根据规范第2.2章）
      const status = this.determineStatus(currentGrade, optimizedGrade, improvementScore);
      
      // 6. 生成后果陈述（根据规范第4章）
      const statement = this.generateStatement(currentGrade, abilityScores);
      
      // 7. 生成优化摘要
      const directiveAbstract = this.generateDirectiveAbstract(abilityScores);
      
      // 8. 识别问题
      const issues = this.identifyIssues(abilityScores);
      
      // 9. 返回规范格式结果
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
          post_optimization: statement.post
        },
        directive_abstract: directiveAbstract,
        issue_count: issues.length,
        issues: issues.slice(0, 5),
        detailed_analysis: {
          required_abilities: requiredAbilities.map(a => a.name),
          ability_count: abilityScores.length,
          missing_count: abilityScores.filter(s => s.score === 0).length,
          average_score: Math.round(abilityScores.reduce((sum, s) => sum + s.score, 0) / abilityScores.length),
          ability_breakdown: abilityScores.map(s => ({
            name: s.name,
            score: s.score,
            evidence_count: s.evidenceCount,
            is_weak: s.score < 60
          }))
        }
      };
      
    } catch (error) {
      console.error("核心能力呈现分析错误:", error);
      return this.createErrorResult(error);
    }
  }
  
  // === 核心算法 ===
  
  getTopAbilities(jdText, count = 5) {
    const scores = [];
    
    Object.entries(this.abilities).forEach(([name, keywords]) => {
      let score = 0;
      keywords.forEach(keyword => {
        const matches = jdText.match(new RegExp(keyword, 'g'));
        if (matches) score += matches.length;
      });
      
      if (score > 0) {
        scores.push({ name, score, keywords });
      }
    });
    
    // 按分数排序，取TOP N
    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, count);
  }
  
  scoreAbility(resumeText, ability) {
    const { name, keywords } = ability;
    let evidenceCount = 0;
    
    keywords.forEach(keyword => {
      const matches = resumeText.match(new RegExp(keyword, 'g'));
      if (matches) evidenceCount += matches.length;
    });
    
    // 计分：有证据得60分，每多一个证据加10分，最高100分
    const score = evidenceCount === 0 ? 0 : Math.min(100, 60 + (evidenceCount - 1) * 10);
    
    return {
      name,
      score: Math.round(score),
      evidenceCount,
      keywords: keywords.slice(0, 3)
    };
  }
  
  calcTotalScore(abilityScores) {
    if (abilityScores.length === 0) return 75;
    
    const total = abilityScores.reduce((sum, s) => sum + s.score, 0);
    const average = total / abilityScores.length;
    
    // 如果有完全缺失的能力，适当扣分
    const missingCount = abilityScores.filter(s => s.score === 0).length;
    const penalty = missingCount * 8;
    
    return Math.max(0, Math.min(100, average - penalty));
  }
  
  calculateOptimizedScore(currentScore, abilityScores) {
    // 规范要求：核心能力呈现必须支持从B级向A级提升
    const aLevelMin = 75; // A级起点
    
    // 如果已经在A级或S级，适度提升
    if (currentScore >= aLevelMin) {
      return Math.min(currentScore >= 90 ? 100 : 89, currentScore + 5);
    }
    
    // 对于B级及以下，强制提升到A级（规范要求）
    // 计算基于能力缺失情况的提升空间
    const missingCount = abilityScores.filter(s => s.score === 0).length;
    const weakCount = abilityScores.filter(s => s.score > 0 && s.score < 60).length;
    
    // 基础提升（确保能达到A级）
    let baseImprovement = aLevelMin - currentScore;
    
    // 根据问题严重程度增加提升空间
    const problemImprovement = missingCount * 15 + weakCount * 8;
    
    // 总提升（不超过A级上限89分）
    const totalImprovement = Math.min(89 - currentScore, baseImprovement + problemImprovement);
    
    // 最终分数（确保至少达到A级）
    const finalScore = Math.min(89, currentScore + Math.max(totalImprovement, baseImprovement));
    
    return Math.max(aLevelMin, finalScore);
  }
  
  generateStatement(currentGrade, abilityScores) {
    const missingCount = abilityScores.filter(s => s.score === 0).length;
    
    // 根据规范第4章生成后果陈述
    let preStatement = "";
    let postStatement = "";
    
    if (currentGrade === "D") {
      preStatement = "核心能力呈现严重不足，多项关键能力缺乏证明，在同类简历中缺乏基本辨识度。";
      postStatement = "通过补充关键能力证明，已解决能力呈现不足的问题。";
    } else if (currentGrade === "C") {
      preStatement = "能力成就描述不够量化具体，HR可能需要花费更多精力来评估您的实际价值。";
      postStatement = "通过成就量化和案例故事化，已将能力呈现提升至安全水平。";
    } else if (currentGrade === "B") {
      // 规范4.3章：B级提示（温和）
      preStatement = "能力描述完整，但尚未形成强烈的个人品牌差异化，难以让人过目不忘。";
      postStatement = "通过成就量化和案例故事化，已将能力呈现提升至良好水平。";
    } else if (currentGrade === "A") {
      preStatement = "核心能力呈现良好，展现了较好的问题解决能力和成就影响力。";
      postStatement = "核心能力已达到良好呈现水平，在竞争中形成明显优势。";
    } else {
      preStatement = "能力呈现优秀，形成了清晰有力的个人专业形象。";
      postStatement = "能力呈现突出，形成了显著的个人专业优势。";
    }
    
    return {
      pre: preStatement,
      post: postStatement
    };
  }
  
  generateDirectiveAbstract(abilityScores) {
    const missingAbilities = abilityScores.filter(s => s.score === 0);
    const weakAbilities = abilityScores.filter(s => s.score > 0 && s.score < 60);
    
    if (missingAbilities.length > 0) {
      const names = missingAbilities.map(a => a.name).join('、');
      return `补充${names}的能力证明`;
    }
    
    if (weakAbilities.length > 0) {
      return "加强关键能力的案例深度和量化描述";
    }
    
    return "优化能力故事结构，提升案例说服力";
  }
  
  identifyIssues(abilityScores) {
    const issues = [];
    
    abilityScores.forEach(ability => {
      if (ability.score === 0) {
        issues.push({
          type: "missing_ability",
          severity: "serious",
          description: `缺少"${ability.name}"能力的证明`,
          suggestion: `在简历中补充${ability.name}的相关经验和成果案例`,
          ability: ability.name
        });
      } else if (ability.score < 60) {
        issues.push({
          type: "weak_ability",
          severity: "medium",
          description: `"${ability.name}"能力证明不够充分`,
          suggestion: `增加${ability.name}的具体案例和量化成果描述`,
          ability: ability.name
        });
      }
    });
    
    return issues;
  }
  
  createErrorResult(error) {
    return {
      dimension: "core_ability",
      display_name: "核心能力呈现",
      icon: "💪",
      color: "#faad14", // B级颜色
      current_score: 65,
      current_grade: "B",
      optimized_score: 75,
      optimized_grade: "A",
      status: "⏳ 待优化",
      improvement_score: 10,
      statement: {
        pre_optimization: "核心能力呈现分析过程中出现错误",
        post_optimization: "修复分析问题后重新评估能力呈现"
      },
      directive_abstract: "系统错误，建议重新尝试",
      issue_count: 1,
      issues: [{
        type: "analysis_error",
        severity: "critical",
        description: `分析错误：${error.message}`,
        suggestion: "请检查输入格式或联系技术支持"
      }]
    };
  }
}
