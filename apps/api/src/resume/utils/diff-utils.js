export function generateDiffs(originalText, optimizedText) {
  if (originalText === optimizedText) return [];
  const beforeLines = originalText.split(/\r?\n/).map((l) => l.trim());
  const afterLines = optimizedText.split(/\r?\n/).map((l) => l.trim());

  const changes = [];
  const maxLines = Math.max(beforeLines.length, afterLines.length);

  for (let i = 0; i < maxLines; i += 1) {
    const before = beforeLines[i] || '';
    const after = afterLines[i] || '';
    if (before === after) continue;
    changes.push({
      before,
      after,
      description: `Line ${i + 1} updated`,
    });
    if (changes.length >= 20) break;
  }

  if (changes.length === 0) {
    changes.push({
      before: originalText.slice(0, 200),
      after: optimizedText.slice(0, 200),
      description: 'Content refined for clarity',
    });
  }

  return changes;
}
