// 基础维度服务类 - 完全规范版
export class BaseDimensionService {
  constructor(config = {}) {
    this.dimension = config.dimension || "";
    this.displayName = config.displayName || "";
    this.icon = config.icon || "";
    this.priority = config.priority || "P2";
  }

  mapScoreToGrade(score) {
    // 严格遵循规范：75分以上为A级
    if (score >= 90) return "S";
    if (score >= 75) return "A";  // 75-89分为A级
    if (score >= 60) return "B";  // 60-74分为B级  
    if (score >= 40) return "C";  // 40-59分为C级
    return "D";                   // 0-39分为D级
  }

  getGradeColor(grade) {
    // 严格遵循规范第2.1章的颜色值
    const colors = {
      S: "#52c41a", // 绿色
      A: "#1890ff", // 蓝色（规范要求：A级）
      B: "#faad14", // 黄色（规范要求：B级）
      C: "#fa8c16", // 橙色（规范要求：C级）
      D: "#ff4d4f"  // 红色（规范要求：D级）
    };
    return colors[grade] || "#d9d9d9";
  }

  determineStatus(currentGrade, optimizedGrade, improvementScore) {
    // 严格遵循规范第2.2章的状态标签
    if (currentGrade === "S") return "🏆 卓越";
    if (optimizedGrade === "S") return "🚀 冲刺";
    
    // 等级提升
    if (optimizedGrade > currentGrade) {
      return improvementScore >= 15 ? "📈 显著提升" : "⬆️ 待提升";
    }
    
    // 等级不变
    if (currentGrade === "A") return "✅ 良好";
    if (currentGrade === "B") return "⏳ 待优化";
    if (currentGrade === "C") return "🔴 急需优化";
    if (currentGrade === "D") return "🔴 急需优化";
    
    return "⏳ 待优化";
  }
}