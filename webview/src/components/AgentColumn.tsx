import { useState } from 'react';
import type { AgentLeaderboard } from '../../../src/shared/types';
import type { ColumnState } from '../state';
import { Badge } from './Badge';
import { Markdown } from './Markdown';
import { formatCredits, formatLatency, formatTokens, formatUsd } from '../format';

interface AgentColumnProps {
  title: string;
  subtitle?: string;
  column: ColumnState;
  board?: AgentLeaderboard;
  readOnly?: boolean;
  onApply?: () => void;
  onPreview?: () => void;
}

const statusDot: Record<ColumnState['status'], string> = {
  idle: 'bg-vscode-desc',
  streaming: 'bg-vscode-link animate-pulse',
  done: 'bg-green-500',
  error: 'bg-red-500'
};

const stopReasonTone: Record<string, string> = {
  finished: 'bg-green-600/80',
  'max-iterations': 'bg-yellow-600/80',
  timeout: 'bg-yellow-600/80',
  cancelled: 'bg-vscode-desc/60',
  'token-budget': 'bg-yellow-600/80',
  error: 'bg-red-600/80'
};

const toolIcon: Record<string, string> = {
  list_files: '📁',
  read_file: '📄',
  write_file: '✏️',
  run_command: '▶️',
  finish: '✅'
};

