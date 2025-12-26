import { LLMClient } from './llm-client.js';

export class SemanticExtractor {
  constructor() {
    this.client = new LLMClient();
  }

  async extract(resumeText, jdText) {
    const prompt = `
      请对以下简历和JD进行深度语义分析，并以JSON格式输出：
      ---简历内容---
      ${resumeText}
      ---JD内容---
      ${jdText}
      
      请输出以下字段：
      1. user_portrait: { technical_level: 职级判定, core_skills: [核心技术], strengths: [核心卖点], weaknesses: [简历上的坑] }
      2. jd_skeleton: { hard_limits: [硬性死要求], soft_skills: [加分软素质], hidden_needs: "读出的潜台词" }
      3. gap_matrix: { missing_keywords: [JD有但简历无的词], risk_areas: [需要重点整容的模块] }
    `;

    return await this.client.ask(prompt, "你是一个拥有15年经验的顶级HR专家");
  }
}