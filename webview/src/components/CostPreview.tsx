import type { CostEstimate } from '../../../src/shared/types';
import { formatCredits, formatTokens, formatUsd } from '../format';

interface CostPreviewProps {
  estimates: CostEstimate[];
  totalUsd: number;
  lowTotalUsd: number;
  highTotalUsd: number;
  totalCredits: number;
  lowTotalCredits: number;
  highTotalCredits: number;
  expectedOutputTokens: number;
  mode?: 'ask' | 'agent';
  nameFor: (id: string) => string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CostPreview({
  estimates,
  totalUsd,
  lowTotalUsd,
  highTotalUsd,
  totalCredits,
  lowTotalCredits,
  highTotalCredits,
  expectedOutputTokens,
  mode,
  nameFor,
  onConfirm,
  onCancel
}: CostPreviewProps) {
  const anyUnavailable = estimates.some((e) => !e.rateAvailable);
  const anyTokenCountUnavailable = estimates.some((e) => !e.inputTokensAvailable);
  const hasRange = lowTotalUsd !== highTotalUsd;

  return (
    <div className="rounded border border-vscode-link/50 bg-vscode-panel-bg p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">Estimated cost for this run</span>
        <span className="rounded bg-yellow-600/80 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white">
          estimate
        </span>
        <span className="ml-auto text-sm">
          ≈ <span className="font-semibold tabular-nums">{formatUsd(totalUsd)}</span>
          <span className="text-vscode-desc"> · {formatCredits(totalCredits)} credits</span>
        </span>
      </div>

      <p className="mt-1 text-[11px] text-vscode-desc">
        Measured input tokens + estimated output per model (from your run history when available,
        otherwise ~{formatTokens(expectedOutputTokens)}). Running consumes real tokens/credits; the
        exact cost is shown after the run.
      </p>

      {hasRange && (
        <p className="mt-1 text-[11px] text-vscode-desc">
          Likely range: {formatUsd(lowTotalUsd)}–{formatUsd(highTotalUsd)} ·{' '}
          {formatCredits(lowTotalCredits)}–{formatCredits(highTotalCredits)} credits
        </p>
      )}

      <div className="mt-2 flex flex-col gap-1">
        {estimates.map((e) => (
          <div key={e.modelId} className="flex items-center gap-2 text-xs">
            <span className="flex-1 truncate">{nameFor(e.modelId)}</span>
            <span className="tabular-nums text-vscode-desc">
              {e.inputTokensAvailable ? `${formatTokens(e.inputTokens)} in` : 'input count n/a'}
            </span>
            <span
              className="tabular-nums text-vscode-desc"
              title={
                e.outputEstimateSource === 'history'
                  ? `Median and likely range from ${e.outputSampleCount} successful prior run${e.outputSampleCount === 1 ? '' : 's'}`
                  : `Configured default (${formatTokens(expectedOutputTokens)} tokens)`
              }
            >
              ~{formatTokens(e.expectedOutputTokens)} out
              {e.lowOutputTokens !== e.highOutputTokens &&
                ` (${formatTokens(e.lowOutputTokens)}–${formatTokens(e.highOutputTokens)})`}
              {' · '}
              {e.outputEstimateSource === 'history'
                ? `${e.outputSampleCount} prior run${e.outputSampleCount === 1 ? '' : 's'}`
                : 'configured default'}
            </span>
            {!e.rateAvailable ? (
              <span className="text-yellow-500">rate n/a</span>
            ) : !e.inputTokensAvailable ? (
              <span className="text-yellow-500">cost unavailable</span>
            ) : (
              <span className="tabular-nums">
                {formatUsd(e.usd)} · {formatCredits(e.credits)} cr
              </span>
            )}
          </div>
        ))}
      </div>

      {anyUnavailable && (
        <p className="mt-1 text-[11px] text-yellow-500">
          Some models are missing from the pricing table; their cost is excluded from the total.
        </p>
      )}

      {anyTokenCountUnavailable && (
        <p className="mt-1 text-[11px] text-yellow-500">
          Input token counting failed for some models; their cost is excluded rather than shown as zero.
        </p>
      )}

      {mode === 'agent' && (
        <p className="mt-1 text-[11px] text-yellow-500">
          Agent mode can make multiple model calls. This preview covers one response; the full run may cost more.
        </p>
      )}

      <p className="mt-1 text-[11px] text-vscode-desc">
        The optional LLM judge runs after the comparison and consumes additional tokens/credits.
      </p>

      <div className="mt-3 flex gap-2">
        <button
          className="rounded bg-vscode-btn-bg px-3 py-1.5 text-vscode-btn-fg hover:bg-vscode-btn-hover"
          onClick={onConfirm}
        >
          Confirm &amp; run
        </button>
        <button
          className="rounded bg-vscode-btn-sec-bg px-3 py-1.5 text-vscode-btn-sec-fg hover:opacity-90"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
