interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function Card({ children, className = '', onClick }: CardProps): React.ReactElement {
  const Component = onClick ? 'button' : 'div';
  return (
    <Component
      className={`rounded-md border border-border bg-card p-lg shadow-sm ${onClick ? 'cursor-pointer transition-shadow hover:shadow-lg text-left w-full' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </Component>
  );
}
