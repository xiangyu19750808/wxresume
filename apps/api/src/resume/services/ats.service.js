function normalizeBullets(text) {
  return text.replace(/[•·●]/g, '-');
}

function calculateNonAsciiRatio(text) {
  const meaningfulText = text.replace(/\s+/g, '');
  if (!meaningfulText.length) {
    return 0;
  }
  const nonAsciiCount = (meaningfulText.match(/[^\x00-\x7F]/g) || []).length;
  return nonAsciiCount / meaningfulText.length;
}

function containsTable(text) {
  const htmlTablePattern = /<table[\s\S]*?>[\s\S]*?<\/table>/i;
  const markdownTablePattern = /\|\s*[-:]{2,}[-|\s:]*\|/;
  const boxDrawingPattern = /[┌┬┐└┴┘┼─│]/;
  return (
    htmlTablePattern.test(text) ||
    markdownTablePattern.test(text) ||
    boxDrawingPattern.test(text)
  );
}

function containsExecutableMarkup(text) {
  const scriptPattern = /<script[\s\S]*?>[\s\S]*?<\/script>/i;
  const stylePattern = /<style[\s\S]*?>[\s\S]*?<\/style>/i;
  const iframePattern = /<iframe[\s\S]*?>[\s\S]*?<\/iframe>/i;
  return scriptPattern.test(text) || stylePattern.test(text) || iframePattern.test(text);
}

function mapScoreToGrade(score) {
  if (score >= 95) return 'S';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  return 'D';
}

function deriveConfidence(score, issueCount) {
  const baseConfidence = score / 100;
  const deduction = Math.min(0.6, issueCount * 0.08 + (100 - score) / 250);
  const confidence = Math.max(0.3, Math.min(1, baseConfidence - deduction + 0.2));
  return Number(confidence.toFixed(2));
}

function buildAdvice(issues, grade) {
  if (!issues.length) {
    return '简历格式干净，符合 ATS 要求，可直接投递。';
  }

  const suggestions = issues.map((issue) => issue.suggestion);
  const gradeNotice =
    grade === 'D'
      ? '存在严重格式或编码问题，需立即修复后再投递。'
      : '建议优先处理以上问题以提升 ATS 通过率。';

  return `${suggestions.join('；')}。${gradeNotice}`;
}

function scoreCompatibility(resumeText) {
  const normalized = resumeText ?? '';
  const issues = [];
  const trimmed = jdText.trim();

  if (!trimmed) {
    return issues;
  }

  if (containsTable(normalized)) {
    issues.push({
      penalty: 35,
      description: '检测到表格或分栏结构，可能导致 ATS 解析失败',
      suggestion: '移除表格/分栏，改用标题和项目符号重新排版',
    });
  }

  if (containsExecutableMarkup(normalized)) {
    issues.push({
      penalty: 30,
      description: '存在 script/style/iframe 等特殊标签',
      suggestion: '删除嵌入的脚本或样式标签，仅保留纯文本内容',
    });
  }

  if (/[�]|[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(normalized)) {
    issues.push({
      penalty: 30,
      description: '检测到乱码或控制字符',
      suggestion: '检查文件编码并移除控制字符，导出为 UTF-8 文本或 PDF',
    });
  }

  if (/\t|\u00A0|\u3000/.test(normalized)) {
    issues.push({
      penalty: 10,
      description: '含有制表符或全角空格，可能影响 ATS 读取',
      suggestion: '用普通空格替换制表符/全角空格，保持单栏文本',
    });
  }

  const noisySymbols = text.match(/[^\w\s\u4e00-\u9fa5.,;:()\-]/g) || [];
  return noisySymbols.length / meaningfulLength;
}

function scoreCompatibility(resumeText, jdText = '') {
  const normalizedResume = resumeText ?? '';
  const normalizedJd = jdText ?? '';
  const issues = [];

  if (containsTable(normalizedResume)) {
    issues.push({
      penalty: 35,
      description: '检测到表格或分栏结构，可能导致 ATS 解析失败',
      suggestion: '移除表格/分栏，改用标题和项目符号重新排版',
    });
  }

  if (containsExecutableMarkup(normalizedResume)) {
    issues.push({
      penalty: 30,
      description: '存在 script/style/iframe 等特殊标签',
      suggestion: '删除嵌入的脚本或样式标签，仅保留纯文本内容',
    });
  }

  if (/[�]|[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(normalizedResume)) {
    issues.push({
      penalty: 30,
      description: '检测到乱码或控制字符',
      suggestion: '检查文件编码并移除控制字符，导出为 UTF-8 文本或 PDF',
    });
  }

  if (/\t|\u00A0|\u3000/.test(normalizedResume)) {
    issues.push({
      penalty: 10,
      description: '含有制表符或全角空格，可能影响 ATS 读取',
      suggestion: '用普通空格替换制表符/全角空格，保持单栏文本',
    });
  }

  const nonAsciiRatio = calculateNonAsciiRatio(normalizedResume);
  if (nonAsciiRatio > 0.6) {
    issues.push({
      penalty: 25,
      description: '中文或非 ASCII 字符占比过高，存在编码兼容风险',
      suggestion: '减少特殊符号与稀有字符，保持主要内容为标准 ASCII 文本',
    });
  }

  issues.push(...evaluateJobDescription(normalizedJd));

  const totalPenalty = issues.reduce((sum, issue) => sum + issue.penalty, 0);
  const score = Math.max(0, Math.min(100, Math.round(100 - totalPenalty)));
  const grade = mapScoreToGrade(score);
  const advice = buildAdvice(issues, grade);
  const confidence = deriveConfidence(score, issues.length);

  return { score, grade, advice, confidence };
}

export class AtsService {
  async apply(resumeText, jdText = '') {
    const originalText = resumeText ?? '';
    let optimized = normalizeBullets(originalText)
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n');

    const changes = [];

    if (optimized !== originalText) {
      changes.push({
        module: 'ATS',
        type: 'format',
        priority: 'high',
        description: '统一项目符号与行距，提升 ATS 解析兼容性',
        reason: '减少异常符号或多余空行导致的解析失败',
        impact: 'ats_compatibility',
      });
    }

    if (/\t|\u3000/.test(originalText)) {
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

    const atsCompatibility = scoreCompatibility(originalText, jdText);

    return {
      optimizedResume: optimized,
      changes,
      atsCompatibility,
    };
  }
}
