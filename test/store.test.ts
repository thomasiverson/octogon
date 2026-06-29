import { describe, it, expect } from 'vitest';
import { buildMarkdownSummary } from '../src/store/exporter';
import type { RunRecord } from '../src/shared/types';

const record: RunRecord = {
  version: 1,
  id: 'abc',
  timestamp: 1750000000000,
  prompt: 'Add a discount field',
  contextRefs: [{ path: 'src/x.ts', source: 'active', tokens: 100 }],
  modelIds: ['m1', 'm2'],
  modelNames: { m1: 'GPT', m2: 'Claude' },
  winner: 'm1',
  results: [
    {
      modelId: 'm1',
      output: 'answer one',
      tokens: { input: 100, output: 50 },
      latencyMs: 1200,
      timeToFirstTokenMs: 200,
      cost: {
        usd: 0.01,
        credits: 1,
        inputUsd: 0.005,
        outputUsd: 0.005,
        rateAvailable: true,
        longContext: false
      },
      manualRating: 4,
      judge: { modelId: 'm1', score: 8, rationale: 'good answer' }
    },
    {
      modelId: 'm2',
      output: '',
      tokens: { input: 0, output: 0 },
      latencyMs: 0,
      timeToFirstTokenMs: null,
      error: { message: 'boom' }
    }
  ]
};

describe('buildMarkdownSummary', () => {
  const md = buildMarkdownSummary(record);

  it('includes the prompt and context', () => {
    expect(md).toContain('# Octogon run');
    expect(md).toContain('Add a discount field');
    expect(md).toContain('src/x.ts');
  });

  it('marks the winner and shows rating + judge in the table', () => {
    expect(md).toContain('GPT 👑');
    expect(md).toContain('4/5');
    expect(md).toContain('8/10');
  });

  it('renders an error result and per-model responses', () => {
    expect(md).toContain('### Claude');
    expect(md).toContain('[error] boom');
  });

  it('includes judge rationales', () => {
    expect(md).toContain('good answer');
  });
});
