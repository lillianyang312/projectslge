interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export default function PageContainer({ children, className = '' }: PageContainerProps): React.ReactElement {
  return (
    <div className={`mx-auto max-w-7xl px-lg py-2xl ${className}`}>
      {children}
    </div>
  );
}
