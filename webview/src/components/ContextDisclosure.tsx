import type { ContextInfo, ContextRef } from '../../../src/shared/types';
import { formatTokens } from '../format';

interface ContextDisclosureProps {
  context: ContextInfo;
}

const sourceLabel: Record<ContextRef['source'], string> = {
  active: 'active',
  selection: 'selection',
  attached: 'attached',
  retrieval: 'retrieval'
};

export function ContextDisclosure({ context }: ContextDisclosureProps) {
  if (context.refs.length === 0 && !context.trimmed) {
    return null;
  }

  return (
    <details className="rounded border border-vscode-border bg-vscode-panel-bg text-xs">
      <summary className="cursor-pointer select-none px-2.5 py-1.5">
        Context included · {context.refs.length} item{context.refs.length === 1 ? '' : 's'} ·{' '}
        {formatTokens(context.totalTokens)} tokens
        {context.budget > 0 && (
          <span className="text-vscode-desc"> / {formatTokens(context.budget)} budget</span>
        )}
        {context.trimmed && <span className="ml-1 text-yellow-500">· trimmed</span>}
      </summary>
      <div className="flex flex-col gap-1 border-t border-vscode-border px-2.5 py-2">
        {context.refs.map((ref, i) => (
          <div key={`${ref.path}-${i}`} className="flex items-start gap-2">
            <span className="rounded bg-vscode-badge px-1.5 py-0.5 text-[10px] text-vscode-badge-fg">
              {sourceLabel[ref.source]}
            </span>
            <span className="flex-1 break-all" title={ref.preview ?? ref.path}>
              {ref.path}
            </span>
            <span className="shrink-0 tabular-nums text-vscode-desc">{formatTokens(ref.tokens)} tok</span>
          </div>
        ))}
        {context.refs.length === 0 && (
          <span className="text-vscode-desc">No context fit within the budget.</span>
        )}
      </div>
    </details>
  );
}
