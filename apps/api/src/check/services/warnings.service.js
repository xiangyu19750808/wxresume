import { normalizeText } from '../utils/text-utils.js';

export class WarningsService {
  async generateWarnings(resumeText, jdText) {
    const warnings = [];
    const resume = normalizeText(resumeText);
    const jd = normalizeText(jdText);

    if (!/(电话|mobile|\b1[3-9]\d{9}\b)/.test(resume)) {
      warnings.push('简历缺少联系方式');
    }
    if (!/(教育|学历|本科|硕士|大学)/.test(resume)) {
      warnings.push('简历缺少教育经历');
    }
    if (!/(工作|经历|公司|实习)/.test(resume)) {
      warnings.push('简历缺少工作/项目经历');
    }
    if (jd.length < 50) {
      warnings.push('JD 内容略空洞：长度不足');
    }

    return { warnings };
  }
}
