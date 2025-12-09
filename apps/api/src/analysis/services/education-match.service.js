/**
 * 教育背景匹配分析器（修复版）
 * 维度名称：教育背景匹配（Dimension 7）
 * 核心价值：最大化背景价值
 * 安全等级：B级向A级提升
 * 优化焦点：关联课程、项目与岗位
 * P优先级：P2（长期契合层）
 */
import { BaseDimensionService } from './base-dimension.service.js';

export class EducationMatchService extends BaseDimensionService {
  constructor() {
    super({
      dimension: "education_match",
      displayName: "教育背景匹配", 
      icon: "🎓",
      priority: "P2"
    });
  }
  
  async analyze(resumeText, jdText) {
    console.log("=== 🎓 教育背景匹配分析开始 ===");
    
    try {
      // 极简算法：检查三个核心要素
      const hasEducation = this.hasEducationInfo(resumeText);
      const jdRequiresDegree = this.jdRequiresDegree(jdText);
      const educationRelevant = this.isEducationRelevant(resumeText, jdText);
      
      // 计算当前分数
      const currentScore = this.calculateScore(hasEducation, jdRequiresDegree, educationRelevant);
      const currentGrade = this.mapScoreToGrade(currentScore);
      
      // 优化分数（强制B→A提升）
      const optimizedScore = this.ensureBAImprovement(currentScore, hasEducation, jdRequiresDegree);
      const optimizedGrade = this.mapScoreToGrade(optimizedScore);
      const improvementScore = optimizedScore - currentScore;
      
      // 状态
      const status = this.determineStatus(currentGrade, optimizedGrade, improvementScore);
      
      // 返回规范结果
      return {
        dimension: "education_match",
        display_name: "教育背景匹配",
        icon: "🎓",
        color: this.getGradeColor(currentGrade),
        current_score: Math.round(currentScore),
        current_grade: currentGrade,
        optimized_score: Math.round(optimizedScore),
        optimized_grade: optimizedGrade,
        status: status,
        improvement_score: Math.round(improvementScore),
        statement: {
          pre_optimization: this.getStatement(currentGrade, hasEducation, jdRequiresDegree),
          post_optimization: this.getPostStatement(optimizedGrade, hasEducation, jdRequiresDegree)
        },
        directive_abstract: this.getDirective(hasEducation, jdRequiresDegree, educationRelevant),
        issue_count: this.countIssues(hasEducation, jdRequiresDegree, educationRelevant),
        issues: this.generateIssues(hasEducation, jdRequiresDegree, educationRelevant),
        detailed_analysis: {
          has_education: hasEducation,
          jd_requires_degree: jdRequiresDegree,
          education_relevant: educationRelevant,
          match_level: this.getMatchLevel(hasEducation, jdRequiresDegree, educationRelevant)
        }
      };
      
    } catch (error) {
      console.error("教育背景匹配分析错误:", error);
      return this.errorResult(error);
    }
  }
  
  // === 极简核心算法 ===
  
  hasEducationInfo(text) {
    // 检查是否有任何教育关键词
    const educationKeywords = [
      '大学', '学院', '学校', '学历', '学位', '本科', '硕士', '博士', 
      '大专', '研究生', '学士', '硕士', '博士', '毕业', '就读', '专业'
    ];
    
    return educationKeywords.some(keyword => text.includes(keyword));
  }
  
  jdRequiresDegree(jdText) {
    // JD是否明确要求学历
    const degreeKeywords = ['学历', '学位', '本科', '硕士', '博士', '大专', '研究生'];
    return degreeKeywords.some(keyword => jdText.includes(keyword));
  }
  
  isEducationRelevant(resumeText, jdText) {
    // 教育是否相关（简单版本：检查专业关键词）
    const majorKeywords = ['专业', '学科', '课程', '主修', '方向'];
    const hasMajorInfo = majorKeywords.some(keyword => resumeText.includes(keyword));
    
    if (!hasMajorInfo) return false;
    
    // 简单的相关性检查：JD中是否有技术/专业词汇
    const techKeywords = ['技术', '开发', '工程', '设计', '分析', '管理', '市场'];
    return techKeywords.some(keyword => jdText.includes(keyword));
  }
  
