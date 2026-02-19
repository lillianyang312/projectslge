type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'purple' | 'blue' | 'primary' | 'info';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  neutral: 'bg-accent-soft text-text-secondary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  purple: 'bg-purple-soft text-purple',
  blue: 'bg-blue-soft text-blue',
  primary: 'bg-accent text-white',
  info: 'bg-accent-soft text-text-secondary',
};

export default function Badge({ variant = 'neutral', children, className = '' }: BadgeProps): React.ReactElement {
  return (
    <span className={`inline-flex items-center rounded-pill px-[10px] py-xs text-sm font-medium ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}
