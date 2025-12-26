import { SemanticExtractor } from '../deep-engine/semantic-extractor.js';
// 导入之前写好的 9 维服务（示例导入 2 个）
import { ValuePropositionService } from './value-proposition.service.js';
import { CareerRiskService } from './career-risk.service.js';

export class DeepAnalysisService {
  constructor() {
    this.extractor = new SemanticExtractor();
    this.dimensions = {
      value: new ValuePropositionService(),
      risk: new CareerRiskService()
      // ...其他维度
    };
  }

  async performDeepAnalysis(resumeText, jdText) {
    // 1. 步骤 7：执行 LLM 深层抽取
    console.log("正在执行 LLM 语义抽取...");
    const portrait = await this.extractor.extract(resumeText, jdText);

    // 2. 步骤 8：结合九维规则 + LLM 画像
    const results = {};
    for (const [key, service] of Object.entries(this.dimensions)) {
      const basicResult = await service.analyze(resumeText, jdText);
      
      // 核心差异：根据 LLM 结果给“优化建议”注入灵魂
      results[key] = {
        ...basicResult,
        deep_directive: this._generateDeepDirective(key, basicResult, portrait)
      };
    }

    return {
      portrait,
      dimensions: results,
      overall_strategy: "建议：重点加强高并发场景描述，弱化职业空窗期的文字长度。"
    };
  }

  _generateDeepDirective(dimKey, result, portrait) {
    // 这里的逻辑是：如果规则分低，且 LLM 判定是核心缺失，则发出“强制修复指令”
    if (result.current_score < 60 && portrait.gap_matrix.missing_keywords.length > 0) {
      return `【深度指令】检测到目标岗位急需 ${portrait.jd_skeleton.hard_limits[0]}，已在步骤9中排期注入。`;
    }
    return "保持现状，微调关键词即可。";
  }
}