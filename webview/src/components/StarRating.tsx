interface StarRatingProps {
  value: number | null | undefined;
  onRate: (value: number | null) => void;
  disabled?: boolean;
}

export function StarRating({ value, onRate, disabled }: StarRatingProps) {
  const current = value ?? 0;
  return (
    <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
          aria-checked={current === star}
          role="radio"
          className={`text-sm leading-none transition-colors disabled:opacity-50 ${
            star <= current ? 'text-yellow-400' : 'text-vscode-desc hover:text-yellow-300'
          }`}
          onClick={() => onRate(current === star ? null : star)}
        >
          {star <= current ? '★' : '☆'}
        </button>
      ))}
    </div>
  );
}
