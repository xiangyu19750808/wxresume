export interface ParsedJD {
  rawText: string;
  degreeRequired: string | null;
  experienceYears: number | null;
  certificates: string[];
  mustHaveSkills: string[];
  jdKeywords: string[];
  jdResponsibilities: string[];
  qualityScore: 'A' | 'B' | 'C' | 'D';
  warnings: string[];
}

const DEGREE_PRIORITY = ['博士', '研究生', '硕士', '本科', '大专'];

function normalizeDegree(token: string) {
  if (!token) return null;
  if (token.includes('博士')) return '博士';
  if (token.includes('研究生')) return '研究生';
  if (token.includes('硕士')) return '硕士';
  if (token.includes('本科')) return '本科';
  if (token.includes('大专')) return '大专';
  return token;
}

function pickDegree(text: string): string | null {
  const matches = Array.from(text.matchAll(/(博士|研究生|硕士|本科(?:及以上)?|大专)/g)).map((m) => m[1]);
  const hardMatches = matches.filter((m) => {
    const start = text.indexOf(m);
    const snippet = text.slice(Math.max(0, start - 4), start + m.length + 4);
    return !snippet.includes('优先');
  });
  const candidates = hardMatches.length ? hardMatches : matches;
  if (!candidates.length) return null;
  const normalized = candidates.map(normalizeDegree);
  const sorted = normalized.sort((a, b) => DEGREE_PRIORITY.indexOf(a) - DEGREE_PRIORITY.indexOf(b));
  return sorted[0] ?? null;
}

function pickExperienceYears(text: string): number | null {
  const matches = Array.from(text.matchAll(/(\d+)\s*年(?:及以上)?(?:工作)?经验/g)).map((m) => Number(m[1]));
  if (!matches.length) return null;
  return Math.max(...matches);
}

function extractCertificates(text: string): string[] {
  const results = new Set<string>();
  const regex = /(持有|具有|有)?([^。；;，,\n]*?(?:证书|资格证|认证))[，。,；;\n ]*(?:优先|必须)?/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const name = match[2]?.trim();
    if (name) results.add(name);
  }
  return Array.from(results);
}

function extractMustHaveSkills(text: string): string[] {
  const skills = new Set<string>();
  const pattern = /(必须|精通|熟练掌握|需要熟悉|至少熟悉|需要掌握)[^。；;\n]*?([A-Za-z0-9+#\/\.\u4e00-\u9fa5,，、\s]+?)(?:。|；|;|\n|$)/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const list = match[2]
      .split(/[,，、]/)
      .map((s) => s.trim())
      .filter(Boolean);
    list.forEach((item) => skills.add(item));
  }
  return Array.from(skills);
}

const DEFAULT_KEYWORDS = [
  'Java',
  'Spring',
  'Spring Boot',
  'Spring Cloud',
  'MySQL',
  'PostgreSQL',
  'Redis',
  'Kafka',
  'K8s',
  'Docker',
  'Node.js',
  'TypeScript',
  'Python',
  '数据分析',
  '财务',
  '供应链',
  '测试',
  '自动化',
  '前端',
  '后端',
];

function extractKeywords(text: string): string[] {
  const found = new Set<string>();
  DEFAULT_KEYWORDS.forEach((kw) => {
    if (text.toLowerCase().includes(kw.toLowerCase())) {
      found.add(kw);
    }
  });
  return Array.from(found);
}

function extractResponsibilities(text: string): string[] {
  const lines = text
    .split(/\n|\r/)
    .map((line) => line.trim())
    .filter(Boolean);
  const responsibilities: string[] = [];
  for (const line of lines) {
    const normalized = line.replace(/^[-•\d.\)]\s*/, '').trim();
    if (normalized.length < 6) continue;
    responsibilities.push(normalized);
  }
  return responsibilities;
}

function scoreQuality(text: string, keywordCount: number, responsibilities: string[]): {
  score: 'A' | 'B' | 'C' | 'D';
  warnings: string[];
} {
  const warnings: string[] = [];
  const length = text.trim().length;

  if (length < 30) warnings.push('JD 字数过短：不足 30 字');
  if (keywordCount < 3) warnings.push('JD 内容过于空洞：技术词少于 3 个');

  let score: 'A' | 'B' | 'C' | 'D' = 'D';
  if (length >= 200 && keywordCount >= 5 && responsibilities.length >= 2) score = 'A';
  else if (length >= 100 && keywordCount >= 3) score = 'B';
  else if (length >= 50) score = 'C';
  else score = 'D';

  if (/应届生/.test(text) && /(\d+)\s*年/.test(text)) {
    warnings.push('要求存在矛盾：同时包含“应届生”和“年限经验”');
  }

  return { score, warnings };
}

export function parseJD(rawText: string): ParsedJD {
  const text = String(rawText || '').trim();

  const degreeRequired = pickDegree(text);
  const experienceYears = pickExperienceYears(text);
  const certificates = extractCertificates(text);
  const mustHaveSkills = extractMustHaveSkills(text);
  const jdKeywords = extractKeywords(text);
  const jdResponsibilities = extractResponsibilities(text);
  const { score: qualityScore, warnings } = scoreQuality(text, jdKeywords.length, jdResponsibilities);

  return {
    rawText: text,
    degreeRequired,
    experienceYears,
    certificates,
    mustHaveSkills,
    jdKeywords,
    jdResponsibilities,
    qualityScore,
    warnings,
  };
}

export class JdParser {
  parse(jdText: string): ParsedJD {
    return parseJD(jdText);
  }
}
