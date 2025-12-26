import axios from 'axios';

export class LLMClient {
  constructor() {
    this.apiKey = 'sk-f1606a970c834cc2b47c452ce379536a'; 
    // 坑点修复：确保 URL 干净，不带多余斜杠
    this.endpoint = 'https://api.deepseek.com/chat/completions'; 
  }

  async ask(prompt, systemRole = "你是一位资深技术专家和首席猎头") {
    try {
      const response = await axios.post(this.endpoint, {
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemRole },
          { role: "user", content: prompt }
        ],
        // 关键：强制返回 JSON
        response_format: { type: "json_object" } 
      }, {
        headers: { 
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 增加超时保护，简历分析比较耗时
      });
      
      const content = response.data.choices[0].message.content;
      
      // 容错处理：确保 content 存在再解析
      if (!content) {
        throw new Error("AI 返回内容为空");
      }

      return JSON.parse(content);
    } catch (error) {
      // 打印更详细的错误，方便你在 Linux 终端排查
      console.error("? LLM 调用失败:", error.response?.data || error.message);
      return null;
    }
  }
}