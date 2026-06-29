// Shared types and the typed message protocol between the extension host and the
// webview. This module is imported by BOTH sides, so it must not import 'vscode'
// or any browser-only API.

// ---------------------------------------------------------------------------
// Core data model
// ---------------------------------------------------------------------------

export interface ModelInfo {
  /** Opaque vscode.lm model id. */
  id: string;
  /** Model family (e.g. "gpt-4o", "claude-3.5-sonnet"). */
  family: string;
  /** Human-friendly name from the picker. */
  name: string;
  /** Vendor, e.g. "copilot". */
  vendor: string;
  /** Maximum input tokens (context window) reported by the model. */
  maxInputTokens: number;
  /** Input rate per 1M tokens (USD), resolved from the pricing table. */
  inputRate?: number;
  /** Output rate per 1M tokens (USD), resolved from the pricing table. */
  outputRate?: number;
}

export interface TokenCounts {
  input: number;
  output: number;
}

/** Token cost for a single model, in USD and GitHub AI credits. */
export interface CostBreakdown {
  usd: number;
  credits: number;
  inputUsd: number;
  outputUsd: number;
  /** False when the model was missing from the pricing table. */
  rateAvailable: boolean;
  /** True when the long-context tier was applied. */
  longContext: boolean;
  /** Pricing-table key the model id was normalized to (for transparency). */
  pricingKey?: string;
}

export interface JudgeScore {
  modelId: string;
  /** 1–10 score from the judge. */
  score: number;
  rationale: string;
}

export interface VerifyResult {
  modelId: string;
  passed: boolean;
  exitCode: number | null;
  command: string;
  /** Combined stdout/stderr (may be truncated). */
  log: string;
}

export interface ModelResult {
  modelId: string;
  output: string;
  tokens: TokenCounts;
  /** Total request duration in ms. */
  latencyMs: number;
  /** Time-to-first-token in ms (null if no token arrived). */
  timeToFirstTokenMs: number | null;
  cost?: CostBreakdown;
  error?: { message: string; code?: string };
  /** Manual 1–5 star rating, or null. */
  manualRating?: number | null;
  judge?: JudgeScore;
  verify?: VerifyResult;
}

/** A file or snippet that was folded into the prompt context. */
export interface ContextRef {
  path: string;
  tokens: number;
  source: 'active' | 'selection' | 'attached' | 'retrieval';
  /** Optional snippet preview (retrieval only). */
  preview?: string;
}

export interface ContextInfo {
  refs: ContextRef[];
  totalTokens: number;
  /** True when context was trimmed to fit the token budget. */
  trimmed: boolean;
  /** Token budget used (smallest selected model window minus reserves). */
  budget: number;
}

export interface RunOptions {
  /** Include the active editor file + selection. */
  useActiveFile: boolean;
  /** Absolute paths of manually attached files. */
  attachedFiles: string[];
  /** Enable lightweight retrieval. */
  useRetrieval: boolean;
  /** Override for retrieval top-K (falls back to the configured value). */
  retrievalTopK?: number;
  /** Optional reference answer for the judge. */
  referenceAnswer?: string;
}

export interface CostEstimate {
  modelId: string;
  usd: number;
  credits: number;
  inputTokens: number;
  expectedOutputTokens: number;
  rateAvailable: boolean;
}

export interface LeaderboardEntry {
  modelId: string;
  value: number;
}

export interface Leaderboard {
  cheapest?: LeaderboardEntry;
  fastest?: LeaderboardEntry;
  highestRated?: LeaderboardEntry;
  /** Lowest cost-per-quality (USD per rating star or judge point). */
  bestValue?: LeaderboardEntry & { basis: 'rating' | 'judge' };
}

