export function normalizeResumeText(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/\r\n/g, '\n')
    .replace(/[\t\u00A0]+/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[\u0000-\u001f]/g, '')
    .trim();
}
