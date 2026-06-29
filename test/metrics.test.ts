import { describe, it, expect } from 'vitest';
import { tokensPerSecond } from '../src/shared/metrics';
import type { ModelResult } from '../src/shared/types';

function r(over: Partial<ModelResult>): ModelResult {
  return {
    modelId: 'm',
    output: 'x',
    tokens: { input: 0, output: 0 },
    latencyMs: 0,
    timeToFirstTokenMs: null,
    ...over
  };
}

describe('tokensPerSecond', () => {
  it('computes over the generation window (excludes ttft)', () => {
    // 100 output tokens, latency 2000ms, ttft 1000ms -> 1000ms window -> 100 tok/s
    expect(
      tokensPerSecond(r({ tokens: { input: 0, output: 100 }, latencyMs: 2000, timeToFirstTokenMs: 1000 }))
    ).toBeCloseTo(100);
  });

  it('falls back to total latency when the window is non-positive', () => {
    // ttft == latency -> window 0 -> use latency 500ms with 50 tokens -> 100 tok/s
    expect(
      tokensPerSecond(r({ tokens: { input: 0, output: 50 }, latencyMs: 500, timeToFirstTokenMs: 500 }))
    ).toBeCloseTo(100);
  });

  it('returns null for errors and zero output', () => {
    expect(
      tokensPerSecond(r({ error: { message: 'x' }, tokens: { input: 0, output: 100 }, latencyMs: 1000 }))
    ).toBeNull();
    expect(tokensPerSecond(r({ tokens: { input: 0, output: 0 }, latencyMs: 1000 }))).toBeNull();
  });
});
