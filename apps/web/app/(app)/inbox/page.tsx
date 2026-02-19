'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import PageContainer from '@/components/layout/PageContainer';
import { Badge, Spinner, EmptyState, Pill } from '@/components/ui';
import { getMyDeals } from '@/services/dealsService';
import { getPublicUrl } from '@/services/imageService';
import { useAuthStore } from '@/stores/authStore';
import { useRealtimeDeals } from '@/hooks/useRealtimeDeals';
import type { Deal } from '@/types/models';

type FilterType = 'all' | 'unread' | 'selling' | 'buying';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function isUnread(deal: Deal, userId: string): boolean {
  const isBuyer = deal.buyer_id === userId;
  const lastRead = isBuyer ? deal.buyer_last_read_at : deal.seller_last_read_at;
  if (!lastRead) return true;
  return new Date(deal.updated_at) > new Date(lastRead);
}

export default function InboxPage(): React.ReactElement {
  const user = useAuthStore((s) => s.user);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<FilterType>('all');

  const loadDeals = useCallback(async (): Promise<void> => {
    if (!user) return;
    setLoading(true);
    const { deals: data } = await getMyDeals(user.id);
    setDeals(data);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadDeals(); }, [loadDeals]);
  useRealtimeDeals(user?.id || null, loadDeals);

  const filtered = deals.filter((d) => {
    if (!user) return false;
    if (d.status === 'cancelled') return false;
    if (filter === 'unread') return isUnread(d, user.id);
    if (filter === 'selling') return d.seller_id === user.id;
    if (filter === 'buying') return d.buyer_id === user.id;
    return true;
  });

  const unreadCount = user ? deals.filter((d) => d.status !== 'cancelled' && isUnread(d, user.id)).length : 0;

  return (
    <PageContainer>
      <h1 className="mb-2xl font-heading text-h1 text-text-primary">Inbox</h1>

      <div className="mb-xl flex flex-wrap gap-sm">
        <Pill selected={filter === 'all'} onClick={() => setFilter('all')}>All</Pill>
        <Pill selected={filter === 'unread'} onClick={() => setFilter('unread')}>
          Unread {unreadCount > 0 && `(${unreadCount})`}
        </Pill>
        <Pill selected={filter === 'selling'} onClick={() => setFilter('selling')}>Selling</Pill>
        <Pill selected={filter === 'buying'} onClick={() => setFilter('buying')}>Buying</Pill>
      </div>

      {loading ? (
        <div className="flex justify-center py-huge"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No conversations" description="Your deal conversations will appear here." />
      ) : (
        <div className="space-y-xs">
          {filtered.map((deal) => {
            const item = deal.item;
            const photoPath = item?.photos?.[0] || item?.image_path;
            const unread = user ? isUnread(deal, user.id) : false;
            const isSelling = deal.seller_id === user?.id;

            return (
              <Link key={deal.id} href={`/deals/${deal.id}`} className="block">
                <div className={`flex items-center gap-lg rounded-md border p-lg transition-colors hover:bg-accent-soft ${
                  unread ? 'border-unread-border bg-unread' : 'border-border bg-card'
                }`}>
                  <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-md bg-accent-soft">
                    {photoPath ? (
                      <img src={getPublicUrl(photoPath)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-lg">{item?.label || '📦'}</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-sm">
                      <p className={`truncate text-sm ${unread ? 'font-semibold' : 'font-medium'} text-text-primary`}>
                        {item?.title || 'Item'}
                      </p>
                      {unread && <div className="h-2 w-2 rounded-full bg-accent flex-shrink-0" />}
                    </div>
                    <div className="mt-xs flex items-center gap-sm">
                      <Badge variant={isSelling ? 'success' : 'blue'}>
                        {isSelling ? 'Selling' : 'Buying'}
                      </Badge>
                      {deal.current_offer && (
                        <span className="text-xs text-text-secondary">${deal.current_offer}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-text-muted">{timeAgo(deal.updated_at)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
