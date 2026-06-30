import type { ModelInfo } from '../../../src/shared/types';
import { formatContextWindow, formatRate } from '../format';

interface ModelPickerProps {
  models: ModelInfo[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  disabled: boolean;
}

const GROUP_ORDER = ['OpenAI', 'Anthropic', 'Google', 'Microsoft', 'GitHub', 'Other'];

/** Bucket a model under a provider, preferring the pricing table's provider. */
function providerGroup(model: ModelInfo): string {
  if (model.name.trim().toLowerCase() === 'auto') return 'Microsoft';

  const p = (model.provider ?? '').toLowerCase();
  if (p.includes('openai')) return 'OpenAI';
  if (p.includes('anthropic')) return 'Anthropic';
  if (p.includes('google')) return 'Google';
  if (p.includes('microsoft')) return 'Microsoft';
  if (p.includes('github')) return 'GitHub';

  const s = `${model.family} ${model.name}`.toLowerCase();
  if (s.includes('claude')) return 'Anthropic';
  if (s.includes('gemini')) return 'Google';
  if (/gpt|codex|davinci|\bo[1-9]\b/.test(s)) return 'OpenAI';
  if (s.includes('mai') || s.includes('phi')) return 'Microsoft';
  if (s.includes('raptor')) return 'GitHub';
  return 'Other';
}

/** Sum of input+output $/1M as a price sort key; null when no rate is known. */
function priceScore(model: ModelInfo): number | null {
  if (model.inputRate === undefined && model.outputRate === undefined) return null;
  return (model.inputRate ?? 0) + (model.outputRate ?? 0);
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

  const groups = GROUP_ORDER.map((name) => ({
    name,
    models: models
      .filter((m) => providerGroup(m) === name)
      .sort((a, b) => {
        // Highest price first; models without a known rate go last.
        const sa = priceScore(a);
        const sb = priceScore(b);
        if (sa === null && sb === null) return 0;
        if (sa === null) return 1;
        if (sb === null) return -1;
        return sb - sa;
      })
  })).filter((g) => g.models.length > 0);

  return (
    <div className="flex flex-col gap-2.5">
      {groups.map((group) => (
        <div key={group.name} className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-vscode-desc">
              {group.name}
            </span>
            <span className="text-[10px] text-vscode-desc">{group.models.length}</span>
            <span className="h-px flex-1 bg-vscode-border" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {group.models.map((model) => {
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
                  {model.inputRate !== undefined && model.outputRate !== undefined && (
                    <span
                      className="opacity-60"
                      title={`Token rates per 1M — input ${formatRate(model.inputRate)} / output ${formatRate(
                        model.outputRate
                      )}`}
                    >
                      {formatRate(model.inputRate)}/{formatRate(model.outputRate)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
