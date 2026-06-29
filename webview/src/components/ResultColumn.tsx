import type { ColumnState } from '../state';
import { Badge } from './Badge';
import { StarRating } from './StarRating';
import { formatCredits, formatLatency, formatTokens, formatUsd } from '../format';

interface ResultColumnProps {
  title: string;
  subtitle?: string;
  column: ColumnState;
  isCheapest?: boolean;
  isFastest?: boolean;
  isHighestRated?: boolean;
  isWinner?: boolean;
  readOnly?: boolean;
  onRate?: (value: number | null) => void;
  onPickWinner?: () => void;
}

const statusDot: Record<ColumnState['status'], string> = {
  idle: 'bg-vscode-desc',
  streaming: 'bg-vscode-link animate-pulse',
  done: 'bg-green-500',
  error: 'bg-red-500'
};

export function ResultColumn({
  title,
  subtitle,
  column,
  isCheapest,
  isFastest,
  isHighestRated,
  isWinner,
  readOnly,
  onRate,
  onPickWinner
}: ResultColumnProps) {
  const { status, text, result, error } = column;
  const cost = result?.cost;
  const judge = result?.judge;
  const verify = result?.verify;
  const showFooter = Boolean(result) && status !== 'error';

  return (
    <div
      className={`flex min-w-[300px] flex-1 flex-col rounded border bg-vscode-panel-bg ${
        isWinner ? 'border-yellow-400' : 'border-vscode-border'
      }`}
    >
      <div className="flex flex-col gap-1.5 border-b border-vscode-border p-2.5">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusDot[status]}`} />
          <span className="truncate font-semibold" title={title}>
            {title}
          </span>
          <div className="ml-auto flex shrink-0 gap-1">
            {isWinner && <span title="Picked winner">👑</span>}
            {isFastest && <span title="Fastest">⚡</span>}
            {isCheapest && <span title="Cheapest">💰</span>}
            {isHighestRated && <span title="Highest rated">⭐</span>}
          </div>
        </div>
        {subtitle && <span className="truncate text-[11px] text-vscode-desc">{subtitle}</span>}

        <div className="flex flex-wrap gap-1">
          {result && (
            <>
              <Badge
                label="latency"
                value={formatLatency(result.latencyMs)}
                title={`Total latency — time from sending the request until the full response finished streaming (${formatLatency(
                  result.latencyMs
                )}).`}
              />
              {result.timeToFirstTokenMs !== null && (
                <Badge
                  label="ttft"
                  value={formatLatency(result.timeToFirstTokenMs)}
                  title={`Time to first token — how long until the model produced its first token, i.e. how responsive it felt (${formatLatency(
                    result.timeToFirstTokenMs
                  )}).`}
                />
              )}
              <Badge
                label="in"
                value={formatTokens(result.tokens.input)}
                title={`Input tokens — the prompt plus any included repo context sent to the model (${formatTokens(
                  result.tokens.input
                )} tokens).`}
              />
              <Badge
                label="out"
                value={formatTokens(result.tokens.output)}
                title={`Output tokens — tokens the model generated in its response (${formatTokens(
                  result.tokens.output
                )} tokens).`}
              />
            </>
          )}
          {cost && cost.rateAvailable && (
            <>
              <Badge
                label="cost"
                value={formatUsd(cost.usd)}
                tone="info"
                title={`Token cost (USD) — input ${formatUsd(cost.inputUsd)} + output ${formatUsd(
                  cost.outputUsd
                )} = ${formatUsd(cost.usd)}${
                  cost.longContext ? ' · long-context tier applied' : ''
                }. Estimate based on Copilot usage-based rates.`}
              />
              <Badge
                label="credits"
                value={formatCredits(cost.credits)}
                tone="info"
                title={`GitHub AI credits — the same cost billed as credits, where 1 credit = $0.01 (${formatCredits(
                  cost.credits
                )} credits ≈ ${formatUsd(cost.usd)}).`}
              />
            </>
          )}
          {cost && !cost.rateAvailable && (
            <Badge
              label="cost"
              value="rate n/a"
              tone="warn"
              title="No cost — this model isn't in the pricing table, so its rate is unavailable."
            />
          )}
        </div>
      </div>

      <div className="min-h-[120px] flex-1 p-2.5">
        {status === 'error' ? (
          <div className="rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-vscode-error">
            <div className="font-semibold">Request failed</div>
            <div className="mt-1 whitespace-pre-wrap break-words">{error?.message}</div>
            {error?.code && <div className="mt-1 opacity-70">code: {error.code}</div>}
          </div>
        ) : text ? (
          <pre className="whitespace-pre-wrap [overflow-wrap:anywhere] break-words font-mono text-xs leading-relaxed">
            {text}
            {status === 'streaming' && <span className="ml-0.5 inline-block animate-pulse">▋</span>}
          </pre>
        ) : status === 'streaming' || status === 'idle' ? (
          <div className="text-xs text-vscode-desc">Waiting for response…</div>
        ) : (
          <div className="text-xs text-vscode-desc">No output.</div>
        )}
      </div>

      {showFooter && (
        <div className="flex flex-col gap-1.5 border-t border-vscode-border p-2.5">
          {verify && (
            <details className="rounded bg-vscode-bg text-[11px]">
              <summary className="cursor-pointer select-none p-1.5">
                <span className="font-semibold">Verify</span>{' '}
                {verify.passed ? (
                  <span className="rounded bg-green-600/80 px-1.5 py-0.5 text-white">✓ pass</span>
                ) : (
                  <span className="rounded bg-red-600/80 px-1.5 py-0.5 text-white">
                    ✗ fail{verify.exitCode !== null ? ` (exit ${verify.exitCode})` : ''}
                  </span>
                )}
                <span className="ml-1 text-vscode-desc">{verify.command}</span>
              </summary>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words border-t border-vscode-border p-1.5 font-mono text-[10px] text-vscode-desc">
                {verify.log}
              </pre>
            </details>
          )}
          {judge && (
            <div className="rounded bg-vscode-bg p-1.5 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold">Judge</span>
                {judge.score > 0 ? (
                  <span className="rounded bg-blue-600/80 px-1.5 py-0.5 text-white">
                    {judge.score}/10
                  </span>
                ) : (
                  <span className="text-yellow-500">unscored</span>
                )}
              </div>
              {judge.rationale && (
                <p className="mt-1 text-vscode-desc">{judge.rationale}</p>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <StarRating
              value={result?.manualRating ?? null}
              onRate={(v) => onRate?.(v)}
              disabled={readOnly}
            />
            {readOnly ? (
              isWinner && <span className="ml-auto text-[11px]">👑 Winner</span>
            ) : (
              <button
                className={`ml-auto rounded px-2 py-0.5 text-[11px] ${
                  isWinner
                    ? 'bg-yellow-400/90 text-black'
                    : 'border border-vscode-border hover:bg-vscode-list-hover'
                }`}
                onClick={() => onPickWinner?.()}
              >
                {isWinner ? '👑 Winner' : 'Pick winner'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
