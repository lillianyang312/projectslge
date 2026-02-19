'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PageContainer from '@/components/layout/PageContainer';
import { Tabs, Badge, Button, Spinner, EmptyState } from '@/components/ui';
import { getMyActiveItems, getMyGoneItems, markItemAsSold, deleteItem, restoreItem } from '@/services/itemsService';
import { getTopBidsForItems } from '@/services/dealsService';
import { getPublicUrl } from '@/services/imageService';
import type { Item } from '@/types/models';

export default function MyListPage(): React.ReactElement {
  const router = useRouter();
  const [tab, setTab] = useState<string>('live');
  const [activeItems, setActiveItems] = useState<Item[]>([]);
  const [goneItems, setGoneItems] = useState<Item[]>([]);
  const [topBids, setTopBids] = useState<Record<string, { topBid: number | undefined; interestedCount: number }>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Edit mode for mass removal
  const [editMode, setEditMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [massDeleting, setMassDeleting] = useState<boolean>(false);

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

  const handleMarkAsSold = async (id: string): Promise<void> => {
    await markItemAsSold(id);
    loadData();
  };

  const handleDelete = async (id: string): Promise<void> => {
    const confirmed = window.confirm('Remove this item? This cannot be undone.');
    if (!confirmed) return;
    setDeletingId(id);
    await deleteItem(id);
    setDeletingId(null);
    loadData();
  };

  const handleRestore = async (id: string): Promise<void> => {
    await restoreItem(id);
    loadData();
  };

  const toggleSelect = (id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleMassDelete = async (): Promise<void> => {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(`Remove ${selectedIds.size} item${selectedIds.size > 1 ? 's' : ''}? This cannot be undone.`);
    if (!confirmed) return;
    setMassDeleting(true);
    await Promise.all(Array.from(selectedIds).map((id) => deleteItem(id)));
    setSelectedIds(new Set());
    setEditMode(false);
    setMassDeleting(false);
    loadData();
  };

  const exitEditMode = (): void => {
    setEditMode(false);
    setSelectedIds(new Set());
  };

  const currentItems = tab === 'live' ? activeItems : goneItems;

  return (
    <PageContainer>
      <div className="mb-2xl flex items-center justify-between">
        <h1 className="font-heading text-h1 text-text-primary">My Items</h1>
        {/* Edit / Done button for mass removal mode */}
        {tab === 'live' && activeItems.length > 0 && !loading && (
          editMode ? (
            <div className="flex items-center gap-md">
              {selectedIds.size > 0 && (
                <button
                  onClick={handleMassDelete}
                  disabled={massDeleting}
                  className="rounded-md bg-danger px-lg py-sm text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {massDeleting ? 'Removing...' : `Remove (${selectedIds.size})`}
                </button>
              )}
              <button
                onClick={exitEditMode}
                className="rounded-md border border-border px-lg py-sm text-sm font-medium text-text-primary hover:bg-accent-soft"
              >
                Done
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="rounded-md border border-border px-lg py-sm text-sm font-medium text-text-primary hover:bg-accent-soft"
            >
              Edit
            </button>
          )
        )}
      </div>

      <Tabs
        tabs={[
          { label: `Live (${activeItems.length})`, value: 'live' },
          { label: `Sold (${goneItems.length})`, value: 'gone' },
        ]}
        activeTab={tab}
        onChange={(v) => { setTab(v); exitEditMode(); }}
      />

      {loading ? (
        <div className="flex justify-center py-huge"><Spinner size="lg" /></div>
      ) : currentItems.length === 0 ? (
        <EmptyState
          title={tab === 'live' ? 'No active listings' : 'No sold items yet'}
          description={tab === 'live' ? 'List your first item to start selling!' : undefined}
          action={tab === 'live' ? <Link href="/upload"><Button>List an item</Button></Link> : undefined}
        />
      ) : (
        <div className="space-y-md">
          {currentItems.map((item) => {
            const photoPath = item.photos?.[0] || item.image_path;
            const bid = topBids[item.id];
            const isDeleting = deletingId === item.id;
            const isSelected = selectedIds.has(item.id);

            return (
              <div key={item.id} className={`rounded-md border bg-card transition-shadow hover:shadow-sm ${isSelected ? 'border-danger bg-danger-soft/10' : 'border-border'} ${isDeleting ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-lg p-lg">
                  {/* Checkbox in edit mode */}
                  {editMode && tab === 'live' && (
                    <button
                      onClick={() => toggleSelect(item.id)}
                      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border-2 transition-colors"
                      style={{
                        borderColor: isSelected ? 'var(--color-danger, #ef4444)' : 'var(--color-border, #d1d5db)',
                        backgroundColor: isSelected ? 'var(--color-danger, #ef4444)' : 'transparent',
                      }}
                    >
                      {isSelected && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                    </button>
                  )}

                  {/* Item photo + info (clickable) */}
                  <Link href={`/items/${item.id}`} className="flex min-w-0 flex-1 items-center gap-lg">
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
                        {tab === 'gone' && item.status === 'sold' && (
                          <Badge variant="success">Sold</Badge>
                        )}
                      </div>
                    </div>
                  </Link>

                  {/* Right-side action buttons (only in normal mode, not edit mode) */}
                  {!editMode && tab === 'live' && (
                    <div className="flex flex-shrink-0 items-center gap-sm">
                      {/* Mark as Sold button */}
                      <button
                        onClick={() => handleMarkAsSold(item.id)}
                        className="rounded-md bg-success/10 px-md py-xs text-xs font-medium text-success hover:bg-success/20"
                      >
                        Mark as Sold
                      </button>
                      {/* Remove button */}
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={isDeleting}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-text-secondary hover:bg-danger-soft/50 hover:text-danger disabled:opacity-50"
                        title="Remove item"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  )}
                </div>

                {/* Restore button for sold tab */}
                {tab === 'gone' && (
                  <div className="flex border-t border-border">
                    <button
                      onClick={() => handleRestore(item.id)}
                      className="flex flex-1 items-center justify-center gap-xs py-sm text-xs font-medium text-accent hover:bg-accent-soft/50"
                    >
                      Restore to Live
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
