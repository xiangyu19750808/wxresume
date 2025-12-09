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
    // 严格遵循规范2.1章颜色定义
    const colors = {
      S: "#722ed1",   // 规范中未定义S级颜色，用紫色表示优秀
      A: "#52c41a",   // 绿色 - 良好
      B: "#faad14",   // 黄色 - 合格（规范2.1章：B级 #faad14）
      C: "#fa8c16",   // 橙色 - 风险
      D: "#ff4d4f"    // 红色 - 警告（规范2.1章：D级 #ff4d4f）
    };
    return colors[grade] || "#8c8c8c";
  }

  determineStatus(currentGrade, optimizedGrade, improvementScore) {
    // 遵循规范2.2章的优化状态标签
    if (currentGrade === "D" || currentGrade === "C") {
      return "🔴 急需优化";
    } else if (improvementScore > 10 && currentGrade < optimizedGrade) {
      // 等级提升（如C→B，B→A）
      return "🔄 已提升";
    } else if (currentGrade === "B" && optimizedGrade === "B") {
      // B级已达到目标，用规范中的"✨ 已优化"
      return "✨ 已优化";
    } else if (improvementScore > 5) {
      // 分数提升但等级未变
      return "🔄 已提升";
    } else if (currentGrade === "A" || currentGrade === "S") {
      // 已经是A级或S级
      return "🟢 状态良好";
    } else {
      return "⏳ 待优化";
    }
  }
}
