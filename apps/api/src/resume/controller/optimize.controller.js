import { OptimizeService } from '../services/optimize.service.js';

const optimizeService = new OptimizeService();

export class OptimizeController {
  async handleOptimize(req, res) {
    try {
      const { resumeText, jdText, companyType = 'balanced' } = req.body || {};

      if (!resumeText || !jdText) {
        return res.status(400).json({ code: 1, msg: 'resumeText and jdText required' });
      }

      const result = await optimizeService.optimize(String(resumeText), String(jdText), companyType);
      return res.json({ code: 0, data: result });
    } catch (err) {
      const msg = err?.message || 'internal_error';
      console.error('[resume.optimize] failed', err);
      return res.status(500).json({ code: 1, msg });
    }
  }
}
