import { useState } from 'react';

interface JudgeBarProps {
  onRunJudge: (referenceAnswer: string) => void;
  judging: boolean;
  disabled: boolean;
}

export function JudgeBar({ onRunJudge, judging, disabled }: JudgeBarProps) {
  const [showReference, setShowReference] = useState(false);
  const [reference, setReference] = useState('');

  return (
    <div className="flex flex-col gap-2 rounded border border-vscode-border bg-vscode-panel-bg p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="rounded bg-vscode-btn-sec-bg px-3 py-1.5 text-vscode-btn-sec-fg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => onRunJudge(reference)}
          disabled={disabled || judging}
        >
          {judging ? 'Judging…' : 'Run LLM judge'}
        </button>
        <button
          className="text-xs text-vscode-link hover:underline"
          onClick={() => setShowReference((s) => !s)}
        >
          {showReference ? 'Hide reference answer' : 'Add reference answer'}
        </button>
        <span className="ml-auto text-[11px] text-vscode-desc">
          Opt-in · consumes additional tokens/credits
        </span>
      </div>

      {showReference && (
        <textarea
          className="min-h-[60px] w-full resize-y rounded border border-vscode-input-border bg-vscode-input-bg p-2 text-xs text-vscode-input-fg outline-none focus:border-vscode-link"
          placeholder="Optional reference answer — when provided, the judge scores responses against it."
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          disabled={disabled || judging}
        />
      )}
    </div>
  );
}
