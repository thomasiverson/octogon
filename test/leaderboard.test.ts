import { describe, it, expect } from 'vitest';
import { computeLeaderboard } from '../src/shared/leaderboard';
import type { CostBreakdown, ModelResult } from '../src/shared/types';

function cost(usd: number, rateAvailable = true): CostBreakdown {
  return { usd, credits: usd / 0.01, inputUsd: usd / 2, outputUsd: usd / 2, rateAvailable, longContext: false };
}

function res(modelId: string, over: Partial<ModelResult> = {}): ModelResult {
  return {
    modelId,
    output: 'x',
    tokens: { input: 10, output: 10 },
    latencyMs: 1000,
    timeToFirstTokenMs: 100,
    ...over
  };
}

describe('computeLeaderboard', () => {
  it('picks cheapest and fastest', () => {
    const lb = computeLeaderboard([
      res('a', { latencyMs: 500, cost: cost(0.02) }),
      res('b', { latencyMs: 1500, cost: cost(0.01) })
    ]);
    expect(lb.fastest?.modelId).toBe('a');
    expect(lb.cheapest?.modelId).toBe('b');
  });

  it('best value uses cost-per-rating', () => {
    const lb = computeLeaderboard([
      res('a', { cost: cost(0.02), manualRating: 5 }), // 0.004 / star
      res('b', { cost: cost(0.01), manualRating: 2 }) // 0.005 / star
    ]);
    expect(lb.bestValue?.modelId).toBe('a');
    expect(lb.bestValue?.basis).toBe('rating');
  });

  it('best value falls back to judge when nothing is rated', () => {
    const lb = computeLeaderboard([
      res('a', { cost: cost(0.02), judge: { modelId: 'a', score: 8, rationale: '' } }), // 0.0025 / pt
      res('b', { cost: cost(0.01), judge: { modelId: 'b', score: 2, rationale: '' } }) // 0.005 / pt
    ]);
    expect(lb.bestValue?.modelId).toBe('a');
    expect(lb.bestValue?.basis).toBe('judge');
  });

  it('omits best value when there is no quality signal', () => {
    const lb = computeLeaderboard([res('a', { cost: cost(0.02) }), res('b', { cost: cost(0.01) })]);
    expect(lb.bestValue).toBeUndefined();
  });

  it('ignores errored results', () => {
    const lb = computeLeaderboard([
      res('a', { error: { message: 'boom' }, latencyMs: 10, cost: cost(0.0001) }),
      res('b', { latencyMs: 900, cost: cost(0.05) })
    ]);
    expect(lb.fastest?.modelId).toBe('b');
    expect(lb.cheapest?.modelId).toBe('b');
  });
});
