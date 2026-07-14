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
  blind?: boolean;
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
  blind,
  onRate,
  onPickWinner
}: ResultGridProps) {
  if (order.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded border border-dashed border-vscode-border p-8 text-center text-sm text-vscode-desc">
        Select models and run a prompt to see responses side by side.
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 overflow-x-auto pb-2">
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
            blind={blind}
            onRate={(rating) => onRate(id, rating)}
            onPickWinner={() => onPickWinner(id)}
          />
        );
      })}
    </div>
  );
}
