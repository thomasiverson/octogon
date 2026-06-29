import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tokenCost, resolveRate } from '../src/cost/costCalculator';
import type { PricingTable } from '../src/cost/pricingTypes';

const synthetic: PricingTable = {
  source: 'test',
  lastUpdated: '2026-01-01',
  currency: 'USD',
  unit: 'per_1m_tokens',
  aiCreditUsd: 0.01,
  models: {
    'demo-model': { provider: 'Test', input: 2, cachedInput: 0.2, output: 10 },
    'gpt-5.4': {
      provider: 'OpenAI',
      input: 2.5,
      cachedInput: 0.25,
      output: 15,
      longContext: { thresholdInputTokens: 272000, input: 5, cachedInput: 0.5, output: 22.5 }
    }
  }
};

describe('tokenCost', () => {
  it('computes USD and credits from per-1M rates', () => {
    const c = tokenCost(synthetic, { family: 'demo-model' }, 1_000_000, 1_000_000);
    expect(c.inputUsd).toBeCloseTo(2);
    expect(c.outputUsd).toBeCloseTo(10);
    expect(c.usd).toBeCloseTo(12);
    expect(c.credits).toBeCloseTo(1200); // usd / 0.01
    expect(c.rateAvailable).toBe(true);
    expect(c.longContext).toBe(false);
  });

  it('scales linearly with token counts', () => {
    const c = tokenCost(synthetic, { family: 'demo-model' }, 500_000, 200_000);
    expect(c.inputUsd).toBeCloseTo(1.0);
    expect(c.outputUsd).toBeCloseTo(2.0);
    expect(c.usd).toBeCloseTo(3.0);
  });

  it('applies the long-context tier only above the threshold', () => {
    const below = tokenCost(synthetic, { family: 'gpt-5.4' }, 200_000, 1000);
    expect(below.longContext).toBe(false);
    expect(below.inputUsd).toBeCloseTo((200_000 / 1e6) * 2.5);

    const above = tokenCost(synthetic, { family: 'gpt-5.4' }, 300_000, 1000);
    expect(above.longContext).toBe(true);
    expect(above.inputUsd).toBeCloseTo((300_000 / 1e6) * 5);
    expect(above.outputUsd).toBeCloseTo((1000 / 1e6) * 22.5);
  });

  it('flags unknown models as rate-unavailable with zero cost', () => {
    const c = tokenCost(synthetic, { family: 'totally-unknown' }, 1000, 1000);
    expect(c.rateAvailable).toBe(false);
    expect(c.usd).toBe(0);
    expect(c.credits).toBe(0);
  });
});

describe('resolveRate normalization', () => {
  it('matches case-insensitively and converts spaces to hyphens', () => {
    expect(resolveRate(synthetic, { name: 'Demo Model' })?.key).toBe('demo-model');
  });

  it('uses a version-boundary prefix as a conservative fallback', () => {
    expect(resolveRate(synthetic, { family: 'gpt-5.4-turbo' })?.key).toBe('gpt-5.4');
  });

  it('does not match unrelated keys', () => {
    expect(resolveRate(synthetic, { family: 'claude-x' })).toBeUndefined();
  });

  it('strips a trailing date stamp', () => {
    expect(resolveRate(synthetic, { id: 'demo-model-20260101' })?.key).toBe('demo-model');
  });
});

describe('bundled pricing table', () => {
  const table = JSON.parse(
    readFileSync(resolve(__dirname, '../src/cost/data/model-pricing.json'), 'utf8')
  ) as PricingTable;

  it('prices a known model from the snapshot', () => {
    const c = tokenCost(table, { family: 'gpt-5-mini' }, 1_000_000, 0);
    expect(c.rateAvailable).toBe(true);
    expect(c.usd).toBeCloseTo(0.25);
  });

  it('keeps 1 credit = $0.01', () => {
    expect(table.aiCreditUsd).toBe(0.01);
  });

  it('honors the Gemini 3.1 Pro long-context threshold', () => {
    const above = tokenCost(table, { family: 'gemini-3.1-pro' }, 250_000, 0);
    expect(above.longContext).toBe(true);
    expect(above.inputUsd).toBeCloseTo((250_000 / 1e6) * 4.0);
  });
});
