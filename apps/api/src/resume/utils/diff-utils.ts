export interface ChangeDiff {
  before: string;
  after: string;
  description: string;
}

export function generateDiffs(originalText: string, optimizedText: string): ChangeDiff[] {
  // Generate applied_changes placeholder
  return [
    {
      before: originalText,
      after: optimizedText,
      description: 'Placeholder diff',
    },
  ];
}
