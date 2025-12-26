/**
 * 教育背景匹配分析器 - 严格对齐《九维分析呈现标准规范》
 * 核心价值：最大化背景价值，强化长期契合度
 * 优化目标：B级(合格) 提升至 A级(良好)
 * P优先级：P2 (长期契合层)
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

  // === 严格对齐规范 2.1：评级与色值 ===
  mapScoreToGrade(score) {
    if (score >= 90) return "S";
    if (score >= 75) return "A"; // 规范：75-89为A
    if (score >= 60) return "B"; 
    if (score >= 40) return "C"; 
    return "D";
  }

  getGradeColor(grade) {
    const colors = {
      S: "#52c41a", A: "#1890ff", B: "#faad14", C: "#fa8c16", D: "#ff4d4f"
    };
    return colors[grade] || "#d9d9d9";
  }

  async analyze(resumeText, jdText) {
    console.log("=== 🎓 教育背景匹配分析（规范对齐版） ===");
    try {
      // 1. 核心要素提取
      const hasEducation = this.hasEducationInfo(resumeText);
      const jdRequiresDegree = this.jdRequiresDegree(jdText);
      const educationRelevant = this.isEducationRelevant(resumeText, jdText);
      
      // 2. 计算当前分数与评级
      const currentScore = this.calculateScore(hasEducation, jdRequiresDegree, educationRelevant);
      const currentGrade = this.mapScoreToGrade(currentScore);
      
      // 3. 强制优化目标：B级 -> A级 (规范3.1)
      const optimizedScore = this.ensureBAImprovement(currentScore, hasEducation);
      const optimizedGrade = this.mapScoreToGrade(optimizedScore);
      const improvementScore = optimizedScore - currentScore;

      // 4. 确定规范状态标签 (规范2.2)
      let status = "⏳ 待优化";
      if (currentGrade === "D" || currentGrade === "C") status = "🔓 已解决";
      else if (improvementScore >= 10) status = "🔄 已提升";
      else status = "✨ 已优化";

      // 5. 生成标准陈述 (对齐4.1/4.2)
      const statement = this.generateStandardStatement(currentGrade, optimizedGrade);

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
          pre_optimization: statement.pre,
          post_optimization: statement.post
        },
        // 核心输出：指令摘要 (规范6.1)
        directive_abstract: this.generateDirectiveAbstract(hasEducation, educationRelevant),
        issue_count: this.countIssues(hasEducation, educationRelevant),
        detailed_analysis: {
          has_education: hasEducation,
          jd_requires_degree: jdRequiresDegree,
          education_relevant: educationRelevant
        }
      };
    } catch (error) {
      return this.errorResult(error);
    }
  }

  // === 内部算法与逻辑 ===

  calculateScore(hasEdu, reqDeg, rel) {
    if (!hasEdu) return 35;
    if (rel) return 82; // 已经是A级
    return 65; // B级（合格但需提升）
  }

  ensureBAImprovement(currentScore, hasEdu) {
    if (!hasEdu) return 78; // 补全即达A
    return Math.max(82, currentScore + 15); // 确保拉升至A级
  }

  generateStandardStatement(currentGrade, optimizedGrade) {
    const statements = {
      "D": "教育背景信息缺失，将导致简历无法通过初步资质审核，直接失去竞争机会。",
      "C": "专业背景与岗位关联性描述较弱，易在初筛选中被归类为“非相关”背景。",
      "B": "教育背景基本符合，但未能将学术经历转化为与岗位直接相关的竞争优势。",
      "A": "教育背景匹配良好，已建立起专业背景与岗位要求的深度关联。",
      "S": "教育背景形成显著壁垒，展现了极强的专业契合度与成长潜力。"
    };

    return {
      pre: statements[currentGrade] || statements["B"],
      post: optimizedGrade === "A" 
        ? "通过强化关联课程与学术项目描述，教育背景已转化为有效的职业背书。" 
        : "背景呈现已达到优秀水平。"
    };
  }

  generateDirectiveAbstract(hasEdu, rel) {
    if (!hasEdu) return "补全学历学位信息，构建基础信用";
    if (!rel) return "关联核心课程与学术项目，强化背景相关性";
    return "提炼学术成果与岗位契合点";
  }

  // ... (hasEducationInfo, jdRequiresDegree 等工具方法保持原有逻辑)
  
  hasEducationInfo(text) {
    const educationKeywords = ['大学', '学院', '学校', '本科', '硕士', '博士', '大专', '毕业', '专业'];
    return educationKeywords.some(keyword => text.includes(keyword));
  }

  jdRequiresDegree(jdText) {
    const degreeKeywords = ['学历', '学位', '本科', '硕士', '博士', '大专'];
    return degreeKeywords.some(keyword => jdText.includes(keyword));
  }

  isEducationRelevant(resumeText, jdText) {
    // 逻辑：检查是否有“专业”或“课程”字眼且jd中有匹配行业词
    return resumeText.includes('专业') && (jdText.includes('技术') || jdText.includes('开发'));
  }

  countIssues(hasEdu, rel) {
    return (!hasEdu ? 1 : 0) + (!rel ? 1 : 0);
  }
}