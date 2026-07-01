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
