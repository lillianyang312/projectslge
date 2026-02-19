import { type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({ label, error, className = '', id, ...props }: InputProps): React.ReactElement {
  return (
    <div className="mb-lg">
      {label && (
        <label htmlFor={id} className="mb-sm block text-sm text-text-secondary">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`w-full rounded-md border bg-card px-md py-md text-sm text-text-primary placeholder:text-text-muted focus:outline-none ${
          error ? 'border-danger' : 'border-border focus:border-accent'
        } ${className}`}
        {...props}
      />
      {error && <p className="mt-xs text-sm text-danger">{error}</p>}
    </div>
  );
}
