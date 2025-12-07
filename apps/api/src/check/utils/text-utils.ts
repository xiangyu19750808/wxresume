export function normalizeText(text: string): string {
  // Normalize text for screening comparisons
  return text || '';
}

export function tokenize(text: string): string[] {
  // Tokenize text into keywords
  return text ? text.split(/\s+/) : [];
}
