import { describe, it, expect, beforeEach } from 'vitest';
import { blindLabel } from '../webview/src/format';
import { toSummary } from '../src/store/historyStore';
import { ModelRegistry } from '../src/models/registry';
import type { RunRecord } from '../src/shared/types';
import { lm } from './mocks/vscode';

// ---------------------------------------------------------------------------
// blindLabel — anonymized column headings
// ---------------------------------------------------------------------------
describe('blindLabel', () => {
  it('maps 0-based indices to Model A, B, …, Z', () => {
    expect(blindLabel(0)).toBe('Model A');
    expect(blindLabel(1)).toBe('Model B');
    expect(blindLabel(25)).toBe('Model Z');
  });

  it('falls back for an unknown (negative) index', () => {
    expect(blindLabel(-1)).toBe('Model ?');
  });
});

// ---------------------------------------------------------------------------
// ModelRegistry.pickRandom — the extension's blind model selection
// ---------------------------------------------------------------------------
function fakeModel(id: string, name: string) {
  return { id, name, family: name.toLowerCase(), vendor: 'copilot', maxInputTokens: 1000 };
}

describe('ModelRegistry.pickRandom', () => {
  beforeEach(() => {
    (lm.selectChatModels as unknown as { mockReset: () => void }).mockReset();
  });

  it('returns n models, distinct by display name, refreshing an empty cache', async () => {
    (lm.selectChatModels as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue([
      fakeModel('1', 'Alpha'),
      fakeModel('2', 'Beta'),
      fakeModel('3', 'Gamma'),
      fakeModel('4', 'Delta'),
      fakeModel('5', 'Alpha') // the picker can list the same model twice
    ]);
    const picked = await new ModelRegistry().pickRandom(3, () => 0);
    expect(picked).toHaveLength(3);
    expect(new Set(picked.map((m) => m.name)).size).toBe(3);
  });

  it('clamps to the available count when n exceeds the pool', async () => {
    (lm.selectChatModels as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue([
      fakeModel('1', 'Alpha'),
      fakeModel('2', 'Beta')
    ]);
    const picked = await new ModelRegistry().pickRandom(4);
    expect(picked).toHaveLength(2);
  });

  it('is deterministic for a fixed rng sequence', async () => {
    const models = ['Alpha', 'Beta', 'Gamma', 'Delta'].map((n, i) => fakeModel(String(i), n));
    (lm.selectChatModels as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(models);
    const seq = [0.7, 0.1, 0.9, 0.4, 0.2];
    const rngFrom = () => {
      let i = 0;
      return () => seq[i++ % seq.length];
    };
    const a = await new ModelRegistry().pickRandom(3, rngFrom());
    const b = await new ModelRegistry().pickRandom(3, rngFrom());
    expect(a.map((m) => m.id)).toEqual(b.map((m) => m.id));
  });
});

// ---------------------------------------------------------------------------
// Blind flag persists into the history index summary
// ---------------------------------------------------------------------------
const baseRecord: RunRecord = {
  version: 1,
  id: 'r1',
  timestamp: 1750000000000,
  prompt: 'hi',
  contextRefs: [],
  modelIds: ['m1', 'm2'],
  modelNames: { m1: 'GPT', m2: 'Claude' },
  results: [],
  winner: null
};

describe('toSummary blind flag', () => {
  it('carries blind:true into the summary', () => {
    expect(toSummary({ ...baseRecord, blind: true }).blind).toBe(true);
  });

  it('defaults to false when the record predates blind mode', () => {
    expect(toSummary(baseRecord).blind).toBe(false);
  });
});
