function gradeFromScore(score) {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

function buildAdvice(dimension, score) {
  if (score >= 85) {
    return `${dimension}表现优秀，保持当前的描述深度和案例。`;
  }

  if (score >= 70) {
    return `${dimension}基础良好，可补充更多与岗位相关的成果和数据。`;
  }

  return `${dimension}需要重点完善，结合JD补充匹配关键词和量化成果。`;
}

export class DiagnoseService {
  async runDiagnose(_resumeText, _jdText) {
    const baseScores = {
      ats_compatibility: 80,
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
