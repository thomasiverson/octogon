import { ModelRate, PricingTable } from './pricingTypes';
import { CostBreakdown } from '../shared/types';

/** Identifying fields used to map a vscode.lm model to a pricing-table key. */
export interface ModelIdentity {
  id?: string;
  family?: string;
  name?: string;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/^copilot\//, '')
    .replace(/\s+/g, '-');
}

/** Candidate keys derived from a model's family/id/name, most specific first. */
function candidates(identity: ModelIdentity): string[] {
  const out = new Set<string>();
  for (const raw of [identity.family, identity.id, identity.name]) {
    if (!raw) continue;
    const n = normalize(raw);
    out.add(n);
    // Strip a trailing date stamp some ids carry, e.g. "-20240620".
    out.add(n.replace(/-\d{6,8}$/, ''));
  }
  return [...out].filter((s) => s.length > 0);
}

/** True when `key` is a version-boundary prefix of `candidate` (e.g. gpt-5.4 ⊂ gpt-5.4-turbo). */
function boundaryPrefix(key: string, candidate: string): boolean {
  if (!candidate.startsWith(key)) return false;
  const next = candidate.charAt(key.length);
  return next === '' || next === '-' || next === '.';
}

/**
 * Map a model identity to a pricing entry. Exact/normalized matches win; a
 * conservative version-boundary prefix is the only fallback. Returns undefined
 * (caller flags "rate unavailable") rather than guessing wildly.
 */
export function resolveRate(
  table: PricingTable,
  identity: ModelIdentity
): { key: string; rate: ModelRate } | undefined {
  const cands = candidates(identity);
  const keys = Object.keys(table.models);

  for (const c of cands) {
    if (table.models[c]) {
      return { key: c, rate: table.models[c] };
    }
  }

  let best: { key: string; len: number } | undefined;
  for (const c of cands) {
    for (const k of keys) {
      if (boundaryPrefix(k, c) && (!best || k.length > best.len)) {
        best = { key: k, len: k.length };
      }
    }
  }
  return best ? { key: best.key, rate: table.models[best.key] } : undefined;
}

/**
 * Compute token cost in USD + AI credits. Honors the long-context tier when the
 * input exceeds its threshold. Unknown models return rateAvailable=false.
 */
export function tokenCost(
  table: PricingTable,
  identity: ModelIdentity,
  inputTokens: number,
  outputTokens: number
): CostBreakdown {
  const resolved = resolveRate(table, identity);
  if (!resolved) {
    return {
      usd: 0,
      credits: 0,
      inputUsd: 0,
      outputUsd: 0,
      rateAvailable: false,
      longContext: false
    };
  }

  const { key, rate } = resolved;
  let inputRate = rate.input;
  let outputRate = rate.output;
  let longContext = false;

  if (rate.longContext && inputTokens > rate.longContext.thresholdInputTokens) {
    inputRate = rate.longContext.input;
    outputRate = rate.longContext.output;
    longContext = true;
  }

  const inputUsd = (inputTokens / 1_000_000) * inputRate;
  const outputUsd = (outputTokens / 1_000_000) * outputRate;
  const usd = inputUsd + outputUsd;
  const credits = table.aiCreditUsd > 0 ? usd / table.aiCreditUsd : 0;

  return {
    usd,
    credits,
    inputUsd,
    outputUsd,
    rateAvailable: true,
    longContext,
    pricingKey: key
  };
}
