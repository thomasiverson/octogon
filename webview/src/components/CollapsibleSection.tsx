import type { ReactNode } from 'react';

interface CollapsibleSectionProps {
  title: string;
  /** Compact text shown next to the title when collapsed. */
  summary?: ReactNode;
  open: boolean;
  onToggle: () => void;
  /** Optional right-aligned control (e.g. a Refresh button) shown in the header. */
  right?: ReactNode;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  summary,
  open,
  onToggle,
  right,
  children
}: CollapsibleSectionProps) {
  return (
    <div className="rounded border border-vscode-border bg-vscode-panel-bg">
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="w-3 shrink-0 text-[10px] text-vscode-desc">{open ? '▼' : '▶'}</span>
          <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-vscode-desc">
            {title}
          </span>
          {!open && summary && (
            <span className="truncate text-[11px] text-vscode-desc">{summary}</span>
          )}
        </button>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      {open && <div className="border-t border-vscode-border p-2.5">{children}</div>}
    </div>
  );
}
