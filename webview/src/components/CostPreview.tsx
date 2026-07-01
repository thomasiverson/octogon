import type { CostEstimate } from '../../../src/shared/types';
import { formatCredits, formatTokens, formatUsd } from '../format';

interface CostPreviewProps {
  estimates: CostEstimate[];
  totalUsd: number;
  totalCredits: number;
  expectedOutputTokens: number;
  nameFor: (id: string) => string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CostPreview({
  estimates,
  totalUsd,
  totalCredits,
  expectedOutputTokens,
  nameFor,
  onConfirm,
  onCancel
}: CostPreviewProps) {
  const anyUnavailable = estimates.some((e) => !e.rateAvailable);

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

      <div className="mt-2 flex flex-col gap-1">
        {estimates.map((e) => (
          <div key={e.modelId} className="flex items-center gap-2 text-xs">
            <span className="flex-1 truncate">{nameFor(e.modelId)}</span>
            <span className="tabular-nums text-vscode-desc">{formatTokens(e.inputTokens)} in</span>
            <span className="tabular-nums text-vscode-desc">~{formatTokens(e.expectedOutputTokens)} out</span>
            {e.rateAvailable ? (
              <span className="tabular-nums">
                {formatUsd(e.usd)} · {formatCredits(e.credits)} cr
              </span>
            ) : (
              <span className="text-yellow-500">rate n/a</span>
            )}
          </div>
        ))}
      </div>

      {anyUnavailable && (
        <p className="mt-1 text-[11px] text-yellow-500">
          Some models are missing from the pricing table; their cost is excluded from the total.
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
