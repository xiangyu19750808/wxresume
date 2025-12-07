export function sanitizeText(text: string): string {
  // General purpose text sanitizer
  return text || '';
}

export function splitSentences(text: string): string[] {
  // Split text into sentences for downstream processing
  return text ? text.split(/(?<=[.!?])\s+/) : [];
}
