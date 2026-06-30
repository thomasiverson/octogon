import { useMemo, useState } from 'react';
import type { ModelStat } from '../../../src/shared/types';
import { formatLatency, formatPercent, formatThroughput, formatUsd } from '../format';

interface ModelStatsPanelProps {
  stats: ModelStat[];
  onRefresh: () => void;
  onClose: () => void;
}

function num(value: number | null, fmt: (n: number) => string): string {
  return value === null ? '—' : fmt(value);
}

type SortKey =
  | 'modelName'
  | 'runs'
  | 'winRate'
  | 'avgLatencyMs'
  | 'avgTokensPerSec'
  | 'avgCostUsd'
  | 'avgRating'
  | 'avgJudge'
  | 'errorRate';

interface SortState {
  key: SortKey;
  dir: 'asc' | 'desc';
}

const COLUMNS: { key: SortKey; label: string; title?: string }[] = [
  { key: 'modelName', label: 'Model' },
  { key: 'runs', label: 'Runs', title: 'Saved responses' },
  { key: 'winRate', label: 'Win%', title: 'Picked as winner' },
  { key: 'avgLatencyMs', label: 'Avg latency' },
  { key: 'avgTokensPerSec', label: 'Avg speed', title: 'Output tokens/sec' },
  { key: 'avgCostUsd', label: 'Avg cost' },
  { key: 'avgRating', label: 'Rating', title: 'Manual rating (1–5)' },
  { key: 'avgJudge', label: 'Judge', title: 'LLM judge (1–10)' },
  { key: 'errorRate', label: 'Err%', title: 'Errored responses' }
];

export function ModelStatsPanel({ stats, onRefresh, onClose }: ModelStatsPanelProps) {
  const [sort, setSort] = useState<SortState>({ key: 'runs', dir: 'desc' });

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'modelName' ? 'asc' : 'desc' }
    );
  }

  const sorted = useMemo(() => {
    const arr = [...stats];
    const { key, dir } = sort;
    const factor = dir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      if (key === 'modelName') {
        return a.modelName.localeCompare(b.modelName) * factor;
      }
      const av = a[key] as number | null;
      const bv = b[key] as number | null;
      if (av === null && bv === null) return 0;
      if (av === null) return 1; // nulls always last
      if (bv === null) return -1;
      return (av - bv) * factor;
    });
    return arr;
  }, [stats, sort]);

  return (
    <div className="flex flex-col gap-2 rounded border border-vscode-border bg-vscode-panel-bg p-2.5">
      <div className="flex items-center gap-2">
        <span className="font-semibold">Model performance</span>
        <span className="text-xs text-vscode-desc">averaged across saved runs</span>
        <div className="ml-auto flex gap-2">
          <button className="text-xs text-vscode-link hover:underline" onClick={onRefresh}>
            Refresh
          </button>
          <button className="text-xs text-vscode-link hover:underline" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {stats.length === 0 ? (
        <p className="p-2 text-xs text-vscode-desc">
          No saved runs yet. Run and rate some comparisons to build performance history.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs tabular-nums">
            <thead className="text-vscode-desc">
              <tr className="border-b border-vscode-border">
                {COLUMNS.map((col, i) => {
                  const active = sort.key === col.key;
                  const last = i === COLUMNS.length - 1;
                  return (
                    <th
                      key={col.key}
                      title={col.title}
                      onClick={() => toggleSort(col.key)}
                      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className={`${last ? 'py-1' : 'py-1 pr-3'} cursor-pointer select-none font-medium hover:text-vscode-fg ${active ? 'text-vscode-fg' : ''}`}
                    >
                      <span className="inline-flex items-center gap-0.5">
                        {col.label}
                        <span className="text-[9px] leading-none opacity-80">
                          {active ? (sort.dir === 'asc' ? '▲' : '▼') : ''}
                        </span>
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.modelId} className="border-b border-vscode-border/50">
                  <td className="py-1 pr-3 font-medium" title={s.modelId}>
                    {s.modelName}
                  </td>
                  <td className="py-1 pr-3">{s.runs}</td>
                  <td className="py-1 pr-3">{formatPercent(s.winRate)}</td>
                  <td className="py-1 pr-3">{num(s.avgLatencyMs, formatLatency)}</td>
                  <td className="py-1 pr-3">{num(s.avgTokensPerSec, formatThroughput)}</td>
                  <td className="py-1 pr-3">{num(s.avgCostUsd, formatUsd)}</td>
                  <td className="py-1 pr-3">
                    {s.avgRating === null ? '—' : `${s.avgRating.toFixed(1)}/5`}
                  </td>
                  <td className="py-1 pr-3">
                    {s.avgJudge === null ? '—' : `${s.avgJudge.toFixed(1)}/10`}
                  </td>
                  <td className={`py-1 ${s.errorRate > 0 ? 'text-yellow-500' : ''}`}>
                    {formatPercent(s.errorRate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
