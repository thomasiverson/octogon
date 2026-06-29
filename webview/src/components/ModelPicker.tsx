import type { ModelInfo } from '../../../src/shared/types';
import { formatContextWindow } from '../format';

interface ModelPickerProps {
  models: ModelInfo[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onRefresh: () => void;
  disabled: boolean;
}

export function ModelPicker({
  models,
  selected,
  onToggle,
  onRefresh,
  disabled
}: ModelPickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-vscode-desc">
          Models{selected.size > 0 ? ` · ${selected.size} selected` : ''}
        </span>
        <button
          className="rounded px-2 py-0.5 text-xs text-vscode-link hover:bg-vscode-list-hover disabled:opacity-50"
          onClick={onRefresh}
          disabled={disabled}
        >
          Refresh
        </button>
      </div>

      {models.length === 0 ? (
        <p className="rounded border border-vscode-border bg-vscode-panel-bg p-2 text-xs text-vscode-desc">
          No models available. Make sure GitHub Copilot is active, then click Refresh and
          grant model access when prompted.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {models.map((model) => {
            const isSelected = selected.has(model.id);
            return (
              <button
                key={model.id}
                onClick={() => onToggle(model.id)}
                disabled={disabled}
                title={`${model.vendor} · ${model.family}`}
                className={`flex items-center gap-1.5 rounded border px-2 py-1 text-xs transition-colors disabled:opacity-50 ${
                  isSelected
                    ? 'border-vscode-link bg-vscode-list-active'
                    : 'border-vscode-border bg-vscode-panel-bg hover:bg-vscode-list-hover'
                }`}
              >
                <span
                  className={`flex h-3.5 w-3.5 items-center justify-center rounded-sm border text-[9px] ${
                    isSelected ? 'border-vscode-link bg-vscode-link text-white' : 'border-vscode-desc'
                  }`}
                >
                  {isSelected ? '✓' : ''}
                </span>
                <span className="font-medium">{model.name}</span>
                <span className="opacity-60">{formatContextWindow(model.maxInputTokens)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
