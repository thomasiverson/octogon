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

export function ModelStatsPanel({ stats, onRefresh, onClose }: ModelStatsPanelProps) {
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
                <th className="py-1 pr-3 font-medium">Model</th>
                <th className="py-1 pr-3 font-medium" title="Saved responses">Runs</th>
                <th className="py-1 pr-3 font-medium" title="Picked as winner">Win%</th>
                <th className="py-1 pr-3 font-medium">Avg latency</th>
                <th className="py-1 pr-3 font-medium" title="Output tokens/sec">Avg speed</th>
                <th className="py-1 pr-3 font-medium">Avg cost</th>
                <th className="py-1 pr-3 font-medium" title="Manual rating (1–5)">Rating</th>
                <th className="py-1 pr-3 font-medium" title="LLM judge (1–10)">Judge</th>
                <th className="py-1 font-medium" title="Errored responses">Err%</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
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
