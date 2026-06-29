import type { Leaderboard as LeaderboardData } from '../../../src/shared/types';
import { formatLatency, formatUsd } from '../format';

interface LeaderboardProps {
  leaderboard: LeaderboardData;
  nameFor: (id: string) => string;
}

export function Leaderboard({ leaderboard, nameFor }: LeaderboardProps) {
  const items: { key: string; icon: string; label: string; modelId: string; value: string }[] = [];

  if (leaderboard.cheapest) {
    items.push({
      key: 'cheapest',
      icon: '💰',
      label: 'Cheapest',
      modelId: leaderboard.cheapest.modelId,
      value: formatUsd(leaderboard.cheapest.value)
    });
  }
  if (leaderboard.fastest) {
    items.push({
      key: 'fastest',
      icon: '⚡',
      label: 'Fastest',
      modelId: leaderboard.fastest.modelId,
      value: formatLatency(leaderboard.fastest.value)
    });
  }
  if (leaderboard.highestRated) {
    items.push({
      key: 'rated',
      icon: '⭐',
      label: 'Highest rated',
      modelId: leaderboard.highestRated.modelId,
      value: String(leaderboard.highestRated.value)
    });
  }
  if (leaderboard.bestValue) {
    const unit = leaderboard.bestValue.basis === 'rating' ? '★' : 'pt';
    items.push({
      key: 'value',
      icon: '💎',
      label: 'Best value',
      modelId: leaderboard.bestValue.modelId,
      value: `${formatUsd(leaderboard.bestValue.value)}/${unit}`
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => (
        <div
          key={it.key}
          className="flex items-center gap-2 rounded border border-vscode-border bg-vscode-panel-bg px-2.5 py-1 text-xs"
        >
          <span>{it.icon}</span>
          <span className="text-vscode-desc">{it.label}</span>
          <span className="font-semibold">{nameFor(it.modelId)}</span>
          <span className="tabular-nums text-vscode-desc">{it.value}</span>
        </div>
      ))}
    </div>
  );
}
