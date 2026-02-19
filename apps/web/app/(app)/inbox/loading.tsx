import PageContainer from '@/components/layout/PageContainer';

function Skeleton({ className }: { className?: string }): React.ReactElement {
  return <div className={`animate-pulse rounded-md bg-accent-soft ${className || ''}`} />;
}

export default function InboxLoading(): React.ReactElement {
  return (
    <PageContainer>
      <Skeleton className="mb-2xl h-10 w-28" />
      <div className="mb-xl flex gap-sm">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-16 rounded-pill" />
        ))}
      </div>
      <div className="space-y-xs">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-lg rounded-md border border-border p-lg">
            <Skeleton className="h-12 w-12 rounded-md" />
            <div className="flex-1 space-y-sm">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-3 w-8" />
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
