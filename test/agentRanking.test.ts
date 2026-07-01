import { describe, it, expect } from 'vitest';
import { producedChanges, rankAgents } from '../src/agent/agentRanking';
import type { AgentResult } from '../src/shared/types';

function base(modelId: string, over: Partial<AgentResult> = {}): AgentResult {
  return {
    modelId,
    transcript: '',
    steps: [],
    iterations: 1,
    tokens: { input: 0, output: 0 },
    latencyMs: 0,
    stopReason: 'finished',
    filesChanged: 0,
    canApply: true,
    ...over
  };
}

describe('producedChanges', () => {
  it('requires changes and no error', () => {
    expect(producedChanges(base('a', { filesChanged: 2 }))).toBe(true);
    expect(producedChanges(base('a', { filesChanged: 0 }))).toBe(false);
    expect(producedChanges(base('a', { filesChanged: 2, error: { message: 'x' } }))).toBe(false);
  });
});

describe('rankAgents', () => {
  it('returns an empty board for no results', () => {
    expect(rankAgents([])).toEqual({});
  });

  it('picks smallest diff, cheapest, and fewest iterations', () => {
    const a = base('a', {
      filesChanged: 1,
      iterations: 5,
      diff: { filesChanged: 1, additions: 2, deletions: 1, files: [] },
      cost: { usd: 0.05, credits: 5, inputUsd: 0, outputUsd: 0, rateAvailable: true, longContext: false }
    });
    const b = base('b', {
      filesChanged: 3,
      iterations: 2,
      diff: { filesChanged: 3, additions: 40, deletions: 10, files: [] },
      cost: { usd: 0.02, credits: 2, inputUsd: 0, outputUsd: 0, rateAvailable: true, longContext: false }
    });
    const board = rankAgents([a, b]);
    expect(board.smallestDiff?.modelId).toBe('a');
    expect(board.cheapest?.modelId).toBe('b');
    expect(board.fewestIterations?.modelId).toBe('b');
    expect(board.recommended?.modelId).toBe('b'); // cheaper wins when none verified
  });

  it('prefers a model whose tests passed (cheapest-to-green)', () => {
    const a = base('a', {
      filesChanged: 1,
      diff: { filesChanged: 1, additions: 1, deletions: 0, files: [] },
      cost: { usd: 0.10, credits: 10, inputUsd: 0, outputUsd: 0, rateAvailable: true, longContext: false },
      verify: { modelId: 'a', passed: true, exitCode: 0, command: 'npm test', log: '' }
    });
    const b = base('b', {
      filesChanged: 1,
      diff: { filesChanged: 1, additions: 1, deletions: 0, files: [] },
      cost: { usd: 0.01, credits: 1, inputUsd: 0, outputUsd: 0, rateAvailable: true, longContext: false },
      verify: { modelId: 'b', passed: false, exitCode: 1, command: 'npm test', log: '' }
    });
    const board = rankAgents([a, b]);
    expect(board.passedTests?.modelId).toBe('a');
    expect(board.recommended?.modelId).toBe('a');
    expect(board.recommended?.basis).toContain('passed tests');
  });

  it('ignores errored agents when recommending', () => {
    const a = base('a', { filesChanged: 0, error: { message: 'boom' }, stopReason: 'error' });
    const b = base('b', {
      filesChanged: 2,
      diff: { filesChanged: 2, additions: 5, deletions: 0, files: [] }
    });
    expect(rankAgents([a, b]).recommended?.modelId).toBe('b');
  });
});
