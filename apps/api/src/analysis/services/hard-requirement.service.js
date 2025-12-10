import { BaseDimensionService } from './base-dimension.service.js';

export class HardRequirementService extends BaseDimensionService {
  constructor() {
    super({
      dimension: "hard_requirements",
      displayName: "硬性要求匹配",
      icon: "🎯",
      priority: "P0"
    });
  }

  analyze(resumeText, jdText) {
    console.log("=== 🎯 硬性要求匹配分析开始 ===");
    
    // 1. 计算当前分数
    const currentScore = this.calculateScore(resumeText, jdText);
    const currentGrade = this.scoreToGrade(currentScore);
    
    console.log(`当前分数: ${currentScore}, 等级: ${currentGrade}`);
    
    // 2. 识别问题
    const issues = this.identifyIssues(resumeText, jdText);
    
    // 3. 模拟优化后结果
    const optimizedScore = this.simulateOptimizedScore(currentScore, issues);
    const optimizedGrade = this.scoreToGrade(optimizedScore);
    const improvementScore = optimizedScore - currentScore;
    
    console.log(`优化后分数: ${optimizedScore}, 等级: ${optimizedGrade}, 改进: +${improvementScore}`);
    
    // 4. 确定状态
    const status = this.determineStatus(currentGrade, optimizedGrade, improvementScore);
    
    // 5. 生成陈述
    const statement = this.generateStatement(currentGrade, optimizedGrade, issues.length);
    
    // 6. 生成优化摘要
    const directiveAbstract = this.generateDirectiveAbstract(issues);
    
    return {
      dimension: "hard_requirements",
      display_name: "硬性要求匹配",
      icon: "🎯",
      color: this.getGradeColor(currentGrade),
      current_score: currentScore,
      current_grade: currentGrade,
      optimized_score: optimizedScore,
      optimized_grade: optimizedGrade,
      status: status,
      improvement_score: improvementScore,
      statement: statement,
      directive_abstract: directiveAbstract,
      issue_count: issues.length,
      issues: issues.slice(0, 5)
    };
  }

  calculateScore(resumeText, jdText) {
    const requirements = this.extractRequirements(jdText);
    
    if (requirements.length === 0) {
      return 75;
    }

    let matchedWeight = 0;
    let totalWeight = 0;
    
    requirements.forEach(req => {
      totalWeight += req.weight || 15;
      if (this.checkRequirement(resumeText, req)) {
        matchedWeight += req.weight || 15;
      }
    });

    const weightRatio = totalWeight > 0 ? matchedWeight / totalWeight : 0;
    const score = Math.round(weightRatio * 100);
    
    return Math.max(0, Math.min(100, score));
  }

  scoreToGrade(score) {
    if (score >= 90) return "S";
    if (score >= 75) return "A";
    if (score >= 60) return "B";
    if (score >= 40) return "C";
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
    return colors[grade] || "#fa8c16";
  }

  simulateOptimizedScore(currentScore, issues) {
    const maxImprovement = Math.min(issues.length * 15, 100 - currentScore);
    const improvement = Math.floor(maxImprovement * 0.7);
    return Math.min(100, currentScore + improvement);
  }

  determineStatus(currentGrade, optimizedGrade, improvementScore) {
    if (improvementScore <= 0) return "⏳ 待优化";
    
    const gradeOrder = { "D": 1, "C": 2, "B": 3, "A": 4, "S": 5 };
    if (gradeOrder[optimizedGrade] > gradeOrder[currentGrade]) {
      return "🔓 已解决";
    }
    
    if (improvementScore >= 15) {
      return "🔄 已提升";
    }
    
    return "✨ 已优化";
  }

