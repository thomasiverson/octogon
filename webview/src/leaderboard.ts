import type { Leaderboard, ModelResult } from '../../src/shared/types';

/** Compute cheapest/fastest/highest-rated for a set of results (used when
 *  reloading a saved run, where the extension does not re-send a leaderboard). */
export function computeClientLeaderboard(results: ModelResult[]): Leaderboard {
  const ok = results.filter((r) => !r.error);
  const lb: Leaderboard = {};

  const fastest = ok
    .filter((r) => r.latencyMs > 0)
    .reduce<ModelResult | undefined>((b, r) => (!b || r.latencyMs < b.latencyMs ? r : b), undefined);
  if (fastest) lb.fastest = { modelId: fastest.modelId, value: fastest.latencyMs };

  const cheapest = ok
    .filter((r) => r.cost?.rateAvailable)
    .reduce<ModelResult | undefined>((b, r) => (!b || r.cost!.usd < b.cost!.usd ? r : b), undefined);
  if (cheapest?.cost) lb.cheapest = { modelId: cheapest.modelId, value: cheapest.cost.usd };

  const rated = ok.filter((r) => typeof r.manualRating === 'number' && (r.manualRating as number) > 0);
  if (rated.length > 0) {
    const best = rated.reduce((a, c) =>
      (c.manualRating as number) > (a.manualRating as number) ? c : a
    );
    lb.highestRated = { modelId: best.modelId, value: best.manualRating as number };
  } else {
    const judged = ok.filter((r) => r.judge && r.judge.score > 0);
    if (judged.length > 0) {
      const best = judged.reduce((a, c) => (c.judge!.score > a.judge!.score ? c : a));
      lb.highestRated = { modelId: best.modelId, value: best.judge!.score };
    }
  }

  return lb;
}
