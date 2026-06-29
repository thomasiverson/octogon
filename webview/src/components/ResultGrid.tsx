import type { Leaderboard } from '../../../src/shared/types';
import type { Columns } from '../state';
import { ResultColumn } from './ResultColumn';

interface TitleInfo {
  title: string;
  subtitle?: string;
}

interface ResultGridProps {
  order: string[];
  columns: Columns;
  titleFor: (id: string) => TitleInfo;
  leaderboard?: Leaderboard;
  winner: string | null;
  readOnly?: boolean;
  onRate: (modelId: string, rating: number | null) => void;
  onPickWinner: (modelId: string) => void;
}

export function ResultGrid({
  order,
  columns,
  titleFor,
  leaderboard,
  winner,
  readOnly,
  onRate,
  onPickWinner
}: ResultGridProps) {
  if (order.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center rounded border border-dashed border-vscode-border p-8 text-center text-sm text-vscode-desc">
        Select models and run a prompt to see responses side by side.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2">
      {order.map((id) => {
        const col = columns[id] ?? { modelId: id, status: 'idle' as const, text: '' };
        const info = titleFor(id);
        return (
          <ResultColumn
            key={id}
            title={info.title}
            subtitle={info.subtitle}
            column={col}
            isFastest={leaderboard?.fastest?.modelId === id}
            isCheapest={leaderboard?.cheapest?.modelId === id}
            isHighestRated={leaderboard?.highestRated?.modelId === id}
            isWinner={winner === id}
            readOnly={readOnly}
            onRate={(rating) => onRate(id, rating)}
            onPickWinner={() => onPickWinner(id)}
          />
        );
      })}
    </div>
  );
}
