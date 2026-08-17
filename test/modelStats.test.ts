import { describe, it, expect } from 'vitest';
import {
  computeModelStats,
  averageOutputTokens,
  estimateOutputTokens
} from '../src/store/modelStats';
import type { ModelResult, RunRecord } from '../src/shared/types';

function result(modelId: string, over: Partial<ModelResult> = {}): ModelResult {
  return {
    modelId,
    output: 'x',
    tokens: { input: 10, output: 100 },
    latencyMs: 1100,
    timeToFirstTokenMs: 100,
    ...over
  };
}

function record(over: Partial<RunRecord>): RunRecord {
  return {
    version: 1,
    id: 'r',
    timestamp: 0,
    prompt: 'p',
    contextRefs: [],
    modelIds: ['a', 'b'],
    modelNames: { a: 'Model A', b: 'Model B' },
    results: [],
    winner: null,
    ...over
  };
}

describe('computeModelStats', () => {
  const records: RunRecord[] = [
    record({ id: '1', winner: 'a', results: [result('a', { manualRating: 5 }), result('b', { error: { message: 'x' } })] }),
    record({ id: '2', winner: 'a', results: [result('a'), result('b')] })
  ];
  const stats = computeModelStats(records);
  const a = stats.find((s) => s.modelId === 'a')!;
  const b = stats.find((s) => s.modelId === 'b')!;

  it('counts appearances and win rate', () => {
    expect(a.runs).toBe(2);
    expect(a.winRate).toBe(1); // won both
    expect(b.runs).toBe(2);
    expect(b.winRate).toBe(0);
  });

  it('computes error rate', () => {
    expect(a.errorRate).toBe(0);
    expect(b.errorRate).toBe(0.5); // one of two errored
  });

  it('averages rating and throughput over successful responses', () => {
    expect(a.avgRating).toBe(5);
    expect(a.ratedCount).toBe(1);
    // 100 tokens over a 1000ms generation window -> 100 tok/s
    expect(a.avgTokensPerSec).toBeCloseTo(100);
  });

  it('uses the model display name and sorts by run count', () => {
    expect(a.modelName).toBe('Model A');
    expect(stats[0].runs).toBeGreaterThanOrEqual(stats[stats.length - 1].runs);
  });
});

describe('averageOutputTokens', () => {
  it('averages output tokens per model, ignoring errored responses', () => {
    const records: RunRecord[] = [
      record({ id: '1', results: [result('a', { tokens: { input: 10, output: 100 } }), result('b', { error: { message: 'x' } })] }),
      record({ id: '2', results: [result('a', { tokens: { input: 10, output: 300 } })] })
    ];
    const avg = averageOutputTokens(records);
    expect(avg.get('a')).toBe(200); // (100 + 300) / 2
    expect(avg.has('b')).toBe(false); // only errored -> no data
  });

  describe('estimateOutputTokens', () => {
    it('uses a median and quartile range so outliers do not dominate', () => {
      const outputs = [100, 200, 300, 10_000];
      const records = outputs.map((output, index) =>
        record({
          id: String(index),
          results: [result('a', { tokens: { input: 10, output } })]
        })
      );

      expect(estimateOutputTokens(records).get('a')).toEqual({
        expected: 250,
        low: 175,
        high: 2725,
        sampleCount: 4
      });
    });

    it('reports a single observation without inventing a range', () => {
      const records = [
        record({ results: [result('a', { tokens: { input: 10, output: 321 } })] })
      ];
      expect(estimateOutputTokens(records).get('a')).toEqual({
        expected: 321,
        low: 321,
        high: 321,
        sampleCount: 1
      });
    });

    it('ignores errored and empty responses', () => {
      const records = [
        record({
          results: [
            result('a', { error: { message: 'failed' }, tokens: { input: 10, output: 500 } }),
            result('b', { tokens: { input: 10, output: 0 } })
          ]
        })
      ];
      expect(estimateOutputTokens(records).size).toBe(0);
    });
  });

  it('is empty when there is no history', () => {
    expect(averageOutputTokens([]).size).toBe(0);
  });
});
