import { DiagnoseService } from '../services/diagnose.service.js';

export class DiagnoseController {
  constructor() {
    this.diagnoseService = new DiagnoseService();
    this.handleDiagnose = this.handleDiagnose.bind(this);
  }

  async handleDiagnose(req, res) {
    const { resumeText = '', jdText = '' } = req.body || {};
    const result = await this.diagnoseService.runDiagnose(resumeText, jdText);
    res.json({ status: 'success', data: result });
  }
}
