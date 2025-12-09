import { BaseDimensionService } from './base-dimension.service.js';

export class ATSCompatibilityService extends BaseDimensionService {
  constructor() {
    super({
      dimension: "ats_compatibility",
      displayName: "ATS系统兼容性",
      icon: "📄",
      priority: "P0"
    });
  }

  async analyze(resumeText, jdText) {
    console.log("=== 📄 ATS兼容性分析开始 ===");
    
    try {
      // 简单但有效的ATS兼容性检查
      const analysis = this.analyzeATSCompatibility(resumeText);
      const currentScore = this.calculateATSScore(analysis);
      const currentGrade = this.scoreToGrade(currentScore);
      
      console.log(`ATS兼容性分数: ${currentScore}, 等级: ${currentGrade}`);
      
      // 识别问题
      const issues = this.identifyATSIssues(analysis);
      
      // 模拟优化
      const optimizedScore = this.calculateOptimizedScore(currentScore, issues);
      const optimizedGrade = this.scoreToGrade(optimizedScore);
      const improvementScore = optimizedScore - currentScore;
      
      // 生成输出
      return this.generateStandardOutput(
        currentScore, currentGrade,
        optimizedScore, optimizedGrade,
        improvementScore, issues, analysis
      );
      
    } catch (error) {
      console.error("ATS分析错误:", error);
      return this.createErrorResult(error);
    }
  }

  analyzeATSCompatibility(text) {
    if (!text) {
      return {
        hasDangerousChars: false,
        hasComplexFormatting: false,
        encodingIssues: false,
        structureScore: 0,
        lineLengthIssues: 0
      };
    }
    
    // 检查危险字符
    const dangerousChars = /[^\u0000-\u007E\u4e00-\u9fa5\s\n\r，。；：！？、]/g;
    const hasDangerousChars = dangerousChars.test(text);
    
    // 检查复杂格式
    const hasComplexFormatting = /[●★◆■▲►◄←→↑↓]/g.test(text);
    
    // 检查编码问题（简单检查）
    const encodingIssues = /[^\x00-\x7F\u4e00-\u9fa5]/.test(text.replace(/\s/g, ''));
    
    // 检查行长度
    const lines = text.split('\n');
    const lineLengthIssues = lines.filter(line => line.length > 120).length;
    
    // 结构分数
    const structureScore = this.calculateStructureScore(text);
    
    return {
      hasDangerousChars,
      hasComplexFormatting,
      encodingIssues,
      structureScore,
      lineLengthIssues,
      lineCount: lines.length,
      totalLength: text.length
    };
  }

  calculateStructureScore(text) {
    let score = 0;
    const lines = text.split('\n');
    
    // 检查基本结构
    if (lines.length >= 5) score += 0.3;
    if (text.includes('教育背景') || text.includes('工作经历')) score += 0.3;
    if (text.includes('技能') || text.includes('项目经验')) score += 0.2;
    if (!/\t/.test(text)) score += 0.1; // 没有制表符
    if (!/\s{4,}/.test(text)) score += 0.1; // 没有连续多个空格
    
    return Math.min(score, 1.0);
  }

