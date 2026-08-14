import assert from 'node:assert/strict';
import test from 'node:test';
import { buildModels, parsePricingYaml } from './update-model-pricing.mjs';

const row = (model, provider, extra = '') => `- model: '${model}'
  provider: ${provider}
  release_status: GA
  category: Versatile
  input: $1.00
  cached_input: $0.10
  output: $5.00
  cache_write: Not applicable
${extra}`;

test('parses default and long-context pricing', () => {
  const source = [
    row('GPT-5.6 Sol', 'openai', "  threshold: '≤ 272K'\n  tier: Default"),
    row(
      'GPT-5.6 Sol',
      'openai',
      "  threshold: '> 272K'\n  tier: 'Long context'\n  cache_write: $6.25"
    ),
    ...Array.from({ length: 9 }, (_, index) => row(`Test ${index}`, 'google'))
  ].join('\n');

  const models = buildModels(parsePricingYaml(source));
  assert.deepEqual(models['gpt-5.6-sol'].longContext, {
    thresholdInputTokens: 272000,
    input: 1,
    cachedInput: 0.1,
    output: 5,
    cacheWrite: 6.25
  });
});

test('normalizes footnotes and the fast-mode model alias', () => {
  const source = [
    row('Gemini 3.7 Flash[^promo]', 'google'),
    row('Claude Opus 4.8 (fast mode) (preview)', 'anthropic'),
    ...Array.from({ length: 8 }, (_, index) => row(`Test ${index}`, 'github'))
  ].join('\n');

  const models = buildModels(parsePricingYaml(source));
  assert.ok(models['gemini-3.7-flash']);
  assert.ok(models['claude-opus-4.8-fast']);
});

test('rejects truncated upstream data', () => {
  assert.throws(() => parsePricingYaml(row('Only model', 'openai')), /only 1 model rows/);
});
