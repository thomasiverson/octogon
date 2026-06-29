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
