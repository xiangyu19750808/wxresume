/**
 * 语义匹配契合度分析器（完美最终版）
 * 维度名称：语义匹配契合度（Dimension 9）
 * 核心价值：展现文化思维契合
 * 安全等级：B级向A级提升
 * 优化焦点：叙事逻辑、价值观表达
 * P优先级：P2（长期契合层）
 * 状态：生产就绪
 */
import { BaseDimensionService } from './base-dimension.service.js';

export class SemanticMatchService extends BaseDimensionService {
  constructor() {
    super({
      dimension: "semantic_match",
      displayName: "语义匹配契合度", 
      icon: "🎭",  // 戏剧面具图标，代表表达和契合
      priority: "P2"
    });
    
    // 极简关键词集
    this.keywords = {
      positive: ['成功', '提升', '优化', '实现', '解决', '增长', '完成'],
      logic: ['通过', '基于', '为了', '因此', '所以', '结果', '因为'],
      professional: ['经验', '项目', '系统', '开发', '架构', '技术', '团队']
    };
  }
  
  async analyze(resumeText, jdText) {
    console.log("=== 🎭 语义匹配契合度分析开始 ===");
    
    try {
      // 1. 计算当前分数
      const currentScore = this.calculateCurrentScore(resumeText, jdText);
      const currentGrade = this.mapScoreToGrade(currentScore);
      
      // 2. 计算优化分数（核心：B→A提升）
      const optimizedScore = this.calculateOptimizedScore(currentScore, currentGrade);
      const optimizedGrade = this.mapScoreToGrade(optimizedScore);
      
      // 3. 确保B级优化到A级（75-89分），而不是S级
      const finalOptimizedScore = this.ensureBToA(currentScore, currentGrade, optimizedScore, optimizedGrade);
      const finalOptimizedGrade = this.mapScoreToGrade(finalOptimizedScore);
      
      const improvementScore = Math.max(0, finalOptimizedScore - currentScore);
      const status = this.determineStatus(currentGrade, finalOptimizedGrade, improvementScore);
      
      // 4. 返回规范结果
      return {
        dimension: "semantic_match",
        display_name: "语义匹配契合度",
        icon: "🎭",
        color: this.getGradeColor(currentGrade),
        current_score: Math.round(currentScore),
        current_grade: currentGrade,
        optimized_score: Math.round(finalOptimizedScore),
        optimized_grade: finalOptimizedGrade,
        status: status,
        improvement_score: Math.round(improvementScore),
        statement: {
          pre_optimization: this.getPreStatement(currentGrade),
          post_optimization: this.getPostStatement(finalOptimizedGrade)
        },
        directive_abstract: this.getDirective(currentGrade),
        issue_count: this.countIssues(currentGrade),
        issues: this.generateIssues(currentGrade),
        detailed_analysis: {
          score_calculation: this.getScoreBreakdown(resumeText, jdText),
          has_positive_words: this.checkKeywords(resumeText, this.keywords.positive) > 0,
          has_logic_words: this.checkKeywords(resumeText, this.keywords.logic) > 0,
          has_professional_words: this.checkKeywords(resumeText, this.keywords.professional) > 2,
          b_to_a_improvement: currentGrade === 'B' && finalOptimizedGrade === 'A' ? '成功' : '不适用'
        }
      };
      
    } catch (error) {
      console.error("语义匹配契合度分析错误:", error);
      return this.errorResult(error);
    }
  }
  
  // === 核心算法 ===
  
  calculateCurrentScore(resumeText, jdText) {
    if (!resumeText || resumeText.length < 10) return 35;
    
    let score = 50; // 基础分
    
    // 1. 简历质量（0-25分）
    score += this.evaluateResumeQuality(resumeText);
    
    // 2. 与JD匹配度（0-15分）
    score += this.evaluateJDMatch(resumeText, jdText);
    
    // 3. 表达质量（0-10分）
    score += this.evaluateExpression(resumeText);
    
    // 确保在合理范围
    return Math.max(30, Math.min(95, score));
  }
  
  evaluateResumeQuality(text) {
    let qualityScore = 0;
    
    // 长度加分
    if (text.length > 300) qualityScore += 10;
    else if (text.length > 150) qualityScore += 8;
    else if (text.length > 80) qualityScore += 5;
    else qualityScore += 2;
    
    // 关键词加分
    const positiveCount = this.checkKeywords(text, this.keywords.positive);
    const professionalCount = this.checkKeywords(text, this.keywords.professional);
    
    if (positiveCount >= 3 && professionalCount >= 3) qualityScore += 15;
    else if (positiveCount >= 2 && professionalCount >= 2) qualityScore += 10;
    else if (positiveCount >= 1 && professionalCount >= 1) qualityScore += 5;
    
    return Math.min(25, qualityScore);
  }
  
  evaluateJDMatch(resumeText, jdText) {
    if (!jdText || jdText.length < 20) return 8;
    
    // 简单的关键词匹配
    const resumeWords = this.extractSimpleWords(resumeText);
    const jdWords = this.extractSimpleWords(jdText);
    
    if (jdWords.length === 0) return 5;
    
    let matchCount = 0;
    resumeWords.forEach(word => {
      if (jdWords.includes(word)) matchCount++;
    });
    
    if (matchCount >= 3) return 15;
    if (matchCount >= 2) return 10;
    if (matchCount >= 1) return 5;
    return 2;
  }
  
