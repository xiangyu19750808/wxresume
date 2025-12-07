const STOP_WORDS = new Set(['的', '和', '与', '及', '在', '了', 'for', 'to', 'the', 'a', 'an']);

export function extractKeywords(text: string): string[] {
  if (!text) return [];
  const tokens = text
    .toLowerCase()
    .match(/\p{L}[\p{L}\d+_-]*/gu)
    ?.map((t) => t.trim())
    .filter(Boolean) || [];

  const counts = new Map<string, number>();
  for (const token of tokens) {
    if (STOP_WORDS.has(token)) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  const sorted = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([token]) => token);

  return sorted.slice(0, 50);
}

export function countKeywordFrequency(text: string, keywords: string[]): Record<string, number> {
  const frequency: Record<string, number> = {};
  if (!text || !keywords?.length) return frequency;
  const lowered = text.toLowerCase();
  keywords.forEach((kw) => {
    if (!kw) return;
    const pattern = new RegExp(`\\b${escapeRegExp(kw.toLowerCase())}\\b`, 'g');
    const matches = lowered.match(pattern);
    frequency[kw] = matches ? matches.length : 0;
  });
  return frequency;
}

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
