import PageContainer from '@/components/layout/PageContainer';

function Skeleton({ className }: { className?: string }): React.ReactElement {
  return <div className={`animate-pulse rounded-md bg-accent-soft ${className || ''}`} />;
}

export default function MyListLoading(): React.ReactElement {
  return (
    <PageContainer>
      <Skeleton className="mb-2xl h-10 w-32" />
      <Skeleton className="mb-xl h-10 w-48" />
      <div className="space-y-md">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-lg rounded-md border border-border bg-card p-lg">
            <Skeleton className="h-16 w-16 rounded-md" />
            <div className="flex-1 space-y-sm">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
