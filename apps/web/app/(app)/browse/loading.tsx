import PageContainer from '@/components/layout/PageContainer';

function Skeleton({ className }: { className?: string }): React.ReactElement {
  return <div className={`animate-pulse rounded-md bg-accent-soft ${className || ''}`} />;
}

export default function BrowseLoading(): React.ReactElement {
  return (
    <PageContainer>
      <Skeleton className="mb-2xl h-10 w-48" />
      <Skeleton className="mb-xl h-12 w-full" />
      <div className="mb-xl flex gap-sm">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-pill" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-lg sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-sm">
            <Skeleton className="aspect-square w-full rounded-md" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