  calculateScore(hasEducation, jdRequiresDegree, educationRelevant) {
    if (!hasEducation) {
      return jdRequiresDegree ? 40 : 60; // 无教育信息：JD有要求40分，无要求60分
    }
    
    if (jdRequiresDegree) {
      // JD有要求，检查是否相关
      return educationRelevant ? 85 : 70;
    }
    
    // JD无要求，有教育信息就是加分
    return educationRelevant ? 90 : 75;
  }
  
    ensureBAImprovement(currentScore, hasEducation, jdRequiresDegree) {
    // 规范要求：B级向A级提升
    const targetMin = 75; // A级起点
    
    if (currentScore >= targetMin) {
      return Math.min(89, currentScore + 5); // A级内提升
    }
    
    // 当前低于A级，计算优化潜力
    let improvement = 0;
    
    if (!hasEducation) {
      improvement = 35; // 补充教育信息提升大
    } else if (currentScore < 60) {
      improvement = 25; // C/D级提升到B级
    } else {
      improvement = 20; // B级提升到A级
    }
    
    const newScore = Math.min(89, currentScore + improvement);
    
    // 确保B级能提升到A级（规范要求）
    if (currentScore >= 60 && currentScore < 75) {
      // 如果是B级，必须提升到A级
      return Math.max(75, newScore);
    }
    
    return newScore;
  }
  
  getStatement(grade, hasEducation, jdRequiresDegree) {
    if (grade === "D") {
      return "教育背景信息缺失或严重不足，无法评估与岗位的匹配度";
    } else if (grade === "C") {
      return "教育背景与岗位要求存在一定差距，可能需要额外证明相关能力";
    } else if (grade === "B") {
      return "背景符合要求，但未充分挖掘并转化为与岗位直接相关的独特竞争优势";
    } else if (grade === "A") {
      return "教育背景匹配良好，为岗位提供了有力的学术支撑";
    } else {
      return "教育背景与岗位要求高度匹配，形成显著优势";
    }
  }
  
  getPostStatement(grade, hasEducation, jdRequiresDegree) {
    if (grade === "B") {
      return "通过优化教育背景呈现，已达到合格匹配水平";
    } else if (grade === "A") {
      return "教育背景匹配已达到良好水平，有效支撑岗位要求";
    } else {
      return "教育背景匹配已得到优化";
    }
  }
  
  getDirective(hasEducation, jdRequiresDegree, educationRelevant) {
    if (!hasEducation) {
      return "补充教育背景基本信息";
    }
    
    if (jdRequiresDegree && !educationRelevant) {
      return "强化教育背景与岗位的相关性";
    }
    
    return "优化教育背景的价值呈现";
  }
  
  countIssues(hasEducation, jdRequiresDegree, educationRelevant) {
    let count = 0;
    if (!hasEducation) count++;
    if (jdRequiresDegree && !educationRelevant) count++;
    return count;
  }
  
  generateIssues(hasEducation, jdRequiresDegree, educationRelevant) {
    const issues = [];
    
    if (!hasEducation) {
      issues.push({
        type: "missing_education",
        severity: jdRequiresDegree ? "serious" : "medium",
        description: "简历中缺少教育背景信息",
        suggestion: "补充学历、学校、专业等基本信息"
      });
    }
    
    if (jdRequiresDegree && !educationRelevant) {
      issues.push({
        type: "low_relevance",
        severity: "medium",
        description: "教育背景与岗位相关性较弱",
        suggestion: "突出与岗位相关的课程、项目或专业方向"
      });
    }
    
    return issues;
  }
  
  getMatchLevel(hasEducation, jdRequiresDegree, educationRelevant) {
    if (!hasEducation) return "缺失";
    if (!jdRequiresDegree) return "可选";
    return educationRelevant ? "相关" : "弱相关";
  }
  
  errorResult(error) {
    return {
      dimension: "education_match",
      display_name: "教育背景匹配",
      icon: "🎓",
      color: "#faad14",
      current_score: 65,
      current_grade: "B",
      optimized_score: 75,
      optimized_grade: "A",
      status: "⏳ 待优化",
      improvement_score: 10,
      statement: {
        pre_optimization: "教育背景匹配分析过程中出现错误",
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

