interface ContextPanelProps {
  activeFile: string | null;
  useActiveFile: boolean;
  onToggleActiveFile: (value: boolean) => void;
  useRetrieval: boolean;
  onToggleRetrieval: (value: boolean) => void;
  topK: number;
  onTopKChange: (value: number) => void;
  attachedFiles: string[];
  onAttach: () => void;
  onRemoveAttached: (path: string) => void;
  onClearAttached: () => void;
  disabled: boolean;
}

function basename(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

export function ContextPanel({
  activeFile,
  useActiveFile,
  onToggleActiveFile,
  useRetrieval,
  onToggleRetrieval,
  topK,
  onTopKChange,
  attachedFiles,
  onAttach,
  onRemoveAttached,
  onClearAttached,
  disabled
}: ContextPanelProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] text-vscode-desc">
        Budgeted to the smallest selected model's context window.
      </span>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={useActiveFile}
            disabled={disabled}
            onChange={(e) => onToggleActiveFile(e.target.checked)}
          />
          <span>
            Active file &amp; selection
            {activeFile ? (
              <span className="ml-1 text-vscode-desc" title={activeFile}>
                ({basename(activeFile)})
              </span>
            ) : (
              <span className="ml-1 text-vscode-desc">(none open)</span>
            )}
          </span>
        </label>

        <button
          className="rounded px-2 py-0.5 text-vscode-link hover:bg-vscode-list-hover disabled:opacity-50"
          onClick={onAttach}
          disabled={disabled}
        >
          Attach files…
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={useRetrieval}
            disabled={disabled}
            onChange={(e) => onToggleRetrieval(e.target.checked)}
          />
          <span>Retrieval</span>
        </label>

        <label className={`flex items-center gap-1.5 ${useRetrieval ? '' : 'opacity-50'}`}>
          <span>top-K</span>
          <input
            type="number"
            min={1}
            max={50}
            value={topK}
            disabled={disabled || !useRetrieval}
            onChange={(e) => onTopKChange(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            className="w-14 rounded border border-vscode-input-border bg-vscode-input-bg px-1.5 py-0.5 text-vscode-input-fg"
          />
        </label>
      </div>

      <p className="text-[11px] leading-snug text-vscode-desc">
        <strong className="font-medium text-vscode-fg">Retrieval</strong> auto-includes the most
        relevant files from your repo (keyword search) so the models get context without you
        attaching anything.{' '}
        <strong className="font-medium text-vscode-fg">top-K</strong> is how many snippets to pull
        in — a higher number means more context and more tokens.
      </p>

      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {attachedFiles.map((p) => (
            <span
              key={p}
              title={p}
              className="flex items-center gap-1 rounded border border-vscode-border bg-vscode-bg px-1.5 py-0.5 text-[11px]"
            >
              {basename(p)}
              <button
                className="opacity-60 hover:opacity-100"
                onClick={() => onRemoveAttached(p)}
                disabled={disabled}
                aria-label={`Remove ${basename(p)}`}
              >
                ✕
              </button>
            </span>
          ))}
          <button
            className="text-[11px] text-vscode-link hover:underline disabled:opacity-50"
            onClick={onClearAttached}
            disabled={disabled}
          >
            clear all
          </button>
        </div>
      )}
    </div>
  );
}
