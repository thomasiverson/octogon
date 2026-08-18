import { ModelStat, RunRecord } from '../shared/types';
import { tokensPerSecond } from '../shared/metrics';

interface Acc {
  name: string;
  appearances: number;
  errors: number;
  wins: number;
  latencySum: number;
  latencyN: number;
  tpsSum: number;
  tpsN: number;
  costSum: number;
  creditSum: number;
  costN: number;
  ratingSum: number;
  ratingN: number;
  judgeSum: number;
  judgeN: number;
}

function emptyAcc(name: string): Acc {
  return {
    name,
    appearances: 0,
    errors: 0,
    wins: 0,
    latencySum: 0,
    latencyN: 0,
    tpsSum: 0,
    tpsN: 0,
    costSum: 0,
    creditSum: 0,
    costN: 0,
    ratingSum: 0,
    ratingN: 0,
    judgeSum: 0,
    judgeN: 0
  };
}

/** Aggregate saved runs into per-model performance stats. Pure/testable. */
export function computeModelStats(records: RunRecord[]): ModelStat[] {
  const map = new Map<string, Acc>();

  for (const record of records) {
    for (const r of record.results) {
      let acc = map.get(r.modelId);
      if (!acc) {
        acc = emptyAcc(record.modelNames[r.modelId] ?? r.modelId);
        map.set(r.modelId, acc);
      }
      acc.name = record.modelNames[r.modelId] ?? acc.name;
      acc.appearances++;

      if (r.error) {
        acc.errors++;
        continue;
      }
      if (record.winner === r.modelId) {
        acc.wins++;
      }
      if (r.latencyMs > 0) {
        acc.latencySum += r.latencyMs;
        acc.latencyN++;
      }
      const tps = tokensPerSecond(r);
      if (tps !== null) {
        acc.tpsSum += tps;
        acc.tpsN++;
      }
      if (r.cost?.rateAvailable) {
        acc.costSum += r.cost.usd;
        acc.creditSum += r.cost.credits;
        acc.costN++;
      }
      if (typeof r.manualRating === 'number' && r.manualRating > 0) {
        acc.ratingSum += r.manualRating;
        acc.ratingN++;
      }
      if (r.judge && r.judge.score > 0) {
        acc.judgeSum += r.judge.score;
        acc.judgeN++;
      }
    }
  }

  const stats: ModelStat[] = [];
  for (const [modelId, a] of map) {
    stats.push({
      modelId,
      modelName: a.name,
      runs: a.appearances,
      errorRate: a.appearances ? a.errors / a.appearances : 0,
      avgLatencyMs: a.latencyN ? a.latencySum / a.latencyN : null,
      avgTokensPerSec: a.tpsN ? a.tpsSum / a.tpsN : null,
      avgCostUsd: a.costN ? a.costSum / a.costN : null,
      avgCredits: a.costN ? a.creditSum / a.costN : null,
      winRate: a.appearances ? a.wins / a.appearances : 0,
      avgRating: a.ratingN ? a.ratingSum / a.ratingN : null,
      ratedCount: a.ratingN,
      avgJudge: a.judgeN ? a.judgeSum / a.judgeN : null,
      judgedCount: a.judgeN
    });
  }

  stats.sort((x, y) => y.runs - x.runs || x.modelName.localeCompare(y.modelName));
  return stats;
}

/**
 * Average observed output tokens per model across saved runs (successful,
 * non-empty responses only). Used to sharpen the pre-run cost estimate instead
 * of a flat default. Models with no history are simply absent from the map.
 */
export function averageOutputTokens(records: RunRecord[]): Map<string, number> {
  const sum = new Map<string, number>();
  const count = new Map<string, number>();
  for (const record of records) {
    for (const r of record.results) {
      if (r.error) continue;
      const out = r.tokens?.output ?? 0;
      if (out <= 0) continue;
      sum.set(r.modelId, (sum.get(r.modelId) ?? 0) + out);
      count.set(r.modelId, (count.get(r.modelId) ?? 0) + 1);
    }
  }
  const avg = new Map<string, number>();
  for (const [modelId, total] of sum) {
    const n = count.get(modelId) ?? 0;
    if (n > 0) avg.set(modelId, Math.round(total / n));
  }
  return avg;
}

export interface OutputTokenEstimate {
  expected: number;
  low: number;
  high: number;
  sampleCount: number;
}

function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 1) return sorted[0];
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return Math.round(sorted[lower] * (1 - weight) + sorted[upper] * weight);
}

/**
 * Robust observed output-token estimates per model. The median limits the
 * impact of unusually long responses; the quartiles provide a likely range.
 */
export function estimateOutputTokens(records: RunRecord[]): Map<string, OutputTokenEstimate> {
  const samples = new Map<string, number[]>();
  for (const record of records) {
    for (const result of record.results) {
      if (result.error) continue;
      const outputTokens = result.tokens?.output ?? 0;
      if (outputTokens <= 0) continue;
      const modelSamples = samples.get(result.modelId) ?? [];
      modelSamples.push(outputTokens);
      samples.set(result.modelId, modelSamples);
    }
  }

  const estimates = new Map<string, OutputTokenEstimate>();
  for (const [modelId, values] of samples) {
    values.sort((a, b) => a - b);
    estimates.set(modelId, {
      expected: percentile(values, 0.5),
      low: percentile(values, 0.25),
      high: percentile(values, 0.75),
      sampleCount: values.length
    });
  }
  return estimates;
}
