import { BaseDimensionService } from './base-dimension.service.js';

export class ProjectDepthService extends BaseDimensionService {
  constructor() {
    super({
      dimension: "project_depth",
      displayName: "项目深度分析",
      icon: "???",
      priority: "P2"
    });
  }

  async analyze(resumeText = "", jdText = "") {
    const keywords = ['架构', '底层', '高并发', '优化', '重构', '自研', '分布式', '算法'];
    const hits = keywords.filter(k => resumeText.includes(k)).length;

    // 逻辑：没写深度词汇的，判为“可替代性强”
    let currentScore = 42; 
    if (hits >= 2) currentScore = 68;
    if (hits >= 4) currentScore = 85;

    const currentGrade = this.mapScoreToGrade(currentScore);
    const optimizedScore = 88;
    const optimizedGrade = "A";

    return {
      dimension: this.dimension,
      display_name: this.displayName,
      icon: this.icon,
      current_score: currentScore,
      current_grade: currentGrade,
      optimized_score: optimizedScore,
      optimized_grade: optimizedGrade,
      status: "?? 已解决",
      improvement_score: optimizedScore - currentScore,
      statement: {
        pre_optimization: "项目描述多停留在业务流程层面，缺乏底层架构与技术难点的深度拆解，护城河不足。",
        post_optimization: "深度还原了项目核心架构，突出了高并发/高性能场景下的解决方案，建立专家形象。"
      },
      directive_abstract: `补充了${hits < 2 ? '关键技术栈深度' : '核心攻关细节'}，使项目经验具备极高的溢价竞争力。`
    };
  }
}