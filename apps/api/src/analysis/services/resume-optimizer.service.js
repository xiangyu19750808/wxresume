import { LLMClient } from '../deep-engine/llm-client.js';

export class ResumeOptimizerEngine {
  constructor() {
    this.client = new LLMClient();
  }

  async optimize(resumeText, jdText, auditReport) {
    console.log("??? 正在执行整容级重写 (JSON模式)...");

    const instructions = auditReport.dimensions
      .map(d => `${d.name}: ${d.surgical_instruction}`)
      .join('\n');

    const prompt = `
      你是一位拥有“文字整容术”的首席猎头。请根据[审计指令]对[原始简历]进行改写，使其完美匹配[目标JD]。
      
      --- 审计指令 ---
      ${instructions}
      
      --- 原始简历 ---
      ${resumeText}
      
      --- 目标JD ---
      ${jdText}

      请输出一个 JSON 对象，包含以下字段：
      1. "summary": 针对JD重写的极具杀伤力的个人总结（150字以内）。
      2. "core_highlights": 提取3个最匹配JD的硬核战绩。
      3. "experience_rewrite": 对原始工作经历的重构描述（使用STAR法则）。
      4. "full_resume_markdown": 优化后的完整简历文本（Markdown格式）。

      必须以 JSON 格式输出，确保包含 "json" 关键字。
    `;

    return await this.client.ask(prompt, "你是一个擅长通过文字重构让候选人价值翻倍的简历施工专家。");
  }
}