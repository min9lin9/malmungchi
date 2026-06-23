export interface RerankScoreInput {
  slug: string;
  keywordScore: number;
  semanticScore: number;
}

export interface RerankScore {
  slug: string;
  score: number;
}

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return (value - min) / (max - min);
}

function normalizeCosine(value: number): number {
  return Math.max(0, Math.min(1, (value + 1) / 2));
}

export function combineRerankScores(inputs: readonly RerankScoreInput[]): RerankScore[] {
  const keywordScores = inputs.map((input) => input.keywordScore);
  const min = Math.min(...keywordScores);
  const max = Math.max(...keywordScores);
  return inputs
    .map((input) => ({
      slug: input.slug,
      score:
        0.2 * normalize(input.keywordScore, min, max) + 0.8 * normalizeCosine(input.semanticScore),
    }))
    .sort((left, right) => right.score - left.score || left.slug.localeCompare(right.slug));
}
