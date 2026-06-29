import { ModelResult } from './types';

/**
 * Output tokens generated per second during streaming. Measured over the
 * generation window (total latency minus time-to-first-token) so a model's
 * "thinking" time before the first token doesn't deflate the rate. Returns null
 * when it can't be computed (errored, no output, or no measurable window).
 */
export function tokensPerSecond(result: ModelResult): number | null {
  if (result.error) return null;
  const out = result.tokens.output;
  if (out <= 0) return null;

  const ttft = result.timeToFirstTokenMs ?? 0;
  let windowMs = result.latencyMs - ttft;
  if (windowMs <= 0) windowMs = result.latencyMs;
  if (windowMs <= 0) return null;

  return out / (windowMs / 1000);
}
