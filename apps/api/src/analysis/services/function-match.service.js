/**
 * 全维度职能匹配分析器（修复版）
 * 维度名称：全维度职能匹配（Dimension 8）
 * 核心价值：展现团队适应性
 * 安全等级：B级（合格）
 * 优化焦点：软技能、协作能力展示
 * P优先级：P2（长期契合层）
 */
import { BaseDimensionService } from './base-dimension.service.js';

export class FunctionMatchService extends BaseDimensionService {
  constructor() {
    super({
      dimension: "function_match",
      displayName: "全维度职能匹配", 
      icon: "🤝",
      priority: "P2"
    });
    
    // 职能能力关键词库
    this.functionKeywords = {
      'teamwork': ['团队', '协作', '合作', '配合', '协同'],
      'communication': ['沟通', '交流', '表达', '汇报'],
      'problem_solving': ['解决', '处理', '应对', '难题'],
      'adaptability': ['适应', '灵活', '变通', '调整'],
      'leadership': ['带领', '指导', '管理', '组织'],
      'initiative': ['主动', '积极', '自发', '推动']
    };
  }
  
  async analyze(resumeText, jdText) {
    console.log("=== 🤝 全维度职能匹配分析开始 ===");
    
    try {
      // 1. 分析简历中的职能能力
      const resumeFunctions = this.analyzeFunctions(resumeText);
      console.log(`简历职能能力: ${Object.keys(resumeFunctions).length}类`);
      
      // 2. 分析JD要求的职能能力
      const jdRequirements = this.analyzeJDRequirements(jdText);
      console.log(`JD职能要求: ${Object.keys(jdRequirements).length}类`);
      
      // 3. 评估匹配度
      const matchScore = this.evaluateMatch(resumeFunctions, jdRequirements);
      const currentGrade = this.mapScoreToGrade(matchScore);
      
      // 4. 计算优化分数（确保B级合格）
      const optimizedScore = this.ensureBLevel(matchScore, resumeFunctions, jdRequirements);
      const optimizedGrade = this.mapScoreToGrade(optimizedScore);
      const improvementScore = Math.max(0, optimizedScore - matchScore); // 确保非负
      
      // 5. 确定状态
      const status = this.determineStatus(currentGrade, optimizedGrade, improvementScore);
      
      // 6. 返回规范结果
      return {
        dimension: "function_match",
        display_name: "全维度职能匹配",
        icon: "🤝",
        color: this.getGradeColor(currentGrade),
        current_score: Math.round(matchScore),
        current_grade: currentGrade,
        optimized_score: Math.round(optimizedScore),
        optimized_grade: optimizedGrade,
        status: status,
        improvement_score: Math.round(improvementScore),
        statement: {
          pre_optimization: this.getPreStatement(currentGrade, resumeFunctions, jdRequirements),
          post_optimization: this.getPostStatement(optimizedGrade, resumeFunctions, jdRequirements)
        },
        directive_abstract: this.getDirective(resumeFunctions, jdRequirements),
        issue_count: this.countIssues(resumeFunctions, jdRequirements),
        issues: this.generateIssues(resumeFunctions, jdRequirements),
        detailed_analysis: {
          function_count: Object.keys(resumeFunctions).length,
          requirement_count: Object.keys(jdRequirements).length,
          match_rate: this.calculateMatchRate(resumeFunctions, jdRequirements),
          strong_functions: this.getStrongFunctions(resumeFunctions),
          missing_functions: this.getMissingFunctions(resumeFunctions, jdRequirements)
        }
      };
      
    } catch (error) {
      console.error("全维度职能匹配分析错误:", error);
      return this.errorResult(error);
    }
  }
  
  // === 修复的核心算法 ===
  
  analyzeFunctions(text) {
    const functions = {};
    
    Object.entries(this.functionKeywords).forEach(([funcType, keywords]) => {
      let count = 0;
      keywords.forEach(keyword => {
        if (text.includes(keyword)) {
          count++;
        }
      });
      
      if (count > 0) {
        functions[funcType] = {
          count,
          strength: count >= 2 ? 'strong' : 'weak'
        };
      }
    });
    
    return functions;
  }
  
  analyzeJDRequirements(jdText) {
    const requirements = {};
    
    Object.entries(this.functionKeywords).forEach(([funcType, keywords]) => {
      keywords.forEach(keyword => {
        if (jdText.includes(keyword)) {
          requirements[funcType] = true;
        }
      });
    });
    
    return requirements;
  }
  
  evaluateMatch(resumeFunctions, jdRequirements) {
    const requiredTypes = Object.keys(jdRequirements);
    
    // 如果没有具体要求，检查是否有基本职能能力
    if (requiredTypes.length === 0) {
      const funcCount = Object.keys(resumeFunctions).length;
      if (funcCount >= 2) return 75; // 有基本职能能力
      if (funcCount === 1) return 65; // 有一点职能能力
      return 55; // 无职能能力
    }
    
    // 计算匹配度
    let matchedCount = 0;
    requiredTypes.forEach(type => {
      if (resumeFunctions[type]) {
        matchedCount++;
      }
    });
    
    const matchRate = matchedCount / requiredTypes.length;
    
    // 基础分 + 匹配度得分
    let score = 50 + (matchRate * 40);
    
    // 额外能力加分（最多10分）
    const extraFunctions = Object.keys(resumeFunctions).filter(f => !jdRequirements[f]);
    score += Math.min(10, extraFunctions.length * 3);
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }
  
