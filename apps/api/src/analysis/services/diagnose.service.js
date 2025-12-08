// 导入ATS服务
import { AtsService } from "../../resume/services/ats.service.js";
// 导入硬性要求服务
import { HardRequirementService } from "./hard-requirement.service.js";

export class DiagnoseService {
  constructor() {
    this.atsService = new AtsService();
    this.hardRequirementService = new HardRequirementService();
  }

  async runDiagnose(resumeText, jdText) {
    console.log("=== DiagnoseService开始九维分析 ===");
    
    try {
      // 1. ATS兼容性（使用现有的ATS服务）
      const atsResult = await this.atsService.apply(resumeText);
      
      // 2. 硬性要求匹配（使用新的服务）
      const hardRequirementResult = await this.hardRequirementService.analyze(resumeText, jdText);
      
      // 3. 其他维度暂时保持模拟数据
      const otherDimensions = {
        keyword_ranking: {
          dimension: "keyword_ranking",
          display_name: "关键词排名",
          icon: "🔍",
          color: "#faad14",
          current_score: 75,
          current_grade: "B",
          optimized_score: 88,
          optimized_grade: "A",
          status: "🔄 可提升",
          improvement_score: 13,
          statement: {
            pre_optimization: "可通过系统基础筛选，但未在关键词排名竞争中占据有利位置以获得额外关注。",
            post_optimization: "通过优化关键词密度与分布，已将检索排名提升至良好水平。"
          },
          directive_abstract: "提升了核心关键词密度与合理分布。"
        },
        skills_matching: {
          dimension: "skills_matching",
          display_name: "技能匹配度",
          icon: "🛠️",
          color: "#fa8c16",
          current_score: 60,
          current_grade: "C",
          optimized_score: 78,
          optimized_grade: "B",
          status: "🔓 可解决",
          improvement_score: 18,
          statement: {
            pre_optimization: "技能描述较为宽泛或缺乏重点，较难在快速筛选中建立起清晰的专业形象。",
            post_optimization: "通过细化技能描述与补充案例，已将技能匹配度提升至合格水平。"
          },
          directive_abstract: "细化了技能描述，补充了应用场景案例。"
        },
        core_abilities: {
          dimension: "core_abilities",
          display_name: "核心能力呈现",
          icon: "💪",
          color: "#1890ff",
          current_score: 85,
          current_grade: "A",
          optimized_score: 92,
          optimized_grade: "S",
          status: "🔄 可提升",
          improvement_score: 7,
          statement: {
            pre_optimization: "能力描述完整，但尚未形成强烈的个人品牌差异化，难以让人过目不忘。",
            post_optimization: "通过量化成就与故事化案例，已将核心能力呈现优化至优秀水平。"
          },
          directive_abstract: "量化了关键成就，增强了案例故事性。"
        },
        risk_control: {
          dimension: "risk_control",
          display_name: "职业风险控制",
          icon: "🛡️",
          color: "#fa8c16",
          current_score: 65,
          current_grade: "C",
          optimized_score: 82,
          optimized_grade: "A",
          status: "🔓 可解决",
          improvement_score: 17,
          statement: {
            pre_optimization: "职业转换或发展的逻辑不够清晰，HR可能需要额外求证您的职业规划合理性。",
            post_optimization: "通过重构职业发展叙事，已将风险点转化为积极的成长故事。"
          },
          directive_abstract: "重构了职业发展逻辑，解释了关键转换节点。"
        },
        education_background: {
          dimension: "education_background",
          display_name: "教育背景匹配",
          icon: "🎓",
          color: "#52c41a",
          current_score: 90,
          current_grade: "S",
          optimized_score: 95,
          optimized_grade: "S",
          status: "✨ 已优秀",
          improvement_score: 5,
          statement: {
            pre_optimization: "教育背景匹配表现优秀，保持当前的描述深度和案例。",
            post_optimization: "教育背景已达到优秀标准，关联优势充分展现。"
          },
          directive_abstract: "教育背景优秀，无需额外优化。"
        },
        soft_skills_matching: {
          dimension: "soft_skills_matching",
          display_name: "全维度职能匹配",
          icon: "🤝",
          color: "#faad14",
          current_score: 70,
          current_grade: "B",
          optimized_score: 83,
          optimized_grade: "A",
          status: "🔄 可提升",
          improvement_score: 13,
          statement: {
            pre_optimization: "职能要求基本覆盖，但未主动展现您对团队未来发展的潜在贡献与价值。",
            post_optimization: "通过补充团队协作与领导力案例，已将软技能匹配提升至良好水平。"
          },
          directive_abstract: "补充了团队协作与跨职能合作案例。"
        },
        semantic_matching: {
          dimension: "semantic_matching",
          display_name: "语义匹配契合度",
          icon: "🧩",
          color: "#faad14",
          current_score: 75,
          current_grade: "B",
          optimized_score: 86,
          optimized_grade: "A",
          status: "🔄 可提升",
          improvement_score: 11,
          statement: {
            pre_optimization: "语义通顺合理，但尚未传递出与团队文化或公司价值观的深度共鸣与契合感。",
            post_optimization: "通过调整叙事逻辑与价值观表达，已将语义契合度提升至良好水平。"
          },
          directive_abstract: "优化了叙事逻辑，增强了价值观表达一致性。"
        }
      };

      // 组合所有结果
      return {
        ats_compatibility: atsResult.atsCompatibility,
        hard_requirements: hardRequirementResult,
        ...otherDimensions
      };

    } catch (error) {
      console.error("九维分析失败:", error);
      throw error;
    }
  }
}
