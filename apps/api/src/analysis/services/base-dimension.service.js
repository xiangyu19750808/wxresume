/**
 * 基础维度评分服务
 * 遵循《简历优化九维分析呈现标准规范》
 */
export class BaseDimensionService {
  constructor(config) {
    this.dimension = config.dimension;
    this.displayName = config.displayName;
    this.icon = config.icon;
    this.priority = config.priority;
  }

  mapScoreToGrade(score) {
    if (score >= 95) return "S";
    if (score >= 85) return "A";
    if (score >= 70) return "B";
    if (score >= 50) return "C";
    return "D";
  }

  getGradeColor(grade) {
    const colors = {
      "S": "#52c41a",
      "A": "#1890ff", 
      "B": "#faad14",
      "C": "#fa8c16",
      "D": "#ff4d4f"
    };
    return colors[grade] || "#8c8c8c";
  }

  getGradeIcon(grade) {
    const icons = {
      "S": "🌟",
      "A": "✅",
      "B": "📋",
      "C": "⚠️",
      "D": "🚨"
    };
    return icons[grade] || "📄";
  }

  getGradeStatement(grade, currentScore, issues) {
    const statements = {
      "D": "岗位明确要求的【具体要求】未满足，在HR快速筛选中将被直接排除。",
      "C": "关键要求匹配较为薄弱，在竞争激烈时可能成为被优先淘汰的因素。",
      "B": "已达到基本要求，但尚未提供超出预期的、令人印象深刻的资质证明。",
      "A": `${this.displayName}表现优秀，保持当前的描述深度和案例。`,
      "S": `${this.displayName}表现优秀，保持当前的描述深度和案例。`
    };
    return statements[grade] || "";
  }

  calculateOptimizedScore(currentScore, issues) {
    let optimizedScore = currentScore;
    
    // 修复所有问题，加回被扣的分数
    issues.forEach(issue => {
      if (issue.penalty) {
        optimizedScore += issue.penalty;
      }
    });
    
    // 额外优化加分
    optimizedScore = Math.min(100, optimizedScore + 5);
    
    return Math.round(optimizedScore);
  }

  getStatus(currentScore, optimizedScore, currentGrade) {
    if (currentGrade === "D" || currentGrade === "C") {
      return "🔓 可解决";
    } else if (currentScore < optimizedScore) {
      return "🔄 可提升";
    } else if (currentGrade === "S" || currentGrade === "A") {
      return "✨ 已优秀";
    }
    return "⏳ 待优化";
  }

  buildDirectiveAbstract(issues) {
    if (!issues.length) {
      return `${this.displayName}优秀，无需额外优化。`;
    }
    
    const actions = issues.map(issue => {
      if (issue.description.includes("学历")) return "补充学历证明";
      if (issue.description.includes("经验")) return "弥合经验差距";
      if (issue.description.includes("证书")) return "补充相关证书";
      if (issue.description.includes("技能")) return "强化技能证明";
      return "优化匹配证明";
    });
    
    return `修复了${issues.length}项匹配问题：${actions.join("、")}。`;
  }

  async analyze(resumeText, jdText) {
    const currentScore = this.calculateScore(resumeText, jdText);
    const currentGrade = this.mapScoreToGrade(currentScore);
    const issues = this.identifyIssues(resumeText, jdText);
    
    const optimizedScore = this.calculateOptimizedScore(currentScore, issues);
    const optimizedGrade = this.mapScoreToGrade(optimizedScore);
    
    const status = this.getStatus(currentScore, optimizedScore, currentGrade);
    const improvementScore = Math.max(0, optimizedScore - currentScore);
    
    const preStatement = this.getGradeStatement(currentGrade, currentScore, issues);
    const postStatement = currentScore < optimizedScore 
      ? `通过${this.buildDirectiveAbstract(issues).replace("修复了", "").replace("项匹配问题", "项优化")}，已将${this.displayName}提升至${optimizedGrade}级水平。`
      : `${this.displayName}已达到优秀标准。`;

    return {
      dimension: this.dimension,
      display_name: this.displayName,
      icon: this.getGradeIcon(currentGrade),
      color: this.getGradeColor(currentGrade),
      
      current_score: currentScore,
      current_grade: currentGrade,
      
      optimized_score: optimizedScore,
      optimized_grade: optimizedGrade,
      status: status,
      improvement_score: improvementScore,
      
      statement: {
        pre_optimization: preStatement,
        post_optimization: postStatement
      },
      directive_abstract: this.buildDirectiveAbstract(issues),
      
      issue_count: issues.length,
      issues: issues.map(issue => ({
        description: issue.description,
        suggestion: issue.suggestion,
        penalty: issue.penalty
      }))
    };
  }

  // 子类必须实现的方法
  calculateScore(resumeText, jdText) {
    throw new Error("Method 'calculateScore()' must be implemented");
  }

  identifyIssues(resumeText, jdText) {
    throw new Error("Method 'identifyIssues()' must be implemented");
  }
}
