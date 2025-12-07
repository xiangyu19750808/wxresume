import { normalizeText } from '../utils/text-utils.js';

export function scoreJDQuality(jdQuality) {
  return jdQuality || 'C';
}

export function scoreResumeQuality(resumeText) {
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
