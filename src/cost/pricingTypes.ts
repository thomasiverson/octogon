// Pricing types with no 'vscode' dependency so cost logic stays unit-testable.

/** One model's usage-based rates, per 1M tokens. Mirrors model-pricing.json. */
export interface ModelRate {
  provider: string;
  input: number;
  cachedInput: number;
  output: number;
  /** Anthropic cache-write rate (optional). */
  cacheWrite?: number;
  /** Higher-rate tier applied above an input-token threshold. */
  longContext?: {
    thresholdInputTokens: number;
    input: number;
    cachedInput: number;
    output: number;
  };
}

export interface PricingTable {
  source: string;
  lastUpdated: string;
  billingModel?: string;
  currency: string;
  unit: string;
  /** USD per GitHub AI credit (1 credit = $0.01). */
  aiCreditUsd: number;
  notes?: string[];
  models: Record<string, ModelRate>;
}
