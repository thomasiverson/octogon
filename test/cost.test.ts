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
    readFileSync(resolve(__dirname, '../pricing/model-pricing.json'), 'utf8')
  ) as PricingTable;

  it('contains models to validate', () => {
    expect(Object.keys(table.models).length).toBeGreaterThan(0);
  });

  it('keeps 1 credit = $0.01', () => {
    expect(table.aiCreditUsd).toBe(0.01);
  });

  describe.each(Object.entries(table.models))('%s', (key, rate) => {
    it('uses the published default rates', () => {
      const inputTokens = Math.min(1_000_000, rate.longContext?.thresholdInputTokens ?? 1_000_000);
      const outputTokens = 1000;
      const c = tokenCost(table, { family: key }, inputTokens, outputTokens);
      const inputUsd = (inputTokens / 1e6) * rate.input;
      const outputUsd = (outputTokens / 1e6) * rate.output;

      expect(c.rateAvailable).toBe(true);
      expect(c.pricingKey).toBe(key);
      expect(c.longContext).toBe(false);
      expect(c.inputUsd).toBeCloseTo(inputUsd, 10);
      expect(c.outputUsd).toBeCloseTo(outputUsd, 10);
      expect(c.usd).toBeCloseTo(inputUsd + outputUsd, 10);
      expect(c.credits).toBeCloseTo((inputUsd + outputUsd) / table.aiCreditUsd, 10);
    });

    const longContext = rate.longContext;
    if (longContext) {
      it('applies long-context rates only above the published threshold', () => {
        const outputTokens = 1000;
        const atThreshold = tokenCost(
          table, { family: key }, longContext.thresholdInputTokens, outputTokens
        );
        expect(atThreshold.longContext).toBe(false);
        expect(atThreshold.inputUsd).toBeCloseTo(
          (longContext.thresholdInputTokens / 1e6) * rate.input, 10
        );
        expect(atThreshold.outputUsd).toBeCloseTo((outputTokens / 1e6) * rate.output, 10);

        const inputTokens = longContext.thresholdInputTokens + 1;
        const above = tokenCost(table, { family: key }, inputTokens, outputTokens);
        expect(above.longContext).toBe(true);
        expect(above.inputUsd).toBeCloseTo((inputTokens / 1e6) * longContext.input, 10);
        expect(above.outputUsd).toBeCloseTo((outputTokens / 1e6) * longContext.output, 10);
      });
    }
  });
});
