import { normalizeText } from '../utils/text-utils.js';

export class HardRequirementsService {
  async checkRequirements(resumeText, jdText, parsedJD) {
    const resume = normalizeText(resumeText);
    const jd = normalizeText(jdText);

    const warnings = [];
    if (resume.length < 50) {
      warnings.push('简历内容过短');
    }
    if (jd.length < 30) {
      warnings.push('JD 内容过短');
    }

    const shouldStop = resume.length < 50 || jd.length < 30;
    return { shouldStop, warnings, hardCheckItems: [] };
  }
}
