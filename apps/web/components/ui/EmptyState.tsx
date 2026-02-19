interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({ title, description, action, className = '' }: EmptyStateProps): React.ReactElement {
  return (
    <div className={`flex flex-col items-center justify-center py-huge text-center ${className}`}>
      <h3 className="text-lg font-medium text-text-primary">{title}</h3>
      {description && <p className="mt-sm text-sm text-text-secondary max-w-sm">{description}</p>}
      {action && <div className="mt-xl">{action}</div>}
    </div>
  );
}
