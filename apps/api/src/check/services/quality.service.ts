import { normalizeText } from '../utils/text-utils.js';

export function scoreJDQuality(jdQuality: 'A' | 'B' | 'C' | 'D' | undefined): 'A' | 'B' | 'C' | 'D' {
  return jdQuality || 'C';
}

export function scoreResumeQuality(resumeText: string): 'A' | 'B' | 'C' | 'D' {
  const text = normalizeText(resumeText);
  const length = text.length;
  const hasContact = /(邮箱|email|@)/i.test(text) && /(电话|mobile|\b1[3-9]\d{9}\b)/.test(text);
  const hasEducation = /(教育|学历|本科|硕士|大学)/.test(text);
  const hasWork = /(工作|经历|公司|实习)/.test(text);

  if (length > 800 && hasContact && hasEducation && hasWork) return 'A';
  if (length > 400 && hasEducation && hasWork) return 'B';
  if (length > 100) return 'C';
  return 'D';
}

export class QualityService {
  async scoreQuality(resumeText: string): Promise<number> {
    const quality = scoreResumeQuality(resumeText);
    return ['D', 'C', 'B', 'A'].indexOf(quality) + 1;
  }
}