  generateStatement(currentGrade, optimizedGrade, issueCount) {
    const statements = {
      "D": {
        pre: "岗位明确要求的硬性要求未满足，在HR快速筛选中将被直接排除。",
        post: "通过关键要求的弥合与证明，已将硬性要求匹配从淘汰边缘提升至安全水平。"
      },
      "C": {
        pre: "关键要求匹配较为薄弱，在竞争激烈时可能成为被优先淘汰的因素。",
        post: "通过强化关键资质证明，已将硬性要求匹配提升至合格水平。"
      },
      "B": {
        pre: "已达到基本要求，但尚未提供超出预期的、令人印象深刻的资质证明。",
        post: "通过补充项目复杂度证明，已将关键要求匹配提升至良好水平。"
      },
      "A": {
        pre: "硬性要求匹配良好，具备竞争优势。",
        post: "通过精细化优化，硬性要求匹配已达到优秀水平。"
      },
      "S": {
        pre: "硬性要求匹配突出，形成显著优势。",
        post: "硬性要求匹配已达到顶尖水平。"
      }
    };
    
    const currentStmt = statements[currentGrade] || statements["C"];
    const optimizedStmt = statements[optimizedGrade] || statements["B"];
    
    return {
      pre_optimization: currentStmt.pre,
      post_optimization: optimizedStmt.post
    };
  }

  generateDirectiveAbstract(issues) {
    if (issues.length === 0) {
      return "所有硬性要求均已满足。";
    }
    
    const fixedIssues = [];
    issues.forEach(issue => {
      const match = issue.description.match(/要求：([^）]+)/);
      if (match) {
        fixedIssues.push(match[1]);
      }
    });
    
    const uniqueIssues = [...new Set(fixedIssues)];
    const issueText = uniqueIssues.length > 0 ? 
      `弥合了${uniqueIssues.length}项要求差距：${uniqueIssues.slice(0, 3).join('、')}${uniqueIssues.length > 3 ? '等' : ''}` :
      `修复了${issues.length}项匹配问题`;
    
    return issueText;
  }

  identifyIssues(resumeText, jdText) {
    console.log("=== 🎯 识别问题开始 ===");
    const issues = [];
    const requirements = this.extractRequirements(jdText);

    requirements.forEach(req => {
      if (!this.checkRequirement(resumeText, req)) {
        console.log(`发现未满足要求: ${req.description}`);
        issues.push({
          penalty: req.weight || 15,
          description: `未满足硬性要求：${req.description}`,
          suggestion: this.generateSuggestion(req)
        });
      }
    });

    console.log(`识别到问题数量: ${issues.length}`);
    console.log("=== 🎯 识别问题结束 ===");
    return issues;
  }

  extractRequirements(jdText) {
    if (!jdText || jdText.trim().length < 5) {
      console.log("JD文本太短，无法提取要求");
      return [];
    }
    
    const requirements = [];
    
    console.log("提取要求，JD文本:", jdText.substring(0, 200));

    // 1. 学历要求
    if (jdText.includes("学历：") || jdText.includes("学历:") || jdText.includes("本科") || jdText.includes("硕士") || jdText.includes("大专")) {
      console.log("找到学历相关关键词");
      
      let degree = "本科";
      if (jdText.includes("大专")) degree = "大专";
      if (jdText.includes("本科")) degree = "本科";
      if (jdText.includes("硕士")) degree = "硕士";
      if (jdText.includes("博士")) degree = "博士";
      
      console.log(`添加学历要求: ${degree}及以上`);
      requirements.push({
        type: "degree",
        value: degree,
        description: `学历要求：${degree}及以上`,
        weight: 25
      });
    }

    // 2. 经验要求
    const expMatch = jdText.match(/(\d+)\s*年/);
    if (expMatch) {
      const years = parseInt(expMatch[1]);
      if (years > 0 && years < 50) {
        console.log(`添加经验要求: ${years}年以上`);
        requirements.push({
          type: "experience",
          value: years,
          description: `工作经验：${years}年以上`,
          weight: 30
        });
      }
    }

    // 3. 证书要求
    if (jdText.includes("PMP") || jdText.includes("证书")) {
      console.log("添加证书要求: PMP证书");
      requirements.push({
        type: "certification",
        value: "PMP",
        description: "证书要求：PMP证书",
        weight: 20
      });
    }

    // 4. 技能要求
    const skills = ["typescript", "react", "vue", "javascript", "python", "java"];
    skills.forEach(skill => {
      if (jdText.toLowerCase().includes(skill)) {
        console.log(`添加技能要求: ${skill}`);
        requirements.push({
          type: "skill",
          value: skill,
          description: `技能要求：${skill}`,
          weight: 15
        });
      }
    });

    console.log(`总共提取到 ${requirements.length} 个要求`);
    return requirements;
  }

