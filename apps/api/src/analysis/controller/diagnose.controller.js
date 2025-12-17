import { DiagnoseService } from '../services/diagnose.service.js';

export class DiagnoseController {
  constructor() {
    this.diagnoseService = new DiagnoseService();
    this.handleDiagnose = this.handleDiagnose.bind(this);
  }

  async handleDiagnose(req, res) {
    try {
      const { resumeText = '', jdText = '' } = req.body || {};

      // ✅ 这里按你当前 DiagnoseService 的方法名：diagnose
      const result = await this.diagnoseService.diagnose(resumeText, jdText);

      const gs = result?.overview?.grade_summary || {};
      const current_score = result?.overview?.final_score ?? null;

      // ✅ dims：兼容 object / array
      const dims = Array.isArray(result?.dimensions)
        ? result.dimensions
        : Object.values(result?.dimensions || {});

      // ✅ 第3步+第4步：optimized_* → preview_*；statement 统一对象；A/S pre_optimization 置空
      const mapToPreview = (d) => {
        if (!d) return d;

        const { optimized_score, optimized_grade, statement, ...rest } = d;
        const current_grade = rest.current_grade; // 保留 current_grade 给前端用

        let normalizedStatement = statement;

        if (typeof statement === 'string') {
          const isAS = current_grade === 'A' || current_grade === 'S';
          normalizedStatement = {
            pre_optimization: isAS ? null : statement,
            post_optimization: statement,
          };
        } else if (statement && typeof statement === 'object') {
          const isAS = current_grade === 'A' || current_grade === 'S';
          normalizedStatement = {
            pre_optimization: isAS ? null : (statement.pre_optimization ?? null),
            post_optimization: statement.post_optimization ?? null,
          };
        }

        if (!normalizedStatement) {
          normalizedStatement = { pre_optimization: null, post_optimization: null };
        }

        return {
          ...rest, // ✅ 保留 current_grade / current_score 等原字段
          statement: normalizedStatement,
          preview_score: optimized_score ?? null,
          preview_grade: optimized_grade ?? null,
        };
      };

      // ✅ preview_score：从 optimized_score（或 current_score）算最大值
      const preview_score =
        dims.length > 0
          ? Math.max(...dims.map((d) => d?.optimized_score ?? d?.current_score ?? 0))
          : null;

      res.json({
        code: 0,
        msg: 'ok',
        data: {
          overview: {
            current_score,
            preview_score,
            preview_grade: null,
            d_count: gs.D || 0,
            c_count: gs.C || 0,
            b_count: gs.B || 0,
            a_count: gs.A || 0,
            s_count: gs.S || 0,
            dimension_count: result?.overview?.dimension_count ?? dims.length,
            estimated_improvement: result?.overview?.estimated_improvement ?? null,
            has_critical_issues: result?.overview?.has_critical_issues ?? false,
          },

          // ✅ dimensions：数组 + preview_* 映射（不再暴露 optimized_*）
          dimensions: dims.map(mapToPreview),

          // ✅ 第6步：deliverable（支付后才有）
          deliverable: {
            resume_pdf: null,
            resume_docx: null,
            download_url: null,
          },
        },
      });
    } catch (error) {
      console.error('DiagnoseController.handleDiagnose错误:', error);
      res.status(500).json({
        code: 500,
        msg: 'diagnose_failed',
        error: error?.message || 'unknown_error',
      });
    }
  }
}
