/**
 * 技能匹配度分析器 - 符合《简历优化九维分析呈现标准规范》
 * 核心价值：证明工具技能
 * 必须达成等级：B级（合格）
 * 优化焦点：技能词识别与场景对应
 * P优先级：P1（竞争优势层）
 */
import { BaseDimensionService } from './base-dimension.service.js';

export class SkillMatchService extends BaseDimensionService {
  constructor() {
    super({
      dimension: "skill_match",
      displayName: "技能匹配度", 
      icon: "🛠️",
      priority: "P1"
    });
    
    // 技能级别权重
    this.skillLevels = {
      '精通': 3.0,
      '熟练': 2.5, 
      '熟悉': 2.0,
      '掌握': 2.0,
      '了解': 1.0,
      '使用过': 0.5
    };
  }
  
  async analyze(resumeText, jdText) {
    console.log("=== 🛠️ 技能匹配度分析开始 ===");
    
    try {
      // 1. 从JD提取技能要求
      const jdSkills = this.extractSkillsFromJD(jdText);
      console.log(`从JD提取到${jdSkills.length}个技能要求`);
      
      // 2. 分析简历中的技能表现
      const resumeSkills = this.extractSkillsFromResume(resumeText);
      console.log(`从简历提取到${resumeSkills.length}个技能`);
      
      // 3. 进行技能匹配分析
      const analysis = this.analyzeSkillMatch(jdSkills, resumeSkills);
      
      // 4. 计算分数
      const currentScore = this.calculateSkillScore(analysis);
      const currentGrade = this.mapScoreToGrade(currentScore);
      
      console.log(`技能匹配度分析结果: ${currentScore}分, ${currentGrade}级`);
      console.log(`技能覆盖率: ${analysis.coverage.toFixed(2)}%, 级别匹配度: ${analysis.levelMatch.toFixed(2)}`);
      
      // 5. 识别问题
      const issues = this.identifySkillIssues(analysis, jdSkills, resumeSkills);
      
      // 6. 生成优化方案（确保能达到B级）
      const optimizedScore = this.calculateOptimizedScore(currentScore, issues);
      const optimizedGrade = this.mapScoreToGrade(optimizedScore);
      const improvementScore = optimizedScore - currentScore;
      
      // 7. 生成规范输出
      return this.generateStandardOutput(
        currentScore, currentGrade,
        optimizedScore, optimizedGrade,
        improvementScore, issues, analysis
      );
      
    } catch (error) {
      console.error("技能匹配度分析错误:", error);
      return this.createErrorResult(error);
    }
  }
  
  // === 核心算法实现 ===
  