  checkRequirement(resumeText, requirement) {
    if (!resumeText) return false;
    
    switch (requirement.type) {
      case "degree":
        return this.checkDegree(resumeText, requirement.value);
      case "experience":
        return this.checkExperience(resumeText, requirement.value);
      case "certification":
        return this.checkCertification(resumeText, requirement.value);
      case "skill":
        return this.checkSkill(resumeText, requirement.value);
      default:
        return false;
    }
  }

  checkDegree(resumeText, requiredDegree) {
    console.log(`学历检查: 要求"${requiredDegree}", 简历: ${resumeText.substring(0, 100)}`);
    
    // 学历等级映射
    const degreeLevels = {
      "大专": 1,
      "本科": 2, 
      "硕士": 3,
      "博士": 4
    };
    
    // 获取要求的学历等级
    let requiredLevel = 2; // 默认本科
    for (const [degree, level] of Object.entries(degreeLevels)) {
      if (requiredDegree.includes(degree)) {
        requiredLevel = level;
        console.log(`要求学历等级: ${degree} (${level}级)`);
        break;
      }
    }
    
    // 获取简历中的最高学历等级
    let resumeLevel = 0;
    for (const [degree, level] of Object.entries(degreeLevels)) {
      if (resumeText.includes(degree)) {
        resumeLevel = Math.max(resumeLevel, level);
      }
    }
    
    console.log(`简历最高学历等级: ${resumeLevel}级`);
    
    // 检查简历学历是否达到或超过要求
    const matched = resumeLevel >= requiredLevel;
    console.log(`学历检查结果: ${matched ? '匹配' : '不匹配'}`);
    return matched;
  }

  checkExperience(resumeText, requiredYears) {
    const yearMatch = resumeText.match(/(\d+)\s*年/);
    if (yearMatch) {
      const foundYears = parseInt(yearMatch[1]);
      const matched = foundYears >= requiredYears;
      console.log(`经验检查: 要求${requiredYears}年, 找到${foundYears}年, 结果${matched ? '匹配' : '不匹配'}`);
      return matched;
    }
    console.log(`经验检查: 要求${requiredYears}年, 未找到经验信息`);
    return false;
  }

  checkCertification(resumeText, requiredCert) {
    const hasCert = resumeText.toLowerCase().includes(requiredCert.toLowerCase());
    console.log(`证书检查: 要求${requiredCert}, 结果${hasCert ? '有' : '无'}`);
    return hasCert;
  }

  checkSkill(resumeText, requiredSkill) {
    const hasSkill = resumeText.toLowerCase().includes(requiredSkill.toLowerCase());
    console.log(`技能检查: 要求${requiredSkill}, 结果${hasSkill ? '有' : '无'}`);
    return hasSkill;
  }

  generateSuggestion(requirement) {
    switch (requirement.type) {
      case "degree":
        return `如未达到${requirement.value}学历，可补充相关培训、专业课程或强调等效工作能力`;
      case "experience":
        return `补充${requirement.value}年以上相关经验，提供项目、兼职或等效实践经历`;
      case "certification":
        return `获取${requirement.value}证书，或提供等效的专业能力证明`;
      case "skill":
        return `补充${requirement.value}技能的具体应用案例和项目成果`;
      default:
        return "补充相关能力证明材料";
    }
  }
}
