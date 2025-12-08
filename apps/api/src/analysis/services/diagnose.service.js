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
    console.log("=== DiagnoseService调试信息 ===");
    console.log("收到简历长度:", resumeText?.length || 0);
    console.log("简历内容预览:", resumeText?.substring(0, 100) + "...");
    
    // 对于ATS兼容性，使用真正的ATS服务计算
    try {
      const atsService = new AtsService();
      console.log("正在调用ATS服务...");
      const atsResult = await atsService.apply(resumeText);
      console.log("ATS服务返回结果:", JSON.stringify({
        score: atsResult.atsCompatibility.score,
        grade: atsResult.atsCompatibility.grade,
        advice: atsResult.atsCompatibility.advice
      }, null, 2));
      
      // 其他维度暂时保持原有逻辑（硬编码），后续可以逐个替换为真实计算
      const baseScores = {
        ats_compatibility: atsResult.atsCompatibility.score, // 使用真实计算的ATS分数
        hard_requirements: 70,
        keyword_ranking: 75,
        skills_matching: 60,
        core_abilities: 85,
        risk_control: 65,
        education_background: 90,
        soft_skills_matching: 70,
        semantic_matching: 75,
      };

      console.log("最终返回的ATS分数:", baseScores.ats_compatibility);
      
      return Object.entries(baseScores).reduce((acc, [dimension, score]) => {
        const grade = gradeFromScore(score);

        // 对于ATS，使用真实建议
        let advice;
        if (dimension === "ats_compatibility") {
          advice = atsResult.atsCompatibility.advice;
        } else {
          advice = buildAdvice(dimension, score);
        }

        acc[dimension] = {
          score,
          grade,
          advice,
        };
        return acc;
      }, {});
    } catch (error) {
      console.error("ATS服务调用失败:", error);
      console.error("错误堆栈:", error.stack);
      // 如果ATS服务失败，返回默认值
      const baseScores = {
        ats_compatibility: 100, // 默认值
        hard_requirements: 70,
        keyword_ranking: 75,
        skills_matching: 60,
        core_abilities: 85,
        risk_control: 65,
        education_background: 90,
        soft_skills_matching: 70,
        semantic_matching: 75,
      };
      
      return Object.entries(baseScores).reduce((acc, [dimension, score]) => {
        const grade = gradeFromScore(score);
        acc[dimension] = {
          score,
          grade,
          advice: buildAdvice(dimension, score),
        };
        return acc;
      }, {});
    }
  }
}
