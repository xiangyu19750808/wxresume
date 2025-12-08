function gradeFromScore(score) {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "D";
}

function buildAdvice(dimension, score) {
  if (score >= 85) {
    return dimension + "表现优秀，保持当前的描述深度和案例。";
  }

  if (score >= 70) {
    return dimension + "基础良好，可补充更多与岗位相关的成果和数据。";
  }

  return dimension + "需要重点完善，结合JD补充匹配关键词和量化成果。";
}

// 导入ATS服务
import { AtsService } from "../../resume/services/ats.service.js";

export class DiagnoseService {
  async runDiagnose(resumeText, jdText) {
    // 对于ATS兼容性，使用真正的ATS服务计算
    const atsService = new AtsService();
    const atsResult = await atsService.apply(resumeText);
    
    // 直接使用ATS服务返回的完整结构
    const atsCompatibility = atsResult.atsCompatibility;

    // 其他维度暂时保持原有逻辑（硬编码），后续可以逐个替换为真实计算
    const otherDimensions = {
      hard_requirements: {
        dimension: "hard_requirements",
        display_name: "硬性要求匹配",
        icon: "🎯",
        color: "#faad14",
        current_score: 70,
        current_grade: "B",
        optimized_score: 85,
        optimized_grade: "A",
        status: "🔄 可提升",
        improvement_score: 15,
        statement: {
          pre_optimization: "已达到基本要求，但尚未提供超出预期的、令人印象深刻的资质证明。",
          post_optimization: "通过补充项目复杂度证明，已将关键要求匹配提升至良好水平。"
        },
        directive_abstract: "弥合了经验差距，补充了等效认证证明。"
      },
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

    // 组合所有维度的结果
    return {
      ats_compatibility: atsCompatibility,
      ...otherDimensions
    };
  }
}
