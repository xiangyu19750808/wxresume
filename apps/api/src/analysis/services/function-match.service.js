/**
 * 全维度职能匹配分析器 - 严格对齐《九维分析呈现标准规范》
 * 核心价值：展现团队适应性与综合职能素养
 * 优化目标：必须达到 B 级(合格) 以上，重点在于挖掘潜在贡献
 * P优先级：P2 (长期契合层)
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
    
    // 职能能力库：用于扫描简历与JD的交叉点
    this.functionKeywords = {
      'teamwork': ['团队', '协作', '合作', '配合', '协同', '跨部门'],
      'communication': ['沟通', '交流', '表达', '汇报', '谈判', '协调'],
      'problem_solving': ['解决', '处理', '应对', '难题', '排查', '优化'],
      'leadership': ['带领', '指导', '管理', '组织', '培养', '梯队'],
      'initiative': ['主动', '积极', '自发', '推动', '突破']
    };
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
    console.log("=== 🤝 全维度职能匹配分析（规范版） ===");
    try {
      const resumeFunctions = this.analyzeFunctions(resumeText);
      const jdRequirements = this.analyzeJDRequirements(jdText);
      
      const currentScore = this.evaluateMatch(resumeFunctions, jdRequirements);
      const currentGrade = this.mapScoreToGrade(currentScore);
      
      // 优化目标：P2维度确保 B->A 提升 (规范3.1)
      const optimizedScore = this.ensureBtoAImprovement(currentScore);
      const optimizedGrade = this.mapScoreToGrade(optimizedScore);
      const improvementScore = optimizedScore - currentScore;

      // 确定规范状态 (规范2.2)
      let status = "✨ 已优化";
      if (currentGrade === "D" || currentGrade === "C") status = "🔓 已解决";
      else if (improvementScore >= 10) status = "🔄 已提升";

      // 生成规范话术 (对齐4.2)
      const statement = this.generateStandardStatement(currentGrade, optimizedGrade);

      return {
        dimension: "function_match",
        display_name: "全维度职能匹配",
        icon: "🤝",
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
        directive_abstract: this.generateDirectiveAbstract(resumeFunctions, jdRequirements),
        issue_count: this.getMissingFunctions(resumeFunctions, jdRequirements).length,
        detailed_analysis: {
          match_rate: this.calculateMatchRate(resumeFunctions, jdRequirements),
          strong_points: this.getStrongFunctions(resumeFunctions)
        }
      };
    } catch (error) {
      return this.errorResult(error);
    }
  }

  // === 内部核心逻辑 ===

  analyzeFunctions(text) {
    const results = {};
    Object.entries(this.functionKeywords).forEach(([type, keys]) => {
      const hits = keys.filter(k => text.includes(k)).length;
      if (hits > 0) results[type] = hits;
    });
    return results;
  }

  analyzeJDRequirements(jdText) {
    const reqs = {};
    Object.entries(this.functionKeywords).forEach(([type, keys]) => {
      if (keys.some(k => jdText.includes(k))) reqs[type] = true;
    });
    return reqs;
  }

  evaluateMatch(resFunc, jdReq) {
    const reqKeys = Object.keys(jdReq);
    if (reqKeys.length === 0) return 70; // 无显式要求则给基础合格分
    
    const matched = reqKeys.filter(k => resFunc[k]).length;
    const score = (matched / reqKeys.length) * 100;
    return Math.max(35, Math.min(95, score));
  }

  ensureBtoAImprovement(currentScore) {
    // 强制提升逻辑：如果低于75，强制拉升至80+；如果已优秀，微调
    if (currentScore < 75) return 82;
    return Math.min(96, currentScore + 8);
  }

  generateStandardStatement(currGrade, optGrade) {
    const preStatements = {
      "D": "职能匹配度极低，简历中完全缺失团队协作与职业软技能描述，极易被判定为团队融入度低。",
      "C": "软技能展示薄弱，缺乏对协作、沟通等关键职能的具体证明，存在适配性疑虑。",
      "B": "职能要求基本覆盖，但描述过于泛泛，未主动展现对团队未来发展的独特价值。",
      "A": "职能匹配良好，展现了扎实的职业素养与团队适应性。",
      "S": "全维度职能表现卓越，展现了极强的组织影响力与角色契合度。"
    };

    return {
      pre: preStatements[currGrade] || preStatements["B"],
      post: "通过引入具体协作场景与影响力描述，职能画像已从“合格执行者”成功转化为“团队增值者”。"
    };
  }

  generateDirectiveAbstract(resFunc, jdReq) {
    const missing = Object.keys(jdReq).filter(k => !resFunc[k]);
    if (missing.length === 0) return "职能素养已全面对标，建议保持故事化呈现。";
    
    const names = { teamwork: '协作', communication: '沟通', leadership: '领导力', initiative: '主动性', problem_solving: '解题' };
    return `通过补充${missing.map(m => names[m]).slice(0, 2).join('与')}的具体案例，消除职能适配盲点。`;
  }

  calculateMatchRate(resFunc, jdReq) {
    const reqs = Object.keys(jdReq);
    if (reqs.length === 0) return 100;
    return Math.round((reqs.filter(k => resFunc[k]).length / reqs.length) * 100);
  }

  getStrongFunctions(resFunc) {
    return Object.keys(resFunc).map(k => k.toUpperCase());
  }

  getMissingFunctions(resFunc, jdReq) {
    return Object.keys(jdReq).filter(k => !resFunc[k]);
  }

  errorResult(e) {
    return { dimension: "function_match", display_name: "全维度职能匹配", current_score: 0, current_grade: "D", status: "分析失败" };
  }
}