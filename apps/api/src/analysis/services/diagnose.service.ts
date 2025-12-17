// apps/api/src/analysis/services/diagnose.service.ts

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface DiagnoseStatement {
  pre_optimization: string | null;
  post_optimization: string | null;
}

export interface DiagnoseDimensionResult {
  dimension: string;
  current_score: number;
  current_grade: Grade;
  optimized_score: number; // ⚠️ 仅供 controller 映射 preview_*，service 不改名
  optimized_grade: Grade;
  improvement_score: number;
  statement: DiagnoseStatement;
}

export interface DiagnoseServiceResult {
  overview: {
    final_score: number;
    grade_summary: Record<Grade, number>;
    dimension_count: number;
    estimated_improvement: string;
    has_critical_issues: boolean;
  };
  dimensions: Record<string, DiagnoseDimensionResult>;
}

/* ------------------ 内部工具函数 ------------------ */

function gradeFromScore(score: number): Grade {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

function buildStatement(
  dimension: string,
  score: number
): DiagnoseStatement {
  if (score >= 80) {
    return {
      pre_optimization: null,
      post_optimization: `${dimension}表现优秀，整体已达到岗位期望水准。`,
    };
  }

  if (score >= 70) {
    return {
      pre_optimization: `${dimension}基础尚可，但仍有进一步优化空间。`,
      post_optimization: `通过补充关键要点，${dimension}可达到更高匹配度。`,
    };
  }

  return {
    pre_optimization: `${dimension}当前存在明显短板，需要重点优化。`,
    post_optimization: `完成针对性优化后，${dimension}可显著改善。`,
  };
}

/* ------------------ 主 Service ------------------ */

export class DiagnoseService {
  async runDiagnose(
    _resumeText: string,
    _jdText: string
  ): Promise<DiagnoseServiceResult> {

    // ⚠️ 当前为示例规则分数（后续可替换为真实算法）
    const baseScores: Record<string, number> = {
      ats_compatibility: 80,
      hard_requirements: 70,
      keyword_density: 6,
      skill_match: 70,
      core_ability: 75,
      career_risk: 85,
      education_match: 60,
      function_match: 55,
      semantic_match: 61,
    };

    const dimensions: Record<string, DiagnoseDimensionResult> = {};
    const gradeSummary: Record<Grade, number> = {
      S: 0,
      A: 0,
      B: 0,
      C: 0,
      D: 0,
    };

    Object.entries(baseScores).forEach(([dimension, score]) => {
      const grade = gradeFromScore(score);

      gradeSummary[grade] += 1;

      dimensions[dimension] = {
        dimension,
        current_score: score,
        current_grade: grade,
        optimized_score: Math.min(score + 15, 100), // 示例：优化后分
        optimized_grade: gradeFromScore(Math.min(score + 15, 100)),
        improvement_score: Math.max(0, Math.min(100 - score, 15)),
        statement: buildStatement(dimension, score),
      };
    });

    const finalScore =
      Math.round(
        Object.values(baseScores).reduce((a, b) => a + b, 0) /
          Object.keys(baseScores).length
      );

    return {
      overview: {
        final_score: finalScore,
        grade_summary: gradeSummary,
        dimension_count: Object.keys(dimensions).length,
        estimated_improvement: '面试率+30%',
        has_critical_issues: gradeSummary.D > 0,
      },
      dimensions,
    };
  }
}
