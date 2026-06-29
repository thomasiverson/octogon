interface PromptBarProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  onRun: () => void;
  onCancel: () => void;
  running: boolean;
  previewing: boolean;
  canRun: boolean;
}

export function PromptBar({
  prompt,
  onPromptChange,
  onRun,
  onCancel,
  running,
  previewing,
  canRun
}: PromptBarProps) {
  return (
    <div className="flex flex-col gap-2">
      <textarea
        className="min-h-[72px] w-full resize-y rounded border border-vscode-input-border bg-vscode-input-bg p-2 text-vscode-input-fg outline-none focus:border-vscode-link"
        placeholder="Enter a prompt to compare across models… (Ctrl/Cmd+Enter to run)"
        value={prompt}
        aria-label="Prompt"
        onChange={(e) => onPromptChange(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && canRun && !running && !previewing) {
            e.preventDefault();
            onRun();
          }
        }}
      />
      <div className="flex items-center gap-2">
        {running ? (
          <button
            className="rounded bg-vscode-btn-sec-bg px-3 py-1.5 text-vscode-btn-sec-fg hover:opacity-90"
            onClick={onCancel}
          >
            Cancel
          </button>
        ) : (
          <button
            className="rounded bg-vscode-btn-bg px-3 py-1.5 text-vscode-btn-fg hover:bg-vscode-btn-hover disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canRun || previewing}
            onClick={onRun}
          >
            {previewing ? 'Estimating cost…' : 'Run comparison'}
          </button>
        )}
        {running && (
          <span className="flex items-center gap-1 text-xs text-vscode-desc">
            <span className="h-2 w-2 animate-pulse rounded-full bg-vscode-link" />
            Running…
          </span>
        )}
      </div>
    </div>
  );
}