  ensureBLevel(currentScore, resumeFunctions, jdRequirements) {
    // 规范要求：必须达到B级合格水平（60分）
    const targetMin = 60;
    
    if (currentScore >= targetMin) {
      // 已经是B级以上，适度优化（但不超过当前等级上限）
      if (currentScore >= 90) {
        // S级可以保持或小幅优化
        return Math.min(100, currentScore + 2);
      } else if (currentScore >= 75) {
        // A级适度优化
        return Math.min(89, currentScore + 8);
      } else {
        // B级提升到A级
        return Math.min(89, currentScore + 15);
      }
    }
    
    // 低于B级，强制提升到B级
    return Math.max(targetMin, Math.min(89, currentScore + 20));
  }
  
  getPreStatement(grade, resumeFunctions, jdRequirements) {
    if (grade === "D") {
      return "职能要求基本不匹配，可能被判定为完全不适合该岗位或团队角色";
    } else if (grade === "C") {
      return "部分软技能或辅助职能存在欠缺，可能在后续评估轮次中暴露适配风险";
    } else if (grade === "B") {
      return "职能要求基本覆盖，但未主动展现您对团队未来发展的潜在贡献与价值";
    } else if (grade === "A") {
      return "职能匹配良好，展现了较好的团队适应性和综合能力";
    } else {
      return "职能匹配优秀，展现了卓越的团队协作和综合能力";
    }
  }
  
  getPostStatement(grade, resumeFunctions, jdRequirements) {
    if (grade === "B") {
      return "通过补充关键职能能力证明，已达到合格匹配水平";
    } else if (grade === "A") {
      return "职能匹配已达到良好水平，展现了全面的团队适应性";
    } else if (grade === "S") {
      return "职能匹配卓越，形成显著优势";
    } else {
      return "职能匹配已得到优化";
    }
  }
  
  getDirective(resumeFunctions, jdRequirements) {
    const missing = this.getMissingFunctions(resumeFunctions, jdRequirements);
    
    if (missing.length > 0) {
      const missingNames = missing.map(m => this.getFunctionName(m)).slice(0, 3).join('、');
      return `补充${missingNames}等职能能力`;
    }
    
    if (Object.keys(resumeFunctions).length === 0) {
      return "增加团队协作等综合职能描述";
    }
    
    return "优化职能能力的故事化呈现";
  }
  
  countIssues(resumeFunctions, jdRequirements) {
    return this.getMissingFunctions(resumeFunctions, jdRequirements).length;
  }
  
  generateIssues(resumeFunctions, jdRequirements) {
    const issues = [];
    const missing = this.getMissingFunctions(resumeFunctions, jdRequirements);
    
    missing.forEach(funcType => {
      issues.push({
        type: "missing_function",
        severity: "medium",
        description: `缺少${this.getFunctionName(funcType)}能力的证明`,
        suggestion: this.getSuggestion(funcType)
      });
    });
    
    return issues;
  }
  
  getMissingFunctions(resumeFunctions, jdRequirements) {
    const requiredTypes = Object.keys(jdRequirements);
    return requiredTypes.filter(type => !resumeFunctions[type]);
  }
  
  getStrongFunctions(resumeFunctions) {
    return Object.entries(resumeFunctions)
      .filter(([_, data]) => data.strength === 'strong')
      .map(([type]) => this.getFunctionName(type));
  }
  
  calculateMatchRate(resumeFunctions, jdRequirements) {
    const requiredTypes = Object.keys(jdRequirements);
    if (requiredTypes.length === 0) return 0;
    
    const matched = requiredTypes.filter(type => resumeFunctions[type]).length;
    return Math.round((matched / requiredTypes.length) * 100);
  }
  
  getFunctionName(funcType) {
    const names = {
      'teamwork': '团队协作',
      'communication': '沟通能力',
      'problem_solving': '问题解决',
      'adaptability': '适应能力',
      'leadership': '领导能力',
      'initiative': '主动性'
    };
    return names[funcType] || funcType;
  }
  
  getSuggestion(funcType) {
    const suggestions = {
      'teamwork': '增加团队合作、跨部门协作的具体案例',
      'communication': '补充沟通协调、汇报表达的实际经历',
      'problem_solving': '突出复杂问题解决的案例和成果',
      'adaptability': '展现快速学习、适应变化的经历',
      'leadership': '补充带领团队、指导他人的经验',
      'initiative': '突出主动推动、创新改进的案例'
    };
    return suggestions[funcType] || '补充相关能力的证明案例';
  }
  
  errorResult(error) {
    return {
      dimension: "function_match",
      display_name: "全维度职能匹配",
      icon: "🤝",
      color: "#faad14",
      current_score: 65,
      current_grade: "B",
      optimized_score: 75,
      optimized_grade: "A",
      status: "⏳ 待优化",
      improvement_score: 10,
      statement: {
        pre_optimization: "全维度职能匹配分析过程中出现错误",
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
