interface BadgeProps {
  label: string;
  value: string;
  tone?: 'default' | 'good' | 'warn' | 'info';
  title?: string;
}

const tones: Record<NonNullable<BadgeProps['tone']>, string> = {
  default: 'bg-vscode-badge text-vscode-badge-fg',
  good: 'bg-green-600/80 text-white',
  warn: 'bg-yellow-600/80 text-white',
  info: 'bg-blue-600/80 text-white'
};

export function Badge({ label, value, tone = 'default', title }: BadgeProps) {
  return (
    <span
      title={title ?? `${label}: ${value}`}
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] leading-none ${tones[tone]}`}
    >
      <span className="opacity-70">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </span>
  );
}
