/**
 * 技能匹配度分析器 - 严格对齐《九维分析呈现标准规范》
 * 核心价值：证明工具技能
 * 安全等级：B级（60-74分）
 * P优先级：P1
 */
import { BaseDimensionService } from './base-dimension.service.js';

export class SkillMatchService extends BaseDimensionService {
  constructor() {
    super({
      dimension: "skill_match",
      displayName: "技能匹配度", 
      icon: "📋", // 严格对齐规范2.1图标
      priority: "P1"
    });
    
    this.skillLevels = {
      '精通': 3.0, '熟练': 2.5, '熟悉': 2.0, '掌握': 2.0, '了解': 1.0, '使用过': 0.5
    };
  }

  // === 严格对齐规范 2.1：色值与评级 ===
  mapScoreToGrade(score) {
    if (score >= 90) return "S";
    if (score >= 75) return "A"; // 规范要求：75-89为A
    if (score >= 60) return "B"; // 规范要求：60-74为B
    if (score >= 40) return "C"; // 规范要求：40-59为C
    return "D";
  }

  getGradeColor(grade) {
    const colors = {
      S: "#52c41a", A: "#1890ff", B: "#faad14", C: "#fa8c16", D: "#ff4d4f"
    }; // 严格对齐规范定义色值
    return colors[grade] || "#d9d9d9";
  }

  // === 核心分析逻辑 ===
  async analyze(resumeText, jdText, structuredResume, structuredJD) {
    console.log("=== 📋 技能匹配度分析（规范化结构驱动版） ===");
    try {
      // 1. 获取JD技能要求 (优先使用结构化数据)
      let jdSkills = structuredJD?.skills_required?.map(s => ({
        name: s, level: "掌握", weight: 2.0
      })) || this.extractSkillsFromJD(jdText);
      
      // 2. 获取简历技能 (优先使用结构化技能块)
      const targetText = (structuredResume?.skill_block?.length > 5) ? structuredResume.skill_block : resumeText;
      let resumeSkills = this.extractSkillsFromResume(targetText);
      if (resumeSkills.length === 0 && targetText !== resumeText) {
        resumeSkills = this.extractSkillsFromResume(resumeText);
      }

      // 3. 智能匹配
      const analysis = this.analyzeSkillMatch(jdSkills, resumeSkills);
      const currentScore = this.calculateSkillScore(analysis);
      const currentGrade = this.mapScoreToGrade(currentScore);

      // 4. 优化目标计算：安全目标为B级 (规范3.1)
      const optimizedScore = Math.max(72, Math.min(88, currentScore + 15));
      const optimizedGrade = this.mapScoreToGrade(optimizedScore);
      const improvementScore = optimizedScore - currentScore;

      // 5. 确定状态标签 (规范2.2)
      let status = "⏳ 待优化";
      if (currentGrade === "D" && optimizedGrade >= "B") status = "🔓 已解决";
      else if (currentGrade === "C" && optimizedGrade >= "A") status = "🔓 已解决";
      else if (improvementScore >= 10) status = "🔄 已提升";
      else if (currentGrade === "A" || currentGrade === "S") status = "✨ 已优化";

      // 6. 话术生成 (规范4.1/4.2)
      const statement = this.generateStandardStatement(currentGrade, analysis.missingSkills);

      return {
        dimension: "skill_match",
        display_name: "技能匹配度",
        icon: "📋",
        color: this.getGradeColor(currentGrade),
        current_score: Math.round(currentScore),
        current_grade: currentGrade,
        optimized_score: Math.round(optimizedScore),
        optimized_grade: optimizedGrade,
        status: status,
        improvement_score: Math.round(improvementScore),
        statement: {
          pre_optimization: statement.pre,
          post_optimization: "已针对JD核心诉求补全技能关键词，并强化了专业级别描述。"
        },
        directive_abstract: analysis.missingSkills.length > 0 
          ? `补全 ${analysis.missingSkills[0].name} 等核心技能` 
          : "优化技能熟练度表述",
        issue_count: analysis.missingSkills.length,
        detailed_analysis: analysis
      };
    } catch (e) {
      console.error("分析错误:", e);
      return this.createErrorResult(e);
    }
  }

  // === 内部算法函数 ===

  analyzeSkillMatch(jdSkills, resumeSkills) {
    let matchedCount = 0;
    let totalLevelScore = 0;
    let maxLevelScore = 0;
    const missingSkills = [];
    if (jdSkills.length === 0) return { jdSkillCount: 0, coverage: 70, levelMatch: 70, missingSkills: [] };

    jdSkills.forEach(jd => {
      let bestScore = 0;
      resumeSkills.forEach(res => {
        const sim = this.calculateSkillSimilarity(jd.name, res.name);
        if (sim > bestScore) bestScore = sim;
      });
      if (bestScore > 0.6) {
        matchedCount++;
        totalLevelScore += jd.weight;
      } else {
        missingSkills.push(jd);
      }
      maxLevelScore += jd.weight;
    });

    return {
      jdSkillCount: jdSkills.length,
      matchedCount,
      coverage: (matchedCount / jdSkills.length) * 100,
      levelMatch: (totalLevelScore / maxLevelScore) * 100,
      missingSkills
    };
  }

  calculateSkillSimilarity(s1, s2) {
    const t1 = s1.toLowerCase(), t2 = s2.toLowerCase();
    if (t1 === t2) return 1.0;
    if (t1.includes(t2) || t2.includes(t1)) return 0.9;
    return 0;
  }

  calculateSkillScore(analysis) {
    if (analysis.jdSkillCount === 0) return 70;
    return Math.round(analysis.coverage * 0.7 + analysis.levelMatch * 0.3);
  }

  generateStandardStatement(grade, missingSkills) {
    const skillName = missingSkills.length > 0 ? missingSkills[0].name : "核心技能";
    if (grade === "D") return { pre: `岗位必备技能【${skillName}】未被识别，系统可能判定您不符合基本门槛。`, post: "" };
    if (grade === "C") return { pre: "技能描述较为宽泛或缺乏重点，较难在快速筛选中建立起清晰的专业形象。", post: "" };
    return { pre: "已达到基本技能要求，但尚未提供令人印象深刻的深度证明。", post: "" };
  }

  extractSkillsFromResume(text) {
    const skills = [];
    const pattern = /(精通|熟练|熟悉|掌握|了解|使用过)\s*([\u4e00-\u9fa5a-zA-Z0-9+/]{2,20})/gi;
    let match;
    const seen = new Set();
    while ((match = pattern.exec(text)) !== null) {
      const name = match[2].trim();
      if (!seen.has(name)) {
        seen.add(name);
        skills.push({ name, level: match[1], weight: this.skillLevels[match[1]] || 2.0 });
      }
    }
    return skills;
  }

  extractSkillsFromJD(text) {
    const skills = [];
    const pattern = /(精通|熟练|熟悉|掌握|了解|使用过)\s*([\u4e00-\u9fa5a-zA-Z0-9+]{2,15})/gi;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      skills.push({ name: match[2].trim(), level: match[1], weight: this.skillLevels[match[1]] || 2.0 });
    }
    return skills;
  }

  createErrorResult(e) {
    return { dimension: "skill_match", display_name: "技能匹配度", current_score: 0, current_grade: "D", status: "错误" };
  }
}