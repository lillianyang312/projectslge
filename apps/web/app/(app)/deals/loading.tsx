import PageContainer from '@/components/layout/PageContainer';

function Skeleton({ className }: { className?: string }): React.ReactElement {
  return <div className={`animate-pulse rounded-md bg-accent-soft ${className || ''}`} />;
}

export default function DealsLoading(): React.ReactElement {
  return (
    <PageContainer>
      <Skeleton className="mb-2xl h-10 w-32" />
      <Skeleton className="mb-xl h-10 w-64" />
      <div className="space-y-md">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-lg rounded-md border border-border p-lg">
            <Skeleton className="h-14 w-14 rounded-md" />
            <div className="flex-1 space-y-sm">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
