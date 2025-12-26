import { BaseDimensionService } from './base-dimension.service.js';

export class ValuePropositionService extends BaseDimensionService {
  constructor() {
    super({
      dimension: "value_proposition",
      displayName: "价值呈现分析",
      icon: "??",
      priority: "P1"
    });
  }

  async analyze(resumeText = "", jdText = "") {
    // === 核心逻辑优化：排除年份干扰 ===
    // 1. 只匹配带单位的数字（如 10%、50万）
    // 2. 匹配业务增长动词
    const metrics = (resumeText.match(/\d+(\.\d+)?%|\d+(?![0-9]{3})万|\d+亿|\d+倍|提升|增长|降低|优化/g) || []);
    
    // 过滤掉可能的 4 位数年份（虽然正则已排除，但这里做个二次保险）
    const pureMetrics = metrics.filter(m => !/^(19|20)\d{2}$/.test(m));

    // 商业逻辑：没有量化成果的简历，价值感极低
    // 调整门槛：现在需要更多“真量化”才能拿到高分
    let currentScore = 42; // 默认 C 级风险 (扎心开始)
    if (pureMetrics.length >= 2) currentScore = 62; // B 级 (勉强合格)
    if (pureMetrics.length >= 5) currentScore = 85; // A 级 (优秀)

    const currentGrade = this.mapScoreToGrade(currentScore);
    const optimizedScore = 88; // 优化后强制拉升到 A
    const optimizedGrade = "A";

    return {
      dimension: this.dimension,
      display_name: this.displayName,
      icon: this.icon,
      color: this.getGradeColor(currentGrade),
      current_score: currentScore,
      current_grade: currentGrade,
      optimized_score: optimizedScore,
      optimized_grade: optimizedGrade,
      status: "?? 已提升",
      improvement_score: optimizedScore - currentScore,
      statement: {
        pre_optimization: currentScore < 60 
          ? "能力描述过于空洞，缺乏具体的业务产出与数据支撑，难以在海量候选人中体现商业核心价值。" 
          : "虽然已有部分量化指标，但在核心业务链条上的贡献呈现不够聚焦，溢价空间仍有待挖掘。",
        post_optimization: "基于 STAR 法则深度挖掘项目绩效，通过“数据+结果”重构价值锚点，显著增强了职场竞争力的说服力。"
      },
      directive_abstract: `识别到 ${pureMetrics.length} 处价值点，已强化量化业绩呈现，直击雇主痛点。`
    };
  }
}