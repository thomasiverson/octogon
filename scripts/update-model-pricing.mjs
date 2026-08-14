import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

const SOURCE_URL =
  'https://raw.githubusercontent.com/github/docs/main/data/tables/copilot/models-and-pricing.yml';
const OUTPUT_PATH = new URL('../pricing/model-pricing.json', import.meta.url);

const PROVIDERS = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  xai: 'xAI',
  microsoft: 'Microsoft',
  github: 'GitHub (fine-tuned)',
  moonshot_ai: 'Moonshot AI'
};

function scalar(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parsePricingYaml(text) {
  const entries = [];
  let current;

  for (const line of text.split(/\r?\n/)) {
    const model = line.match(/^- model:\s*(.+)$/);
    if (model) {
      if (current) entries.push(current);
      current = { model: scalar(model[1]) };
      continue;
    }

    const property = line.match(/^\s{2}([a-z_]+):\s*(.+)$/);
    if (current && property) current[property[1]] = scalar(property[2]);
  }
  if (current) entries.push(current);

  if (entries.length < 10) {
    throw new Error(`Upstream pricing contained only ${entries.length} model rows`);
  }
  return entries;
}

function modelKey(name) {
  const withoutFootnotes = name.replace(/\[\^[^\]]+\]/g, '');
  const aliases = {
    'Claude Opus 4.8 (fast mode) (preview)': 'claude-opus-4.8-fast'
  };
  return (
    aliases[withoutFootnotes] ??
    withoutFootnotes
      .toLowerCase()
      .trim()
      .replace(/[()]/g, '')
      .replace(/[^a-z0-9.]+/g, '-')
      .replace(/^-|-$/g, '')
  );
}

function price(value, field, model) {
  if (!value || value === 'Not applicable') return undefined;
  if (!/^\$\d+(?:\.\d+)?$/.test(value)) {
    throw new Error(`Invalid ${field} price "${value}" for ${model}`);
  }
  return Number(value.slice(1));
}

function threshold(value, model) {
  if (!value || value === 'Not applicable') return undefined;
  const match = value.match(/[≤>]\s*(\d+)K$/);
  if (!match) throw new Error(`Invalid threshold "${value}" for ${model}`);
  return Number(match[1]) * 1000;
}

function rates(entry) {
  const result = {
    provider: PROVIDERS[entry.provider],
    input: price(entry.input, 'input', entry.model),
    cachedInput: price(entry.cached_input, 'cached input', entry.model),
    output: price(entry.output, 'output', entry.model)
  };
  const cacheWrite = price(entry.cache_write, 'cache write', entry.model);
  if (cacheWrite !== undefined) result.cacheWrite = cacheWrite;

  if (
    !result.provider ||
    result.input === undefined ||
    result.cachedInput === undefined ||
    result.output === undefined
  ) {
    throw new Error(`Incomplete or unsupported pricing row for ${entry.model}`);
  }
  return result;
}

export function buildModels(entries) {
  const models = {};

  for (const entry of entries) {
    const key = modelKey(entry.model);
    const tier = entry.tier ?? 'Default';
    if (tier === 'Default') {
      if (models[key]) throw new Error(`Duplicate default pricing for ${key}`);
      models[key] = rates(entry);
      continue;
    }
    if (tier !== 'Long context') {
      throw new Error(`Unsupported pricing tier "${tier}" for ${entry.model}`);
    }

    const base = models[key];
    if (!base) throw new Error(`Long-context pricing precedes default pricing for ${key}`);
    if (base.longContext) throw new Error(`Duplicate long-context pricing for ${key}`);
    const longRates = rates(entry);
    base.longContext = {
      thresholdInputTokens: threshold(entry.threshold, entry.model),
      input: longRates.input,
      cachedInput: longRates.cachedInput,
      output: longRates.output
    };
    if (longRates.cacheWrite !== undefined) {
      base.longContext.cacheWrite = longRates.cacheWrite;
    }
  }

  if (Object.keys(models).length < 10) {
    throw new Error('Refusing to publish an unexpectedly small pricing table');
  }
  return models;
}

async function fetchSource() {
  const response = await fetch(SOURCE_URL, {
    headers: { accept: 'text/yaml', 'user-agent': 'octogon-pricing-updater' }
  });
  if (!response.ok) throw new Error(`Pricing download failed: HTTP ${response.status}`);
  return response.text();
}

async function main() {
  const sourcePathIndex = process.argv.indexOf('--source');
  const source =
    sourcePathIndex >= 0
      ? await readFile(process.argv[sourcePathIndex + 1], 'utf8')
      : await fetchSource();
  const current = JSON.parse(await readFile(OUTPUT_PATH, 'utf8'));
  const models = buildModels(parsePricingYaml(source));
  const currentCount = Object.keys(current.models ?? {}).length;
  const updatedCount = Object.keys(models).length;
  if (currentCount > 0 && updatedCount < Math.ceil(currentCount * 0.75)) {
    throw new Error(
      `Refusing to reduce the pricing table from ${currentCount} to ${updatedCount} models`
    );
  }

  if (JSON.stringify(current.models) === JSON.stringify(models)) {
    console.log('Pricing is already current.');
    return;
  }

  const updated = {
    source:
      'GitHub Copilot - Models and pricing (https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing)',
    lastUpdated: new Date().toISOString().slice(0, 10),
    billingModel: 'usage-based (effective 2026-06-01)',
    currency: 'USD',
    unit: 'per_1m_tokens',
    aiCreditUsd: 0.01,
    notes: [
      'GitHub Copilot bills usage-based as of 2026-06-01: tokens are converted to GitHub AI credits where 1 credit = $0.01 USD.',
      "All values are Copilot's billed rates per 1,000,000 tokens.",
      "'cachedInput' is the reuse rate; models may also include a 'cacheWrite' cost.",
      "Models with a 'longContext' tier charge higher rates above an input-token threshold.",
      'Each plan includes an AI-credit allowance; overage is billed at these per-token rates.',
      'This file is synchronized from the structured pricing data in the github/docs repository.',
      'Keys are canonical model ids; map vscode.lm model id/family to these keys in the cost calculator.'
    ],
    models
  };

  await writeFile(OUTPUT_PATH, `${JSON.stringify(updated, null, 2)}\n`);
  console.log(`Updated ${updatedCount} model prices.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
