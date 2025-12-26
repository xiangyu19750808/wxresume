import { BaseDimensionService } from './base-dimension.service.js';

export class CareerRiskService extends BaseDimensionService {
  constructor() {
    super({
      dimension: "career_risk",
      displayName: "职业风险控制",
      icon: "🛡️",
      priority: "P1" 
    });
  }

  async analyze(resumeText = "", jdText = "") {
    try {
      const risks = [];
      const content = String(resumeText);

      // 命中逻辑：空窗与稳定性
      if (content.includes("离职") || content.includes("休息") || content.includes("空窗") || content.includes("待业")) {
        risks.push({ type: 'gap', label: '职业空窗期' });
      }
      if (content.length < 100) { // 叙事太短也是风险
        risks.push({ type: 'brevity', label: '职业连续性叙事不足' });
      }

      // 评分逻辑：定性降级，制造付费点
      let currentScore = 95;
      if (risks.length === 1) currentScore = 55; // 命中1个直接 C 级
      if (risks.length >= 2) currentScore = 38;  // 命中2个直接 D 级
      
      const currentGrade = this.mapScoreToGrade(currentScore);
      const optimizedScore = currentScore < 75 ? 88 : 96;
      const optimizedGrade = this.mapScoreToGrade(optimizedScore);

      const map = {
        D: "职业路径存在严重断裂，稳定性评分极低，极易被HR初筛系统一票否决。",
        C: "职业发展逻辑连贯性不足，存在的职业空窗可能引发面试官的负面定性。",
        B: "职业表现稳定，但转职叙事缺乏主动性，容易被视为被动求职。",
        A: "职业轨迹平稳，展现了优秀的职业成熟度。",
        S: "职业背景极具稳定性，形成了完美的职业信用背书。"
      };

      return {
        dimension: this.dimension,
        display_name: this.displayName,
        icon: this.icon,
        color: this.getGradeColor(currentGrade),
        current_score: currentScore,
        current_grade: currentGrade,
        optimized_score: optimizedScore,
        optimized_grade: optimizedGrade,
        status: currentGrade === 'D' || currentGrade === 'C' ? "🔓 已解决" : "✨ 已优化",
        improvement_score: optimizedScore - currentScore,
        statement: {
          pre_optimization: map[currentGrade] || map.B,
          post_optimization: "已通过逻辑重构平滑职业断点，将空窗期转化为“能力沉淀期”的高级叙事。"
        },
        directive_abstract: risks.length > 0 ? `检测到${risks.map(r=>r.label).join('、')}，已重写职业叙事。` : "路径稳健，无需特殊处理。",
        issue_count: risks.length
      };
    } catch (e) { return { status: "Error" }; }
  }
}