/** Aggregate performance for one model across saved runs. */
export interface ModelStat {
  modelId: string;
  modelName: string;
  /** Number of saved responses for this model. */
  runs: number;
  /** Fraction of responses that errored (0..1). */
  errorRate: number;
  avgLatencyMs: number | null;
  avgTokensPerSec: number | null;
  avgCostUsd: number | null;
  avgCredits: number | null;
  /** Fraction of runs where this model was picked winner (0..1). */
  winRate: number;
  avgRating: number | null;
  ratedCount: number;
  avgJudge: number | null;
  judgedCount: number;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export const HISTORY_SCHEMA_VERSION = 1;

export interface RunRecord {
  version: number;
  id: string;
  timestamp: number;
  prompt: string;
  contextRefs: ContextRef[];
  modelIds: string[];
  /** Display names keyed by model id, captured at run time. */
  modelNames: Record<string, string>;
  results: ModelResult[];
  winner?: string | null;
}

export interface RunSummary {
  id: string;
  timestamp: number;
  promptSnippet: string;
  modelIds: string[];
  modelNames: string[];
  totalUsd: number;
  totalCredits: number;
  winner?: string | null;
}

// ---------------------------------------------------------------------------
// Config snapshot pushed to the webview
// ---------------------------------------------------------------------------

export interface OctogonConfig {
  expectedOutputTokens: number;
  retrievalTopK: number;
  judgeModelId: string;
  verifyCommand: string;
  pricingLastUpdated: string;
  aiCreditUsd: number;
}

// ---------------------------------------------------------------------------
// Messages: extension host -> webview
// ---------------------------------------------------------------------------

export type ExtensionToWebview =
  | { type: 'init'; models: ModelInfo[]; config: OctogonConfig }
  | { type: 'models'; models: ModelInfo[] }
  | { type: 'activeFile'; path: string | null }
  | { type: 'runStarted'; runId: string; modelIds: string[] }
  | { type: 'context'; runId: string; context: ContextInfo }
  | { type: 'modelStart'; runId: string; modelId: string }
  | { type: 'fragment'; runId: string; modelId: string; text: string }
  | { type: 'modelDone'; runId: string; modelId: string; result: ModelResult }
  | { type: 'modelError'; runId: string; modelId: string; message: string; code?: string }
  | { type: 'runComplete'; runId: string; leaderboard: Leaderboard }
  | { type: 'costPreview'; estimates: CostEstimate[]; totalUsd: number; totalCredits: number; expectedOutputTokens: number }
  | { type: 'judgeDone'; runId: string; scores: JudgeScore[] }
  | { type: 'judgeError'; runId: string; message: string }
  | { type: 'verifyDone'; runId: string; modelId: string; result: VerifyResult }
  | { type: 'verifyError'; runId: string; modelId: string; message: string }
  | { type: 'history'; runs: RunSummary[] }
  | { type: 'historyRun'; run: RunRecord }
  | { type: 'modelStats'; stats: ModelStat[] }
  | { type: 'attachedFiles'; files: string[] }
  | { type: 'notice'; level: 'info' | 'warn' | 'error'; message: string };

// ---------------------------------------------------------------------------
// Messages: webview -> extension host
// ---------------------------------------------------------------------------

export type WebviewToExtension =
  | { type: 'ready' }
  | { type: 'requestModels' }
  | { type: 'previewCost'; prompt: string; modelIds: string[]; options: RunOptions }
  | { type: 'run'; prompt: string; modelIds: string[]; options: RunOptions }
  | { type: 'cancel' }
  | { type: 'attachFiles' }
  | { type: 'clearAttached' }
  | { type: 'rate'; runId: string; modelId: string; rating: number | null }
  | { type: 'pickWinner'; runId: string; modelId: string | null }
  | { type: 'runJudge'; runId: string; referenceAnswer?: string }
  | { type: 'loadHistory' }
  | { type: 'reloadRun'; id: string }
  | { type: 'exportRun'; id: string; format: 'json' | 'markdown' }
  | { type: 'clearHistory' }
  | { type: 'loadModelStats' }
  | { type: 'runVerify'; runId: string; modelId?: string }
  | { type: 'log'; message: string };
