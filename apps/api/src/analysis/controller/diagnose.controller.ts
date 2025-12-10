import { DiagnoseService } from '../services/diagnose.service.js';

export class DiagnoseController {
  constructor() {
    this.diagnoseService = new DiagnoseService();
    this.handleDiagnose = this.handleDiagnose.bind(this);
  }

  async handleDiagnose(req, res) {
    try {
      // 简单处理，直接返回成功
      const { resumeText, jdText } = req.body || {};
      
      console.log("收到诊断请求:", { 
        resumeLength: resumeText?.length,
        jdLength: jdText?.length 
      });
      
      // 调用九维分析服务
      const result = await this.diagnoseService.diagnose(
        resumeText || "",
        jdText || ""
      );
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error("诊断错误:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}