// Pure, vscode-free agent winner heuristics. Given each model's agent outcome,
// derive a cross-model leaderboard and a single recommended winner. Kept pure
// so it is unit-tested without the extension host.

import type { AgentLeaderboard, AgentResult } from '../shared/types';

function diffSize(r: AgentResult): number {
  return r.diff ? r.diff.additions + r.diff.deletions : 0;
}

function costUsd(r: AgentResult): number | null {
  return r.cost && r.cost.rateAvailable ? r.cost.usd : null;
}

/** True when the agent produced changes and did not error out. */
export function producedChanges(r: AgentResult): boolean {
  return !r.error && r.filesChanged > 0;
}

/**
 * Compute the agent leaderboard. "Recommended" prefers, in order:
 *   1. passed verify tests, then smallest diff, then cheapest;
 *   2. otherwise produced changes, then cheapest, then fewest iterations.
 */
export function rankAgents(results: AgentResult[]): AgentLeaderboard {
  const board: AgentLeaderboard = {};
  if (results.length === 0) return board;

  const changed = results.filter(producedChanges);

  // Smallest non-empty diff.
  for (const r of changed) {
    const value = diffSize(r);
    if (!board.smallestDiff || value < board.smallestDiff.value) {
      board.smallestDiff = { modelId: r.modelId, value };
    }
  }

  // Cheapest among results with a known cost.
  for (const r of changed) {
    const usd = costUsd(r);
    if (usd === null) continue;
    if (!board.cheapest || usd < board.cheapest.value) {
      board.cheapest = { modelId: r.modelId, value: usd };
    }
  }

  // Fewest iterations among results that produced changes.
  for (const r of changed) {
    if (!board.fewestIterations || r.iterations < board.fewestIterations.value) {
      board.fewestIterations = { modelId: r.modelId, value: r.iterations };
    }
  }

  // First model whose tests passed.
  const passed = results.filter((r) => r.verify?.passed);
  if (passed.length > 0) {
    board.passedTests = { modelId: passed[0].modelId };
  }

  board.recommended = recommend(results);
  return board;
}

function recommend(results: AgentResult[]): AgentLeaderboard['recommended'] {
  const passed = results.filter((r) => r.verify?.passed);
  const pool = passed.length > 0 ? passed : results.filter(producedChanges);
  if (pool.length === 0) return undefined;

  const basis = passed.length > 0 ? 'passed tests' : 'changed files';
  const sorted = [...pool].sort((a, b) => {
    // Cheapest first when both have a cost.
    const ca = costUsd(a);
    const cb = costUsd(b);
    if (ca !== null && cb !== null && ca !== cb) return ca - cb;
    if (ca !== null && cb === null) return -1;
    if (ca === null && cb !== null) return 1;
    // Then smallest diff.
    const da = diffSize(a);
    const db = diffSize(b);
    if (da !== db) return da - db;
    // Then fewest iterations.
    return a.iterations - b.iterations;
  });

  const winner = sorted[0];
  const detail = passed.length > 0 ? 'cheapest-to-green' : 'cheapest with smallest diff';
  return { modelId: winner.modelId, basis: `${basis} \u00b7 ${detail}` };
}
