interface PromptBarProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  onRun: () => void;
  running: boolean;
  previewing: boolean;
  canRun: boolean;
}

export function PromptBar({
  prompt,
  onPromptChange,
  onRun,
  running,
  previewing,
  canRun
}: PromptBarProps) {
  return (
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
  );
}
