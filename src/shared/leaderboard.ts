import { Leaderboard, ModelResult } from './types';
import { highestRated } from '../scoring/manual';

/**
 * Compute the per-run leaderboard: cheapest (token USD), fastest (latency),
 * highest-rated (manual rating, else judge), and best value (lowest
 * cost-per-quality). Pure and shared by the extension host and the webview.
 */
export function computeLeaderboard(results: ModelResult[]): Leaderboard {
  const ok = results.filter((r) => !r.error);
  const leaderboard: Leaderboard = {};

  const fastest = ok
    .filter((r) => r.latencyMs > 0)
    .reduce<ModelResult | undefined>(
      (best, r) => (!best || r.latencyMs < best.latencyMs ? r : best),
      undefined
    );
  if (fastest) {
    leaderboard.fastest = { modelId: fastest.modelId, value: fastest.latencyMs };
  }

  const cheapest = ok
    .filter((r) => r.cost?.rateAvailable)
    .reduce<ModelResult | undefined>(
      (best, r) => (!best || r.cost!.usd < best.cost!.usd ? r : best),
      undefined
    );
  if (cheapest?.cost) {
    leaderboard.cheapest = { modelId: cheapest.modelId, value: cheapest.cost.usd };
  }

  const rated = highestRated(results);
  if (rated) {
    leaderboard.highestRated = rated;
  }

  // Best value: lowest cost-per-quality. Use a single quality basis (prefer
  // manual ratings; fall back to judge scores) so the comparison is consistent.
  const priced = ok.filter((r) => r.cost?.rateAvailable && r.cost!.usd > 0);
  const basis: 'rating' | 'judge' | null = priced.some(
    (r) => typeof r.manualRating === 'number' && (r.manualRating as number) > 0
  )
    ? 'rating'
    : priced.some((r) => r.judge && r.judge.score > 0)
      ? 'judge'
      : null;

  if (basis) {
    let best: { modelId: string; value: number } | undefined;
    for (const r of priced) {
      const quality = basis === 'rating' ? r.manualRating ?? 0 : r.judge?.score ?? 0;
      if (quality <= 0) continue;
      const value = r.cost!.usd / quality;
      if (!best || value < best.value) {
        best = { modelId: r.modelId, value };
      }
    }
    if (best) {
      leaderboard.bestValue = { ...best, basis };
    }
  }

  return leaderboard;
}
