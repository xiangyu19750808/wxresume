export function normalizeScore(value: number): number {
  // Normalize scores to range
  return value;
}

export function aggregateScores(scores: number[]): number {
  // Aggregate multiple scores into a single metric
  return scores.reduce((acc, curr) => acc + curr, 0);
}
