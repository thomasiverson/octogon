import type { AgentLeaderboard } from '../../../src/shared/types';
import type { Columns } from '../state';
import { AgentColumn } from './AgentColumn';

interface TitleInfo {
  title: string;
  subtitle?: string;
}

interface AgentGridProps {
  order: string[];
  columns: Columns;
  titleFor: (id: string) => TitleInfo;
  board?: AgentLeaderboard;
  /** Anonymized blind run: hide identities, metrics, and the leaderboard until reveal. */
  blind?: boolean;
  readOnly?: boolean;
  onApply: (modelId: string) => void;
  onPreview: (modelId: string) => void;
}

export function AgentGrid({ order, columns, titleFor, board, blind, readOnly, onApply, onPreview }: AgentGridProps) {
  if (order.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded border border-dashed border-vscode-border p-8 text-center text-sm text-vscode-desc">
        Select models and describe a coding task to run the agent bake-off.
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 overflow-x-auto pb-2">
      {order.map((id) => {
        const col = columns[id] ?? { modelId: id, status: 'idle' as const, text: '' };
        const info = titleFor(id);
        return (
          <AgentColumn
            key={id}
            title={info.title}
            subtitle={info.subtitle}
            column={col}
            board={board}
            blind={blind}
            readOnly={readOnly}
            onApply={() => onApply(id)}
            onPreview={() => onPreview(id)}
          />
        );
      })}
    </div>
  );
}
