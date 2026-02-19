interface ToggleOption {
  label: string;
  value: string;
}

interface ToggleGroupProps {
  options: ToggleOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function ToggleGroup({ options, value, onChange, className = '' }: ToggleGroupProps): React.ReactElement {
  return (
    <div className={`inline-flex rounded-pill bg-accent-soft p-xs ${className}`}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-pill px-lg py-md text-sm font-medium transition-all ${
            value === option.value
              ? 'bg-card text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
