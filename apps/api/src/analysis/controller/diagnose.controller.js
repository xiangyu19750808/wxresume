import { DiagnoseService } from '../services/diagnose.service.js';

export class DiagnoseController {
  constructor() {
    this.diagnoseService = new DiagnoseService();
    this.handleDiagnose = this.handleDiagnose.bind(this);
  }

  async handleDiagnose(req, res) {
    const { resumeText = '', jdText = '' } = req.body || {};
    
    // 添加调试信息
    console.log("=== DiagnoseController调试 ===");
    console.log("收到的resumeText长度:", resumeText.length);
    console.log("resumeText前50字符:", resumeText.substring(0, 50));
    console.log("字符代码（前5个）:");
    for (let i = 0; i < Math.min(5, resumeText.length); i++) {
      console.log(`  [${i}] '${resumeText[i]}': 0x${resumeText.charCodeAt(i).toString(16)}`);
    }
    
    try {
      const result = await this.diagnoseService.runDiagnose(resumeText, jdText);
      res.json({ status: 'success', data: result });
    } catch (error) {
      console.error('Diagnose处理错误:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
}
