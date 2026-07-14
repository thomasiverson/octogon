/** Small display formatters shared across webview components. */

export function formatLatency(ms: number): string {
  if (!Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function formatTokens(n: number): string {
  return n.toLocaleString();
}

export function formatContextWindow(tokens: number): string {
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}K ctx`;
  return `${tokens} ctx`;
}

export function formatUsd(usd: number): string {
  if (usd === 0) return '$0.00';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

export function formatCredits(credits: number): string {
  if (credits === 0) return '0';
  if (credits < 1) return credits.toFixed(2);
  return credits.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function formatThroughput(tps: number): string {
  if (tps >= 100) return `${Math.round(tps)} tok/s`;
  return `${tps.toFixed(1)} tok/s`;
}

/** Compact dollar amount for a per-1M-token rate (e.g. 0.25 → "$0.25", 15 → "$15"). */
export function formatRate(rate: number): string {
  if (rate < 1) return `$${rate.toFixed(rate < 0.1 ? 3 : 2)}`;
  return `$${Number.isInteger(rate) ? rate.toFixed(0) : rate.toFixed(2)}`;
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/** Anonymized column label for blind tests: 0 → "Model A", 1 → "Model B", … */
export function blindLabel(index: number): string {
  if (index < 0) return 'Model ?';
  const letter = String.fromCharCode(65 + (index % 26));
  const wrap = index >= 26 ? String(Math.floor(index / 26) + 1) : '';
  return `Model ${letter}${wrap}`;
}