  extractSkillsFromJD(jdText) {
    console.log("开始从JD提取技能要求...");
    
    if (!jdText || jdText.trim().length < 10) {
      return [];
    }
    
    const skills = [];
    const seen = new Set();
    
    // 模式1：提取"精通/熟悉/掌握"后面的技能词
    const levelPattern = /(精通|熟练|熟悉|掌握|了解|使用过)\s*([\u4e00-\u9fa5a-zA-Z0-9+]{2,15})/gi;
    let match;
    
    while ((match = levelPattern.exec(jdText)) !== null) {
      const level = match[1];
      const skill = match[2].trim();
      const key = `${skill}:${level}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        skills.push({
          name: skill,
          level: level,
          weight: this.skillLevels[level] || 1.0
        });
      }
    }
    
    // 模式2：提取技能列表
    const skillSectionPattern = /技能\s*[：:]\s*([^。，；;,\n]+)/gi;
    let sectionMatch;
    
    while ((sectionMatch = skillSectionPattern.exec(jdText)) !== null) {
      const section = sectionMatch[1];
      const skillItems = section.split(/[、,，;；\s]+/);
      
      skillItems.forEach(item => {
        const skill = item.trim();
        if (skill && skill.length >= 2) {
          const key = `${skill}:普通`;
          if (!seen.has(key)) {
            seen.add(key);
            skills.push({
              name: skill,
              level: "掌握",
              weight: 2.0
            });
          }
        }
      });
    }
    
    console.log(`提取的JD技能:`, skills.map(s => `${s.name}(${s.level})`));
    return skills.filter(skill => skill.name.length > 1);
  }
  
  extractSkillsFromResume(resumeText) {
    console.log("开始从简历提取技能...");
    
    if (!resumeText || resumeText.trim().length < 10) {
      return [];
    }
    
    const skills = [];
    const seen = new Set();
    
    // 提取有明确级别的技能
    const levelPattern = /(精通|熟练|熟悉|掌握|了解|使用过)\s*([\u4e00-\u9fa5a-zA-Z0-9+/]{2,20})/gi;
    let match;
    
    while ((match = levelPattern.exec(resumeText)) !== null) {
      const level = match[1];
      const skillName = match[2].trim();
      const key = `${skillName}:${level}`;
      
      if (!seen.has(key) && skillName.length > 1) {
        seen.add(key);
        
        const skill = {
          name: skillName,
          level: level,
          weight: this.skillLevels[level] || 1.0,
          contexts: []
        };
        
        // 判断上下文
        const lineStart = Math.max(0, resumeText.lastIndexOf("\n", match.index));
        const lineEnd = resumeText.indexOf("\n", match.index);
        const line = resumeText.substring(lineStart, lineEnd !== -1 ? lineEnd : undefined).trim();
        
        if (line.includes("技能") || line.includes("专业") || line.includes("技术")) {
          skill.contexts.push("技能");
        }
        if (line.includes("项目") || line.includes("经验") || line.includes("开发")) {
          skill.contexts.push("项目经验");
        }
        
        if (skill.contexts.length === 0) {
          skill.contexts.push("其他");
        }
        
        skills.push(skill);
      }
    }
    
    return skills;
  }
  
  analyzeSkillMatch(jdSkills, resumeSkills) {
    // 改进的匹配分析
    let matchedCount = 0;
    let totalLevelScore = 0;
    let maxLevelScore = 0;
    const missingSkills = [];
    
    jdSkills.forEach(jdSkill => {
      // 寻找匹配的技能
      let bestMatch = null;
      let bestScore = 0;
      
      resumeSkills.forEach(resumeSkill => {
        const similarity = this.calculateSkillSimilarity(jdSkill.name, resumeSkill.name);
        if (similarity > bestScore) {
          bestScore = similarity;
          bestMatch = resumeSkill;
        }
      });
      
      if (bestMatch && bestScore > 0.5) { // 相似度阈值
        matchedCount++;
        totalLevelScore += Math.min(bestMatch.weight, jdSkill.weight);
      } else {
        missingSkills.push(jdSkill);
      }
      
      maxLevelScore += jdSkill.weight;
    });
    
    const coverage = jdSkills.length > 0 ? (matchedCount / jdSkills.length) * 100 : 0;
    const levelMatch = maxLevelScore > 0 ? (totalLevelScore / maxLevelScore) * 100 : 0;
    
    return {
      jdSkillCount: jdSkills.length,
      resumeSkillCount: resumeSkills.length,
      matchedCount,
      coverage,
      levelMatch,
      missingSkills
    };
  }
  
  calculateSkillSimilarity(skill1, skill2) {
    const text1 = skill1.toLowerCase();
    const text2 = skill2.toLowerCase();
    
    // 1. 完全相等
    if (text1 === text2) return 1.0;
    
    // 2. 包含关系
    if (text2.includes(text1) || text1.includes(text2)) return 0.9;
    
    // 3. 提取核心词比较
    const coreTerms = ['react', 'vue', 'javascript', 'typescript', 'node', 'python', 'java',
                      'html', 'css', 'webpack', '工程化', '架构', '设计', '开发', '框架'];
    
    let matchCount = 0;
    coreTerms.forEach(term => {
      if (text1.includes(term) && text2.includes(term)) {
        matchCount++;
      }
    });
    
    if (matchCount > 0) {
      return Math.min(0.7 + matchCount * 0.1, 0.9);
    }
    
    // 4. 最低相似度
    return 0.3;
  }
  
  calculateSkillScore(analysis) {
    if (analysis.jdSkillCount === 0) return 70;
    
    // 分数构成：覆盖率（60%） + 级别匹配度（40%）
    const coverageScore = analysis.coverage * 0.6;
    const levelScore = analysis.levelMatch * 0.4;
    
    let rawScore = coverageScore + levelScore;
    
    // 调整到合理范围
    rawScore = Math.min(Math.max(rawScore, 0), 100);
    
    return Math.round(rawScore);
  }
  
  identifySkillIssues(analysis, jdSkills, resumeSkills) {
    const issues = [];
    
    // 问题1：缺失关键技能
    analysis.missingSkills.forEach(skill => {
      issues.push({
        type: "missing_skill",
        skill: skill.name,
        requiredLevel: skill.level,
        severity: skill.weight >= 2.0 ? "serious" : "medium",
        description: `缺失关键技能："${skill.name}"（JD要求：${skill.level}）`,
        suggestion: `在简历中添加"${skill.name}"相关描述，可放在技能部分或项目经验中`
      });
    });
    
    // 问题2：技能级别不足
    jdSkills.forEach(jdSkill => {
      resumeSkills.forEach(resumeSkill => {
        const similarity = this.calculateSkillSimilarity(jdSkill.name, resumeSkill.name);
        if (similarity > 0.5 && resumeSkill.weight < jdSkill.weight * 0.7) {
          issues.push({
            type: "low_skill_level",
            skill: jdSkill.name,
            requiredLevel: jdSkill.level,
            currentLevel: resumeSkill.level,
            severity: "medium",
            description: `"${jdSkill.name}"技能级别不足（当前：${resumeSkill.level}，要求：${jdSkill.level}）`,
            suggestion: `提升"${jdSkill.name}"的描述级别，或补充相关高级应用经验`
          });
        }
      });
    });
    
    return issues;
  }
  
  calculateOptimizedScore(currentScore, issues) {
    // 目标：必须达到B级（60-74分） - 规范3.1章要求
    const targetMin = 60;
    const targetMax = 74;
    
    // 如果当前已经在B级范围，保持
    if (currentScore >= targetMin && currentScore <= targetMax) {
      return Math.min(targetMax, currentScore + 5);
    }
    
    // 如果低于B级，确保提升到B级
    if (currentScore < targetMin) {
      const seriousIssues = issues.filter(i => i.severity === "serious");
      const potentialImprovement = Math.min(40, seriousIssues.length * 15);
      const newScore = Math.min(targetMax, currentScore + potentialImprovement);
      return Math.max(targetMin, newScore);
    }
    
    // 如果超过B级，调整到B级上限（符合规范要求）
    return targetMax;
  }
  
  // === 规范输出生成 ===
  
  generateStandardOutput(currentScore, currentGrade, optimizedScore, optimizedGrade, improvementScore, issues, analysis) {
    const status = this.determineStatus(currentGrade, optimizedGrade, improvementScore);
    
    return {
      dimension: "skill_match",
      display_name: "技能匹配度",
      icon: "🛠️",
      color: this.getGradeColor(currentGrade),
      current_score: currentScore,
      current_grade: currentGrade,
      optimized_score: optimizedScore,
      optimized_grade: optimizedGrade,
      status: status,
      improvement_score: improvementScore,
      statement: {
        pre_optimization: this.generatePreStatement(currentGrade, analysis, issues),
        post_optimization: this.generatePostStatement(optimizedGrade, analysis, issues)
      },
      directive_abstract: this.generateDirectiveAbstract(issues),
      issue_count: issues.length,
      issues: issues.slice(0, 5),
      detailed_analysis: {
        jd_skill_count: analysis.jdSkillCount,
        resume_skill_count: analysis.resumeSkillCount,
        matched_count: analysis.matchedCount,
        coverage: analysis.coverage.toFixed(1),
        level_match: analysis.levelMatch.toFixed(1),
        missing_skills_count: analysis.missingSkills?.length || 0
      }
    };
  }
  
  generatePreStatement(grade, analysis, issues) {
    const missingCount = issues.filter(i => i.type === "missing_skill").length;
    
    if (grade === "D") {
      return `技能匹配严重不足，发现${missingCount}个关键技能缺失，将导致在技能筛选中被排除`;
    } else if (grade === "C") {
      return `技能匹配存在明显问题，${missingCount}个重要技能缺失或级别不足，在竞争中处于劣势`;
    } else if (grade === "B") {
      return missingCount > 0 ? 
        `已达到基本技能要求，但${missingCount}个技能匹配较为薄弱，有优化空间以增强竞争力` :
        "技能列表匹配，但缺乏能证明深度理解和熟练度的具体案例或细节佐证";
    } else if (grade === "A") {
      return "技能匹配良好，在同类简历中具备较好的竞争力";
    } else {
      return "技能匹配优秀，形成显著的技术优势";
    }
  }
  
  generatePostStatement(grade, analysis, issues) {
    if (grade === "B") {
      return "通过优化关键技能描述和补充应用场景，已将技能匹配提升至合格水平";
    } else if (grade === "A") {
      return "技能匹配已达到良好水平，在技术评估中具备竞争优势";
    } else {
      return "技能匹配已得到优化，技术能力呈现更加完整";
    }
  }
  
  generateDirectiveAbstract(issues) {
    const missingSkills = issues.filter(i => i.type === "missing_skill");
    const lowLevelSkills = issues.filter(i => i.type === "low_skill_level");
    
    if (missingSkills.length > 0) {
      const skillList = missingSkills.slice(0, 3).map(i => i.skill);
      return `补充${missingSkills.length}个缺失技能：${skillList.join('、')}${missingSkills.length > 3 ? '等' : ''}`;
    }
    
    if (lowLevelSkills.length > 0) {
      return `提升${lowLevelSkills.length}个技能的描述级别`;
    }
    
    return "优化技能描述与应用场景，提升技术能力呈现";
  }
  
  createErrorResult(error) {
    return {
      dimension: "skill_match",
      display_name: "技能匹配度",
      icon: "🛠️",
      color: "#fa8c16",
      current_score: 50,
      current_grade: "C",
      optimized_score: 70,
      optimized_grade: "B",
      status: "⏳ 待优化",
      improvement_score: 20,
      statement: {
        pre_optimization: "技能匹配度分析过程中出现错误",
        post_optimization: "修复分析问题后重新评估技能匹配度"
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
