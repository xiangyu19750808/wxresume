import { normalizeText, tokenize } from '../utils/text-utils.js';

function extractDegree(text) {
  const matches = Array.from(text.matchAll(/(博士|研究生|硕士|本科|大专)/g)).map((m) => m[1]);
  if (!matches.length) return null;
  const order = ['博士', '研究生', '硕士', '本科', '大专'];
  return matches.sort((a, b) => order.indexOf(a) - order.indexOf(b))[0];
}

function extractYears(text) {
  const matches = Array.from(text.matchAll(/(\d+)\s*年/g)).map((m) => Number(m[1]));
  if (!matches.length) return null;
  return Math.max(...matches);
}

function extractCertificates(text) {
  const regex = /([^，。,；;\n]*?(?:证书|资格证|认证))/g;
  const items = new Set();
  let match;
  while ((match = regex.exec(text)) !== null) {
    const name = match[1]?.trim();
    if (name) items.add(name);
  }
  return Array.from(items);
}

export async function calcMatchScore(resumeText, parsedJD) {
  const normalized = normalizeText(resumeText);
  const tokens = new Set(tokenize(normalized).map((t) => t.toLowerCase()));

  const jdKeywords = parsedJD?.jdKeywords || [];
  const mustSkills = parsedJD?.mustHaveSkills || [];

  let keywordHits = 0;
  jdKeywords.forEach((kw) => {
    if (normalized.toLowerCase().includes(kw.toLowerCase())) keywordHits += 1;
  });
  const keywordCoverage = jdKeywords.length ? keywordHits / jdKeywords.length : 0;

  let mustHits = 0;
  mustSkills.forEach((kw) => {
    if (tokens.has(kw.toLowerCase())) mustHits += 1;
  });
  const mustCoverage = mustSkills.length ? mustHits / mustSkills.length : 1;

  const degree = extractDegree(normalized);
  const years = extractYears(normalized);
  const certs = extractCertificates(normalized);

  const hardCheckItems = [];
  if (parsedJD?.degreeRequired) {
    hardCheckItems.push({
      label: '学历要求',
      jdValue: parsedJD.degreeRequired,
      resumeValue: degree || '未提及',
      match: degree && degree.includes(parsedJD.degreeRequired) ? '匹配' : '不匹配',
    });
  }
  if (parsedJD?.experienceYears !== null && parsedJD?.experienceYears !== undefined) {
    const ratio = years ? Math.min(1, years / parsedJD.experienceYears) : 0;
    hardCheckItems.push({
      label: '经验年限',
      jdValue: `${parsedJD.experienceYears} 年`,
      resumeValue: years ? `${years} 年` : '未提及',
      match: years ? `${Math.round(ratio * 100)}%` : '未提及',
    });
  }
  if ((parsedJD?.certificates || []).length) {
    const jdCert = parsedJD.certificates.join(', ');
    const resumeCert = certs.join(', ') || '未提及';
    const matched = parsedJD.certificates.some((item) => resumeCert.includes(item));
    hardCheckItems.push({
      label: '证书要求',
      jdValue: jdCert,
      resumeValue: resumeCert,
      match: matched ? '匹配' : '不匹配',
    });
  }

  const hardMatches = hardCheckItems.map((item) =>
    item.match === '匹配'
      ? 1
      : item.match.endsWith('%')
        ? Math.min(1, Number.parseInt(item.match, 10) / 100)
        : 0
  );
  const hardMatchRatio = hardMatches.length
    ? hardMatches.reduce((a, b) => a + b, 0) / hardMatches.length
    : 1;

  const matchScore = Math.round((keywordCoverage * 0.5 + mustCoverage * 0.3 + hardMatchRatio * 0.2) * 100);

  return { matchScore, hardMatchRatio, hardCheckItems };
}
