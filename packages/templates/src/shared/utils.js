const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;'
};

export function escapeHtml(value = '') {
  const str = String(value ?? '');
  return str.replace(/[&<>"'`]/g, (ch) => HTML_ESCAPE_MAP[ch] || ch);
}

export function joinSafe(values = [], separator = ' · ') {
  return values.filter((v) => v && String(v).trim().length > 0).map((v) => escapeHtml(v)).join(separator);
}

export function normaliseArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

export function formatDateRange({ startDate, endDate }) {
  const start = startDate ? escapeHtml(startDate) : '';
  const end = endDate ? escapeHtml(endDate) : '至今';
  if (!start && !end) return '';
  if (!start) return end;
  return `${start} - ${end}`;
}

export function pickResume(data = {}) {
  if (data && typeof data === 'object' && data.resume && typeof data.resume === 'object') {
    return data.resume;
  }
  return data || {};
}

export function ensureArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