  evaluateExpression(text) {
    const logicCount = this.checkKeywords(text, this.keywords.logic);
    
    if (logicCount >= 3) return 10;
    if (logicCount >= 2) return 7;
    if (logicCount >= 1) return 4;
    return 1;
  }
  
  calculateOptimizedScore(currentScore, currentGrade) {
    // 等级边界
    const boundaries = {
      D: 40,
      C: 60,
      B: 75,
      A: 90,
      S: 95
    };
    
    // 根据当前等级决定优化幅度
    switch(currentGrade) {
      case 'D':
        return Math.min(boundaries.C - 1, currentScore + 25);
      case 'C':
        return Math.min(boundaries.B - 1, currentScore + 20);
      case 'B':
        // B级：确保能到A级（75分以上），但不超过89分
        return Math.max(boundaries.A, Math.min(89, currentScore + 15));
      case 'A':
        return Math.min(boundaries.S - 1, currentScore + 5);
      case 'S':
        return Math.min(98, currentScore + 3);
      default:
        return Math.min(95, currentScore + 10);
    }
  }
  
  ensureBToA(currentScore, currentGrade, optimizedScore, optimizedGrade) {
    // === 核心修复：确保B级优化到A级，而不是S级 ===
    
    if (currentGrade === 'B') {
      // 如果优化后是S级（≥90分），调整为A级（75-89分）
      if (optimizedGrade === 'S') {
        // 调整到A级上限（89分）
        return Math.min(89, Math.max(75, optimizedScore - 5));
      }
      
      // 确保至少达到A级起点（75分）
      if (optimizedScore < 75) {
        return 75;
      }
      
      // 确保不超过A级上限（89分）
      if (optimizedScore > 89) {
        return 89;
      }
    }
    
    return optimizedScore;
  }
  
  // === 辅助函数 ===
  
  checkKeywords(text, keywordList) {
    let count = 0;
    keywordList.forEach(keyword => {
      if (text.includes(keyword)) count++;
    });
    return count;
  }
  
  extractSimpleWords(text) {
    const common = ['一个', '这个', '那个', '可以', '能够', '进行', '工作'];
    const words = (text.match(/[\u4e00-\u9fa5]{2,3}/g) || [])
      .filter(word => !common.includes(word))
      .slice(0, 15);
    return [...new Set(words)];
  }
  
  getScoreBreakdown(resumeText, jdText) {
    const quality = this.evaluateResumeQuality(resumeText);
    const match = this.evaluateJDMatch(resumeText, jdText);
    const expression = this.evaluateExpression(resumeText);
    
    return `基础分50 + 质量${quality} + 匹配${match} + 表达${expression}`;
  }
  
  getPreStatement(grade) {
    const statements = {
      D: "表述逻辑与岗位深层需求严重不符，这可能是'已读不回'的核心原因之一",
      C: "存在细微的逻辑矛盾或表述模糊，可能在深度评估时影响您的整体评价分数",
      B: "语义通顺合理，但尚未传递出与团队文化或公司价值观的深度共鸣与契合感",
      A: "语言表达良好，展现了较好的逻辑思维和文化契合度",
      S: "语义表达优秀，与岗位需求高度契合，展现出卓越的文化思维匹配"
    };
    return statements[grade] || "语义匹配需要优化";
  }
  
  getPostStatement(grade) {
    const statements = {
      D: "通过系统性优化语义表达，达到基本要求",
      C: "优化后已具备基本表达能力",
      B: "通过优化表达逻辑，已达到合格水平",
      A: "语义匹配已达到良好水平，展现了较好的文化契合度",
      S: "语义表达优秀，具备优秀的文化思维契合度"
    };
    return statements[grade] || "语义表达已得到优化";
  }
  
  getDirective(grade) {
    if (grade === 'D' || grade === 'C') {
      return "大幅优化语言表达和逻辑结构";
    } else if (grade === 'B') {
      return "优化表达逻辑以提升到A级标准";
    } else {
      return "深化语义表达的故事性和感染力";
    }
  }
  
  countIssues(grade) {
    if (grade === 'D') return 3;
    if (grade === 'C') return 2;
    if (grade === 'B') return 1;
    return 0;
  }
  
  generateIssues(grade) {
    const issues = [];
    
    if (grade === 'D' || grade === 'C') {
      issues.push({
        type: "expression_improvement",
        severity: "high",
        description: "语言表达需要显著优化",
        suggestion: "加强逻辑结构，使用专业表达方式，突出成果价值"
      });
    }
    
    if (grade === 'B') {
      issues.push({
        type: "b_to_a_improvement",
        severity: "medium",
        description: "可优化到A级标准",
        suggestion: "优化表达逻辑，展现更好的文化思维契合度"
      });
    }
    
    return issues;
  }
  
  errorResult(error) {
    return {
      dimension: "semantic_match",
      display_name: "语义匹配契合度",
      icon: "🎭",
      color: "#faad14",
      current_score: 65,
      current_grade: "B",
      optimized_score: 75,
      optimized_grade: "A",
      status: "⏳ 待优化",
      improvement_score: 10,
      statement: {
        pre_optimization: "语义匹配契合度分析过程中出现错误",
        post_optimization: "修复分析问题后重新评估"
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
