import { LLMClient } from '../deep-engine/llm-client.js';

export class DeepDiagnoseService {
  constructor() {
    this.client = new LLMClient();
  }

  /**
   * 深度九维诊断
   * @param {string} resumeText 简历原文
   * @param {string} jdText 目标JD
   * @param {Object} portrait 步骤7抽取的画像
   */
  async run(resumeText, jdText, portrait) {
    console.log("?? 正在启动九维深度审计系统...");

    const prompt = `
      你现在是全球顶尖的技术猎头和简历审计专家。
      请基于[用户画像]，对[原始简历]与[目标JD]的匹配度进行九个维度的“穿透式”审计。
      
      --- 用户画像 ---
      ${JSON.stringify(portrait)}
      
      --- 原始简历 ---
      ${resumeText}
      
      --- 目标JD ---
      ${jdText}

      请严格按照以下 JSON 格式输出，不要有任何开场白：
      {
        "dimensions": [
          {
            "name": "维度名称(如:项目深度/硬性要求等)",
            "score": "优化前得分(0-100)",
            "optimized_score": "预期优化后得分(0-100)",
            "audit_evidence": ["发现的具体痛点1", "发现的具体痛点2"],
            "surgical_instruction": "给AI优化引擎的具体手术指令(如:‘强制在第一段引入高并发指标’)",
            "business_value": "该维度对拿下面试的决定性意义"
          }
        ],
        "overall_audit": "总部的审计总结，一句话点出核心死穴"
      }

      注意：九个维度必须全量覆盖：1.硬性要求 2.教育背景 3.项目深度 4.价值主张 5.职业风险 6.技能匹配 7.职能匹配 8.语义匹配 9.ATS兼容。
    `;

    return await this.client.ask(prompt, "你是一个只说真话、视角毒辣的首席审计官");
  }
}