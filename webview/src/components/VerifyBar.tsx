interface VerifyBarProps {
  command: string;
  onVerify: () => void;
  verifying: boolean;
  disabled: boolean;
}

export function VerifyBar({ command, onVerify, verifying, disabled }: VerifyBarProps) {
  const configured = command.trim().length > 0;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        className="rounded bg-vscode-btn-sec-bg px-3 py-1.5 text-vscode-btn-sec-fg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onVerify}
        disabled={disabled || verifying || !configured}
      >
        {verifying ? 'Verifying…' : 'Run verification'}
      </button>
      {configured ? (
        <span className="text-[11px] text-vscode-desc">
          Experimental · sandbox runs <code className="rounded bg-vscode-bg px-1">{command}</code> ·
          shows a confirmation first
        </span>
      ) : (
        <span className="text-[11px] text-yellow-500">
          Set <code className="rounded bg-vscode-bg px-1">octogon.verifyCommand</code> (e.g.{' '}
          <code className="rounded bg-vscode-bg px-1">npm test</code>) to enable verification.
        </span>
      )}
    </div>
  );
}
