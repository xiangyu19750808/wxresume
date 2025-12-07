export function extractKeywords(text: string): string[] {
  // Extract keywords from text
  return text ? text.split(/\s+/) : [];
}
