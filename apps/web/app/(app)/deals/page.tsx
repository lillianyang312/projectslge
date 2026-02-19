'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import PageContainer from '@/components/layout/PageContainer';
import { Badge, Spinner, EmptyState } from '@/components/ui';
import { getMyDeals, getHighestBuyerOfferForItem } from '@/services/dealsService';
import { getPublicUrl } from '@/services/imageService';
import { useAuthStore } from '@/stores/authStore';
import { useRealtimeDeals } from '@/hooks/useRealtimeDeals';
import type { Deal } from '@/types/models';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getDealBadge(deal: Deal): { variant: 'success' | 'warning' | 'danger' | 'blue' | 'purple' | 'neutral'; label: string } {
  switch (deal.status) {
    case 'negotiating': return { variant: 'blue', label: 'Pending' };
    case 'agreed': return { variant: 'purple', label: 'Agreed' };
    case 'logistics': return deal.pickup_date ? { variant: 'success', label: 'Scheduled' } : { variant: 'blue', label: 'Scheduling' };
    case 'completed': return { variant: 'success', label: 'Complete' };
    case 'cancelled': return { variant: 'neutral', label: 'Cancelled' };
    default: return { variant: 'neutral', label: deal.status };
  }
}

export default function DealsPage(): React.ReactElement {
  const user = useAuthStore((s) => s.user);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [highestOffers, setHighestOffers] = useState<Record<string, number | null>>({});

  const loadDeals = useCallback(async (): Promise<void> => {
    if (!user) return;
    setLoading(true);
    const { deals: data } = await getMyDeals(user.id);
    setDeals(data);

    // Fetch highest buyer offer for buying deals
    const buyingDeals = data.filter((d) => d.buyer_id === user.id);
    const uniqueItemIds = [...new Set(buyingDeals.map((d) => d.item_id))];
    if (uniqueItemIds.length > 0) {
      const offerResults = await Promise.all(
        uniqueItemIds.map(async (itemId) => {
          const highest = await getHighestBuyerOfferForItem(itemId);
          return { itemId, highest };
        })
      );
      const offerMap: Record<string, number | null> = {};
      offerResults.forEach((r) => { offerMap[r.itemId] = r.highest; });
      setHighestOffers((prev) => ({ ...prev, ...offerMap }));
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { loadDeals(); }, [loadDeals]);
  useRealtimeDeals(user?.id || null, loadDeals);

  const filtered = deals.filter((d) => d.buyer_id === user?.id);

  return (
    <PageContainer>
      <h1 className="mb-2xl font-heading text-h1 text-text-primary">My Offers</h1>

      {loading ? (
        <div className="flex justify-center py-huge"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No offers yet"
          description="Browse items and make offers to get started."
        />
      ) : (
        <div className="space-y-md">
          {filtered.map((deal) => {
            const item = deal.item;
            const photoPath = item?.photos?.[0] || item?.image_path;
            const badge = getDealBadge(deal);
            const seller = deal.seller;
            const sellerName = seller?.first_name || seller?.display_name || 'Seller';
            const sellerYear = seller?.graduation_year ? `'${String(seller.graduation_year).slice(-2)}` : '';

            return (
              <Link key={deal.id} href={`/deals/${deal.id}`} className="block">
                <div className="flex items-center gap-lg rounded-md border border-border bg-card p-lg transition-shadow hover:shadow-sm">
                  <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-md bg-accent-soft">
                    {photoPath ? (
                      <img src={getPublicUrl(photoPath)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-lg">{item?.label || '📦'}</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-md font-medium text-text-primary">{item?.title || 'Item'}</p>
                    <div className="mt-xs flex items-center gap-sm">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                      {deal.current_offer && (
                        <span className="text-sm font-medium text-text-primary">${deal.current_offer}</span>
                      )}
                      {item?.condition && (
                        <span className="text-xs text-text-muted capitalize">{item.condition.replace('_', ' ')}</span>
                      )}
                    </div>
                    {(item?.estimated_value_min || item?.estimated_value_max) && (
                      <p className="mt-xs text-xs text-text-muted">
                        Est. ${item?.estimated_value_min || '?'} – ${item?.estimated_value_max || '?'}
                      </p>
                    )}
                    {highestOffers[deal.item_id] && (
                      <p className={`mt-xs text-xs font-medium ${
                        deal.buyer_offer === highestOffers[deal.item_id] ? 'text-success' : 'text-danger'
                      }`}>
                        Top offer: ${highestOffers[deal.item_id]}
                        {deal.buyer_offer === highestOffers[deal.item_id] ? ' (yours)' : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-xs">
                    {seller?.id ? (
                      <span
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/users/${seller.id}`; }}
                        className="text-sm font-medium text-accent hover:underline cursor-pointer"
                      >
                        {sellerName} {sellerYear}
                      </span>
                    ) : (
                      <span className="text-sm text-text-secondary">{sellerName} {sellerYear}</span>
                    )}
                    <span className="text-xs text-text-muted">{timeAgo(deal.updated_at)}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
