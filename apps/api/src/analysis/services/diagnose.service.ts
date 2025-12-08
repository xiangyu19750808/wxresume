export interface DiagnoseDimensionResult {
  score: number;
  grade: string;
  advice: string;
}

export interface DiagnoseResult {
  ats_compatibility: DiagnoseDimensionResult;
  hard_requirements: DiagnoseDimensionResult;
  keyword_ranking: DiagnoseDimensionResult;
  skills_matching: DiagnoseDimensionResult;
  core_abilities: DiagnoseDimensionResult;
  risk_control: DiagnoseDimensionResult;
  education_background: DiagnoseDimensionResult;
  soft_skills_matching: DiagnoseDimensionResult;
  semantic_matching: DiagnoseDimensionResult;
}

function gradeFromScore(score: number): string {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

function buildAdvice(dimension: string, score: number): string {
  if (score >= 85) {
    return `${dimension}表现优秀，保持当前的描述深度和案例。`;
  }

  if (score >= 70) {
    return `${dimension}基础良好，可补充更多与岗位相关的成果和数据。`;
  }

  return `${dimension}需要重点完善，结合JD补充匹配关键词和量化成果。`;
}

export class DiagnoseService {
  async runDiagnose(_resumeText: string, _jdText: string): Promise<DiagnoseResult> {
    // 当前为规则驱动的示例实现，后续可替换为真实打分逻辑。
    const baseScores: Record<keyof DiagnoseResult, number> = {
      ats_compatibility: 80,
      hard_requirements: 70,
      keyword_ranking: 75,
      skills_matching: 60,
      core_abilities: 85,
      risk_control: 65,
      education_background: 90,
      soft_skills_matching: 70,
      semantic_matching: 75,
    } as const;

    const result = Object.entries(baseScores).reduce((acc, [dimension, score]) => {
      const grade = gradeFromScore(score);
      acc[dimension as keyof DiagnoseResult] = {
        score,
        grade,
        advice: buildAdvice(dimension, score),
      };
      return acc;
    }, {} as DiagnoseResult);

    return result;
  }
}