export function AgentColumn({ title, subtitle, column, board, readOnly, onApply, onPreview }: AgentColumnProps) {
  const [showSteps, setShowSteps] = useState(false);
  const { status, text, agentResult, error, steps } = column;
  const result = agentResult;
  const isRecommended = board?.recommended?.modelId === column.modelId;
  const cost = result?.cost;
  const verify = result?.verify;
  const diff = result?.diff;

  return (
    <div
      className={`flex min-w-[320px] flex-1 flex-col rounded border bg-vscode-panel-bg ${
        isRecommended ? 'border-yellow-400' : 'border-vscode-border'
      }`}
    >
      <div className="flex flex-col gap-1.5 border-b border-vscode-border p-2.5">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusDot[status]}`} />
          <span className="truncate font-semibold" title={title}>
            {title}
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {isRecommended && <span title="Recommended winner">🏆</span>}
            {board?.passedTests?.modelId === column.modelId && <span title="Tests passed">✅</span>}
            {board?.smallestDiff?.modelId === column.modelId && <span title="Smallest diff">📏</span>}
            {board?.cheapest?.modelId === column.modelId && <span title="Cheapest">💰</span>}
          </div>
        </div>
        {subtitle && <span className="truncate text-[11px] text-vscode-desc">{subtitle}</span>}

        <div className="flex flex-wrap gap-1">
          {result && (
            <>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] text-white ${
                  stopReasonTone[result.stopReason] ?? 'bg-vscode-desc/60'
                }`}
                title="Why the agent loop stopped"
              >
                {result.stopReason}
              </span>
              <Badge label="iters" value={String(result.iterations)} title="Tool-call iterations" />
              <Badge label="files" value={String(result.filesChanged)} title="Files changed in the sandbox" />
              {diff && (
                <Badge
                  label="lines"
                  value={`+${diff.additions} / -${diff.deletions}`}
                  title="Lines added / removed across the diff"
                />
              )}
              <Badge label="latency" value={formatLatency(result.latencyMs)} title="Total agent run time" />
              <Badge
                label="tokens"
                value={`${formatTokens(result.tokens.input)} / ${formatTokens(result.tokens.output)}`}
                title="Approx input context / generated tokens"
              />
              {cost && cost.rateAvailable && (
                <>
                  <Badge label="cost" value={formatUsd(cost.usd)} tone="info" title="Estimated token cost" />
                  <Badge
                    label="credits"
                    value={formatCredits(cost.credits)}
                    tone="info"
                    title="GitHub AI credits (1 credit = $0.01)"
                  />
                </>
              )}
              {verify && (
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] text-white ${
                    verify.passed ? 'bg-green-600/80' : 'bg-red-600/80'
                  }`}
                  title={verify.command}
                >
                  {verify.passed ? '✓ tests pass' : `✗ tests fail${verify.exitCode !== null ? ` (${verify.exitCode})` : ''}`}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <div className="min-h-[120px] flex-1 p-2.5">
        {status === 'error' ? (
          <div className="rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-vscode-error">
            <div className="font-semibold">Agent failed</div>
            <div className="mt-1 whitespace-pre-wrap break-words">{error?.message}</div>
          </div>
        ) : text ? (
          status === 'done' ? (
            <Markdown content={text} />
          ) : (
            <pre className="whitespace-pre-wrap [overflow-wrap:anywhere] break-words font-mono text-xs leading-relaxed">
              {text}
              <span className="ml-0.5 inline-block animate-pulse">▋</span>
            </pre>
          )
        ) : status === 'streaming' || status === 'idle' ? (
          <div className="text-xs text-vscode-desc">Agent working…</div>
        ) : (
          <div className="text-xs text-vscode-desc">No narration.</div>
        )}
      </div>

      <div className="flex flex-col gap-1.5 border-t border-vscode-border p-2.5">
        {steps && steps.length > 0 && (
          <details
            className="rounded bg-vscode-bg text-[11px]"
            open={showSteps}
            onToggle={(e) => setShowSteps((e.target as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer select-none p-1.5">
              <span className="font-semibold">Tool calls</span>{' '}
              <span className="text-vscode-desc">({steps.length})</span>
            </summary>
            <div className="max-h-56 overflow-auto border-t border-vscode-border">
              {steps.map((step, i) => (
                <div key={i} className="border-b border-vscode-border/50 px-1.5 py-1 last:border-b-0">
                  <div className="flex items-center gap-1.5">
                    <span>{toolIcon[step.tool] ?? '•'}</span>
                    <span className="font-mono font-semibold">{step.tool}</span>
                    {!step.ok && <span className="text-red-400">failed</span>}
                    <span className="ml-auto text-vscode-desc">#{step.iteration}</span>
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[10px] text-vscode-desc" title={step.args}>
                    {step.args}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}

        {diff && diff.files.length > 0 && (
          <details className="rounded bg-vscode-bg text-[11px]">
            <summary className="cursor-pointer select-none p-1.5">
              <span className="font-semibold">Diff</span>{' '}
              <span className="text-vscode-desc">
                {diff.filesChanged} file(s) · +{diff.additions} / -{diff.deletions}
              </span>
            </summary>
            <div className="max-h-48 overflow-auto border-t border-vscode-border p-1.5 font-mono text-[10px]">
              {diff.files.map((f) => (
                <div key={f.path} className="flex items-center gap-2">
                  <span className="truncate" title={f.path}>
                    {f.path}
                  </span>
                  <span className="ml-auto shrink-0 text-vscode-desc">
                    {f.binary ? 'binary' : `+${f.additions} / -${f.deletions}`}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}

        {result?.summary && (
          <div className="rounded bg-vscode-bg p-1.5 text-[11px]">
            <span className="font-semibold">Summary</span>
            <p className="mt-0.5 text-vscode-desc">{result.summary}</p>
          </div>
        )}

        {!readOnly && result && result.canApply && result.filesChanged > 0 && (
          <div className="flex gap-1.5">
            <button
              className="flex-1 rounded border border-vscode-border px-2 py-1 text-[11px] hover:bg-vscode-list-hover"
              onClick={() => onPreview?.()}
              title="Open this agent's full diff in an editor tab to read its actual code changes"
            >
              🔍 View diff
            </button>
            <button
              className={`flex-1 rounded px-2 py-1 text-[11px] ${
                isRecommended
                  ? 'bg-yellow-400/90 text-black'
                  : 'border border-vscode-border hover:bg-vscode-list-hover'
              }`}
              onClick={() => onApply?.()}
              title="Apply this agent's changes to your working tree (with confirmation)"
            >
              {isRecommended ? '🏆 Apply winner' : 'Apply changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
