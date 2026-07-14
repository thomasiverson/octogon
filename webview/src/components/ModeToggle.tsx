interface ModeToggleProps {
  mode: 'ask' | 'agent' | 'blind';
  onChange: (mode: 'ask' | 'agent' | 'blind') => void;
  agentEnabled: boolean;
  disabled?: boolean;
  onEnableRequest: () => void;
}

const base =
  'rounded px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed';

/** Ask | Agent segmented switch. Clicking Agent while off enables it in one click. */
export function ModeToggle({ mode, onChange, agentEnabled, disabled, onEnableRequest }: ModeToggleProps) {
  return (
    <div className="flex items-center gap-1 rounded border border-vscode-border bg-vscode-panel-bg p-0.5">
      <button
        className={`${base} ${
          mode === 'ask' ? 'bg-vscode-btn-bg text-vscode-btn-fg' : 'text-vscode-desc hover:text-vscode-fg'
        }`}
        onClick={() => onChange('ask')}
        disabled={disabled}
        title="Compare model responses side by side"
      >
        Ask
      </button>
      <button
        className={`${base} ${
          mode === 'agent' ? 'bg-vscode-btn-bg text-vscode-btn-fg' : 'text-vscode-desc hover:text-vscode-fg'
        } ${!agentEnabled ? 'opacity-60' : ''}`}
        onClick={() => (agentEnabled ? onChange('agent') : onEnableRequest())}
        disabled={disabled}
        title={
          agentEnabled
            ? 'Run each model as an autonomous coding agent in an isolated sandbox'
            : 'Click to enable Agent mode (each model runs as an autonomous coding agent in a sandbox)'
        }
      >
        Agent{!agentEnabled && ' (off)'}
      </button>
      <button
        className={`${base} ${
          mode === 'blind' ? 'bg-vscode-btn-bg text-vscode-btn-fg' : 'text-vscode-desc hover:text-vscode-fg'
        }`}
        onClick={() => onChange('blind')}
        disabled={disabled}
        title="Blind test — random or hand-picked models compete with their names hidden until you pick the best answer"
      >
        Blind
      </button>
    </div>
  );
}
