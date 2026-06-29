import { LeaderboardEntry, ModelResult } from '../shared/types';

/** Clamp a manual rating to the 1–5 star range (or null to clear). */
export function clampRating(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value)) return null;
  return Math.max(1, Math.min(5, Math.round(value)));
}

/**
 * Highest-rated entry for the leaderboard. Manual ratings (1–5) take precedence;
 * when none are set, fall back to the judge score (1–10).
 */
export function highestRated(results: ModelResult[]): LeaderboardEntry | undefined {
  const rated = results.filter(
    (r) => typeof r.manualRating === 'number' && (r.manualRating as number) > 0
  );
  if (rated.length > 0) {
    const best = rated.reduce((a, b) =>
      (b.manualRating as number) > (a.manualRating as number) ? b : a
    );
    return { modelId: best.modelId, value: best.manualRating as number };
  }

  const judged = results.filter((r) => r.judge && r.judge.score > 0);
  if (judged.length > 0) {
    const best = judged.reduce((a, b) => (b.judge!.score > a.judge!.score ? b : a));
    return { modelId: best.modelId, value: best.judge!.score };
  }

  return undefined;
}
