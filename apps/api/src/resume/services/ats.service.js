function normalizeBullets(text) {
  return text.replace(/[•·●]/g, '-');
}

export class AtsService {
  async apply(resumeText) {
    let optimized = normalizeBullets(resumeText)
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n');

    const changes = [];

    if (optimized !== resumeText) {
      changes.push({
        module: 'ATS',
        type: 'format',
        priority: 'high',
        description: '统一项目符号与行距，提升 ATS 解析兼容性',
        reason: '减少异常符号或多余空行导致的解析失败',
        impact: 'ats_compatibility',
      });
    }

    if (/\t|\u3000/.test(resumeText)) {
      optimized = optimized.replace(/\t|\u3000/g, ' ');
      changes.push({
        module: 'ATS',
        type: 'format',
        priority: 'medium',
        description: '去除制表符/全角空格，保持文本流畅',
        reason: '避免 ATS 误判分栏或表格',
      });
    }

    if (optimized.length > 7000) {
      optimized = optimized.slice(0, 7000);
      changes.push({
        module: 'ATS',
        type: 'length',
        priority: 'medium',
        description: '截断过长文本以保留核心信息',
        reason: '超长简历容易被解析器降权',
        impact: 'readability',
      });
    }

    return {
      optimizedResume: optimized,
      changes,
    };
  }
}
