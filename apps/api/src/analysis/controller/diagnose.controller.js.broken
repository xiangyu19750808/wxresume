import { DiagnoseService } from '../services/diagnose.service.js';

export class DiagnoseController {
  constructor() {
    this.diagnoseService = new DiagnoseService();
    this.handleDiagnose = this.handleDiagnose.bind(this);
  }

  async handleDiagnose(req, res) {
    try {
      console.log("=== 🛠️ DiagnoseController开始处理 ===");

      const { resumeText, jdText } = req.body;

      // 显示原始接收内容
      console.log("原始resumeText长度:", resumeText?.length);
      console.log("原始jdText长度:", jdText?.length);
      
      // 简单显示前50字符，检查编码
      console.log("resumeText前50字符:", resumeText?.substring(0, 50));
      console.log("jdText前50字符:", jdText?.substring(0, 50));
      
      // 检查是否有问号问题
      if (resumeText) {
        const qCount = (resumeText.match(/\?/g) || []).length;
        console.log(`resumeText问号数: ${qCount}/${resumeText.length} (${((qCount/resumeText.length)*100).toFixed(1)}%)`);
      }

      // 直接使用原始文本（让分析器处理）
      const fixedResumeText = resumeText || '';
      const fixedJdText = jdText || '';

      console.log("处理后resumeText长度:", fixedResumeText.length);
      console.log("处理后jdText长度:", fixedJdText.length);

      // 调用诊断服务
      const result = await this.diagnoseService.diagnose(fixedResumeText, fixedJdText);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('DiagnoseController.handleDiagnose错误:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}


