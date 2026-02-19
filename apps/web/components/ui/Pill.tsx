interface PillProps {
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

export default function Pill({ selected = false, onClick, children, className = '' }: PillProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-pill border px-lg py-[10px] text-sm font-medium transition-colors ${
        selected
          ? 'border-accent bg-accent text-white'
          : 'border-border bg-card text-text-primary hover:bg-accent-soft'
      } ${className}`}
    >
      {children}
    </button>
  );
}
