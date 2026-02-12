'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import PageContainer from '@/components/layout/PageContainer';
import { Tabs, Badge, Button, Spinner, EmptyState } from '@/components/ui';
import { getMyActiveItems, getMyGoneItems, markItemAsSold, markItemAsRemoved, restoreItem } from '@/services/itemsService';
import { getTopBidsForItems } from '@/services/dealsService';
import { getPublicUrl } from '@/services/imageService';
import type { Item } from '@/types/models';

export default function MyListPage(): React.ReactElement {
  const [tab, setTab] = useState<string>('live');
  const [activeItems, setActiveItems] = useState<Item[]>([]);
  const [goneItems, setGoneItems] = useState<Item[]>([]);
  const [topBids, setTopBids] = useState<Record<string, { topBid: number | undefined; interestedCount: number }>>({});
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = useCallback(async (): Promise<void> => {
    setLoading(true);
    const [activeResult, goneResult] = await Promise.all([getMyActiveItems(), getMyGoneItems()]);
    setActiveItems(activeResult.data);
    setGoneItems(goneResult.data);

    if (activeResult.data.length > 0) {
      const ids = activeResult.data.map((i) => i.id);
      const bids = await getTopBidsForItems(ids);
      setTopBids(bids);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAction = async (id: string, action: 'sold' | 'removed' | 'restore'): Promise<void> => {
    if (action === 'sold') await markItemAsSold(id);
    else if (action === 'removed') await markItemAsRemoved(id);
    else await restoreItem(id);
    loadData();
  };

  const currentItems = tab === 'live' ? activeItems : goneItems;

  return (
    <PageContainer>
      <div className="mb-2xl flex items-center justify-between">
        <h1 className="font-heading text-h1 text-text-primary">My Items</h1>
      </div>

      <Tabs
        tabs={[
          { label: `Live (${activeItems.length})`, value: 'live' },
          { label: `Gone (${goneItems.length})`, value: 'gone' },
        ]}
        activeTab={tab}
        onChange={setTab}
      />

      {loading ? (
        <div className="flex justify-center py-huge"><Spinner size="lg" /></div>
      ) : currentItems.length === 0 ? (
        <EmptyState
          title={tab === 'live' ? 'No active listings' : 'No sold/removed items'}
          description={tab === 'live' ? 'List your first item to start selling!' : undefined}
          action={tab === 'live' ? <Link href="/upload"><Button>List an item</Button></Link> : undefined}
        />
      ) : (
        <div className="space-y-md">
          {currentItems.map((item) => {
            const photoPath = item.photos?.[0] || item.image_path;
            const bid = topBids[item.id];

            return (
              <Link key={item.id} href={`/items/${item.id}`} className="block">
                <div className="flex items-center gap-lg rounded-md border border-border bg-card p-lg transition-shadow hover:shadow-sm">
                  <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-accent-soft">
                    {photoPath ? (
                      <img src={getPublicUrl(photoPath)} alt={item.title || ''} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xl">{item.label || '📦'}</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-md font-medium text-text-primary">{item.title || 'Untitled'}</p>
                    <div className="mt-xs flex flex-wrap items-center gap-sm">
                      {item.category && <Badge variant="neutral">{item.category}</Badge>}
                      {tab === 'live' && bid?.topBid && (
                        <>
                          <span className="font-heading text-md font-medium text-success">Top bid: ${bid.topBid}</span>
                          {bid.interestedCount > 0 && (
                            <span className="text-sm text-text-muted">{bid.interestedCount} interested</span>
                          )}
                        </>
                      )}
                      {tab === 'gone' && item.status && (
                        <Badge variant={item.status === 'sold' ? 'success' : 'neutral'}>{item.status === 'sold' ? 'Sold' : 'Removed'}</Badge>
                      )}
                    </div>
                  </div>
                  {tab === 'live' && (
                    <div className="flex gap-xs" onClick={(e) => e.preventDefault()}>
                      <button onClick={() => handleAction(item.id, 'sold')} className="rounded-md px-md py-xs text-xs text-success hover:bg-success-soft">Sold</button>
                      <button onClick={() => handleAction(item.id, 'removed')} className="rounded-md px-md py-xs text-xs text-text-muted hover:bg-accent-soft">Remove</button>
                    </div>
                  )}
                  {tab === 'gone' && (
                    <button onClick={(e) => { e.preventDefault(); handleAction(item.id, 'restore'); }} className="rounded-md px-md py-xs text-xs text-accent hover:bg-accent-soft">
                      Restore
                    </button>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