  calculateATSScore(analysis) {
    let score = 100;
    
    // 扣分项
    if (analysis.hasDangerousChars) score -= 30;
    if (analysis.hasComplexFormatting) score -= 20;
    if (analysis.encodingIssues) score -= 25;
    if (analysis.lineLengthIssues > 0) score -= (analysis.lineLengthIssues * 5);
    
    // 结构分转换
    const structureBonus = analysis.structureScore * 20;
    score = Math.min(100, score + structureBonus);
    
    // 确保最低分
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  identifyATSIssues(analysis) {
    const issues = [];
    
    if (analysis.hasDangerousChars) {
      issues.push({
        type: "dangerous_chars",
        severity: "critical",
        description: "检测到可能被ATS解析为乱码的特殊字符",
        suggestion: "移除特殊字符，使用标准中英文和标点"
      });
    }
    
    if (analysis.hasComplexFormatting) {
      issues.push({
        type: "complex_formatting",
        severity: "serious",
        description: "检测到复杂格式符号（如●★等）",
        suggestion: "使用简单的项目符号如•或-"
      });
    }
    
    if (analysis.encodingIssues) {
      issues.push({
        type: "encoding_issues",
        severity: "critical",
        description: "可能存在编码兼容性问题",
        suggestion: "使用UTF-8编码，避免特殊字符"
      });
    }
    
    if (analysis.lineLengthIssues > 0) {
      issues.push({
        type: "line_length",
        severity: "medium",
        description: `${analysis.lineLengthIssues}行文本过长`,
        suggestion: "确保每行不超过120字符，适当换行"
      });
    }
    
    if (analysis.structureScore < 0.5) {
      issues.push({
        type: "poor_structure",
        severity: "serious",
        description: "简历结构不够清晰",
        suggestion: "添加明确的章节标题，如教育背景、工作经历等"
      });
    }
    
    return issues;
  }

  calculateOptimizedScore(currentScore, issues) {
    const criticalIssues = issues.filter(i => i.severity === "critical");
    const seriousIssues = issues.filter(i => i.severity === "serious");
    
    let potentialImprovement = 
      criticalIssues.length * 25 + 
      seriousIssues.length * 15;
    
    const targetScore = Math.min(100, currentScore + potentialImprovement);
    return Math.max(currentScore, Math.min(100, targetScore));
  }

  generateStandardOutput(currentScore, currentGrade, optimizedScore, optimizedGrade, improvementScore, issues, analysis) {
    const status = this.determineStatus(currentGrade, optimizedGrade, improvementScore);
    
    return {
      dimension: "ats_compatibility",
      display_name: "ATS系统兼容性",
      icon: "📄",
      color: this.getGradeColor(currentGrade),
      current_score: currentScore,
      current_grade: currentGrade,
      optimized_score: optimizedScore,
      optimized_grade: optimizedGrade,
      status: status,
      improvement_score: improvementScore,
      statement: this.generateStatement(currentGrade, analysis, issues),
      directive_abstract: this.generateDirectiveAbstract(issues),
      issue_count: issues.length,
      issues: issues.slice(0, 5)
    };
  }

  generateStatement(grade, analysis, issues) {
    const criticalCount = issues.filter(i => i.severity === "critical").length;
    
    if (grade === "D") {
      return `ATS兼容性严重不足，发现${criticalCount}个致命问题，简历可能无法被任何ATS系统正确解析`;
    } else if (grade === "C") {
      return "ATS兼容性存在明显问题，在某些系统中可能导致关键信息丢失";
    } else if (grade === "B") {
      return "简历可被正常读取，但格式优化可提升专业印象";
    } else if (grade === "A") {
      return "ATS兼容性良好，可确保简历被正确解析";
    } else {
      return "ATS兼容性优秀，格式专业规范";
    }
  }

  generateDirectiveAbstract(issues) {
    if (issues.length === 0) {
      return "ATS兼容性良好，无需优化";
    }
    
    const criticalIssues = issues.filter(i => i.severity === "critical");
    if (criticalIssues.length > 0) {
      return `修复${criticalIssues.length}个致命兼容性问题，确保简历可读`;
    }
    
    return `优化${issues.length}处格式问题，提升兼容性`;
  }

  // 工具方法
  scoreToGrade(score) {
    if (score >= 90) return "S";
    if (score >= 75) return "A";
    if (score >= 60) return "B";
    if (score >= 40) return "C";
    return "D";
  }

  getGradeColor(grade) {
    const colors = {
      "S": "#52c41a", "A": "#1890ff", "B": "#faad14", 
      "C": "#fa8c16", "D": "#ff4d4f"
    };
    return colors[grade] || "#fa8c16";
  }

  determineStatus(currentGrade, optimizedGrade, improvementScore) {
    if (improvementScore <= 0) return "⏳ 待优化";
    
    const gradeOrder = { "D": 1, "C": 2, "B": 3, "A": 4, "S": 5 };
    if (gradeOrder[optimizedGrade] > gradeOrder[currentGrade]) {
      return "🔓 已解决";
    }
    
    if (improvementScore >= 10) {
      return "🔄 已提升";
    }
    
    return "✨ 已优化";
  }

  createErrorResult(error) {
    return {
      dimension: "ats_compatibility",
      display_name: "ATS系统兼容性",
      icon: "📄",
      color: "#fa8c16",
      current_score: 50,
      current_grade: "C",
      optimized_score: 75,
      optimized_grade: "B",
      status: "⏳ 待优化",
      improvement_score: 25,
      statement: "ATS分析过程中出现错误",
      directive_abstract: "系统错误，建议重新尝试",
      issue_count: 1,
      issues: [{
        penalty: 0,
        description: `分析错误：${error.message}`,
        suggestion: "请检查输入格式"
      }]
    };
  }
}
