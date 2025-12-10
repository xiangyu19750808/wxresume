import { DiagnoseService } from '../services/diagnose.service.js';

export class DiagnoseController {
  constructor() {
    this.diagnoseService = new DiagnoseService();
    this.handleDiagnose = this.handleDiagnose.bind(this);
  }

  async handleDiagnose(req, res) {
    try {
      console.log('诊断请求收到');
      const { resumeText, jdText } = req.body || {};
      console.log('简历文本长度:', (resumeText || '').length);
      console.log('JD文本长度:', (jdText || '').length);
      
      const result = await this.diagnoseService.diagnose(
        resumeText || '',
        jdText || ''
      );
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('诊断错误:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}
