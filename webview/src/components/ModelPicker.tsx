import type { ModelInfo } from '../../../src/shared/types';
import { formatContextWindow } from '../format';

interface ModelPickerProps {
  models: ModelInfo[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  disabled: boolean;
}

export function ModelPicker({ models, selected, onToggle, disabled }: ModelPickerProps) {
  if (models.length === 0) {
    return (
      <p className="text-xs text-vscode-desc">
        No models available. Make sure GitHub Copilot is active, then click Refresh and grant model
        access when prompted.
      </p>
    );
  }

  return (
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
  );
}
