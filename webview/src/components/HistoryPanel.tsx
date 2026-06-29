import { useState } from 'react';
import type { RunSummary } from '../../../src/shared/types';
import { formatCredits, formatUsd } from '../format';

interface HistoryPanelProps {
  runs: RunSummary[];
  onReload: (id: string) => void;
  onExport: (id: string, format: 'json' | 'markdown') => void;
  onClear: () => void;
  onClose: () => void;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString();
}

export function HistoryPanel({ runs, onReload, onExport, onClear, onClose }: HistoryPanelProps) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });

  const compareRuns =
    selected.length === 2
      ? (selected.map((id) => runs.find((r) => r.id === id)).filter(Boolean) as RunSummary[])
      : [];

  return (
    <div className="flex max-h-[60vh] flex-col gap-2 rounded border border-vscode-border bg-vscode-panel-bg p-2.5">
      <div className="flex items-center gap-2">
        <span className="font-semibold">Run history</span>
        <span className="text-xs text-vscode-desc">{runs.length} saved</span>
        <div className="ml-auto flex gap-2">
          <button
            className="text-xs text-vscode-link hover:underline disabled:opacity-50"
            onClick={onClear}
            disabled={runs.length === 0}
          >
            Clear all
          </button>
          <button className="text-xs text-vscode-link hover:underline" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {compareRuns.length === 2 && (
        <div className="rounded border border-vscode-link/40 bg-vscode-bg p-2 text-xs">
          <div className="mb-1 font-semibold">Compare</div>
          <div className="grid grid-cols-3 gap-1">
            <span className="text-vscode-desc">metric</span>
            <span className="truncate" title={compareRuns[0].promptSnippet}>
              {formatDate(compareRuns[0].timestamp)}
            </span>
            <span className="truncate" title={compareRuns[1].promptSnippet}>
              {formatDate(compareRuns[1].timestamp)}
            </span>
            <span className="text-vscode-desc">total cost</span>
            <span className="tabular-nums">{formatUsd(compareRuns[0].totalUsd)}</span>
            <span className="tabular-nums">{formatUsd(compareRuns[1].totalUsd)}</span>
            <span className="text-vscode-desc">credits</span>
            <span className="tabular-nums">{formatCredits(compareRuns[0].totalCredits)}</span>
            <span className="tabular-nums">{formatCredits(compareRuns[1].totalCredits)}</span>
            <span className="text-vscode-desc">models</span>
            <span className="tabular-nums">{compareRuns[0].modelIds.length}</span>
            <span className="tabular-nums">{compareRuns[1].modelIds.length}</span>
            <span className="text-vscode-desc">winner</span>
            <span className="truncate">
              {compareRuns[0].winner
                ? compareRuns[0].modelNames[compareRuns[0].modelIds.indexOf(compareRuns[0].winner)] ??
                  compareRuns[0].winner
                : '—'}
            </span>
            <span className="truncate">
              {compareRuns[1].winner
                ? compareRuns[1].modelNames[compareRuns[1].modelIds.indexOf(compareRuns[1].winner)] ??
                  compareRuns[1].winner
                : '—'}
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1 overflow-y-auto">
        {runs.length === 0 ? (
          <p className="p-2 text-xs text-vscode-desc">No saved runs yet. Run a comparison to start your history.</p>
        ) : (
          runs.map((run) => (
            <div
              key={run.id}
              className="flex items-center gap-2 rounded border border-vscode-border px-2 py-1.5 text-xs hover:bg-vscode-list-hover"
            >
              <input
                type="checkbox"
                title="Select for compare"
                checked={selected.includes(run.id)}
                onChange={() => toggleSelect(run.id)}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate" title={run.promptSnippet}>
                  {run.promptSnippet || '(empty prompt)'}
                </div>
                <div className="flex flex-wrap gap-x-2 text-[11px] text-vscode-desc">
                  <span>{formatDate(run.timestamp)}</span>
                  <span>· {run.modelNames.join(', ')}</span>
                  {run.totalUsd > 0 && <span>· {formatUsd(run.totalUsd)}</span>}
                  {run.winner && <span>· 👑 winner</span>}
                </div>
              </div>
              <button
                className="rounded border border-vscode-border px-2 py-0.5 hover:bg-vscode-list-active"
                onClick={() => onReload(run.id)}
              >
                Load
              </button>
              <button
                className="rounded px-1.5 py-0.5 text-vscode-link hover:underline"
                onClick={() => onExport(run.id, 'json')}
              >
                JSON
              </button>
              <button
                className="rounded px-1.5 py-0.5 text-vscode-link hover:underline"
                onClick={() => onExport(run.id, 'markdown')}
              >
                MD
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
