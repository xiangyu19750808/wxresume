export function normalizeText(text) {
  return (text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[\t]+/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
}

export function tokenize(text) {
  return normalizeText(text)
    .split(/\s+|[,，。.!?；;、\n]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}
