'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import PageContainer from '@/components/layout/PageContainer';
import { Badge, Button, Spinner, Modal } from '@/components/ui';
import { getItemById, markItemAsSold, deleteItem, getItemsByOwnerId } from '@/services/itemsService';
import { expressInterest, getDealsByItemId, acceptOffer } from '@/services/dealsService';
import { getPublicUrl } from '@/services/imageService';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import type { Item, Deal } from '@/types/models';

const conditionLabels: Record<string, string> = {
  new: 'New', like_new: 'Like New', good: 'Good', fair: 'Fair', poor: 'Poor',
};

export default function ItemDetailPage(): React.ReactElement {
  const params = useParams();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const itemId = params.id as string;

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedPhoto, setSelectedPhoto] = useState<number>(0);
  const [bidModalOpen, setBidModalOpen] = useState<boolean>(false);
  const [bidAmount, setBidAmount] = useState<string>('');
  const [bidLoading, setBidLoading] = useState<boolean>(false);
  const [bidError, setBidError] = useState<string>('');
  const [existingDeal, setExistingDeal] = useState<Deal | null>(null);
  const [bidQuestion, setBidQuestion] = useState<string>('');
  const [allDeals, setAllDeals] = useState<Deal[]>([]);
  const [isSold, setIsSold] = useState<boolean>(false);
  const [isPending, setIsPending] = useState<boolean>(false);
  const [acceptingDealId, setAcceptingDealId] = useState<string | null>(null);
  const [otherItems, setOtherItems] = useState<Item[]>([]);
  const [sellerName, setSellerName] = useState<string>('');

  useEffect(() => {
    async function load(): Promise<void> {
      const { data } = await getItemById(itemId);
      setItem(data);

      // Fetch other items from same owner + owner name
      if (data?.owner_id) {
        const [ownerItems, profileResult] = await Promise.all([
          getItemsByOwnerId(data.owner_id, itemId),
          createClient().from('user_profiles').select('first_name, full_name, display_name').eq('id', data.owner_id).single(),
        ]);
        setOtherItems(ownerItems.data);
        const p = profileResult.data;
        setSellerName(p?.first_name || p?.display_name || p?.full_name || 'Owner');
      }

      // Fetch all deals for this item
      const deals = await getDealsByItemId(itemId);
      setAllDeals(deals);

      // Check if item is sold or pending
      const sold = deals.some((d) => d.status === 'completed');
      setIsSold(sold);
      const pending = deals.some((d) => ['agreed', 'logistics'].includes(d.status));
      setIsPending(pending);

      // Check if the current user already has an active deal on this item
      if (user) {
        const userDeal = deals.find(
          (d) => (d.buyer_id === user.id || d.seller_id === user.id) && d.status !== 'cancelled'
        );
        if (userDeal) setExistingDeal(userDeal);
      }

      setLoading(false);
    }
    load();
  }, [itemId, user]);

  // Active offers sorted by highest first
  const activeOffers = allDeals
    .filter((d) => d.status !== 'cancelled' && d.status !== 'completed' && d.current_offer)
    .sort((a, b) => (b.current_offer || 0) - (a.current_offer || 0));

  const handleBid = async (): Promise<void> => {
    if (!user || !item) return;
    setBidLoading(true);
    setBidError('');

    const amount = bidAmount ? parseFloat(bidAmount) : undefined;
    const { error } = await expressInterest(user.id, item.id, amount, undefined, bidQuestion.trim() || undefined);

    if (error) {
      setBidError(error);
      setBidLoading(false);
      return;
    }

    setBidModalOpen(false);
    setBidQuestion('');
    router.push('/deals');
  };

  const handleAcceptOffer = async (dealId: string): Promise<void> => {
    if (!user) return;
    const confirmed = window.confirm('Accept this offer? The item will be marked as pending.');
    if (!confirmed) return;
    setAcceptingDealId(dealId);
    const success = await acceptOffer(dealId, user.id);
    if (success) {
      // Refresh deals
      const deals = await getDealsByItemId(itemId);
      setAllDeals(deals);
      const sold = deals.some((d) => d.status === 'completed');
      setIsSold(sold);
      const pending = deals.some((d) => ['agreed', 'logistics'].includes(d.status));
      setIsPending(pending);
    }
    setAcceptingDealId(null);
  };

  if (loading) {
    return (
      <PageContainer className="flex justify-center py-huge">
        <Spinner size="lg" />
      </PageContainer>
    );
  }

  if (!item) {
    return (
      <PageContainer>
        <p className="py-huge text-center text-text-secondary">Item not found</p>
      </PageContainer>
    );
  }

  const photos = item.photos?.length ? item.photos : item.image_path ? [item.image_path] : [];
  const isOwner = user?.id === item.owner_id;

  return (
    <PageContainer>
      <button onClick={() => router.back()} className="mb-xl text-sm text-text-secondary hover:text-text-primary">
        &larr; Back
      </button>

      <div className="grid gap-3xl lg:grid-cols-2">
        {/* Photos */}
        <div>
          <div className="aspect-[4/3] max-h-[400px] overflow-hidden rounded-lg bg-accent-soft">
            {photos[selectedPhoto] ? (
              <img
                src={getPublicUrl(photos[selectedPhoto])}
                alt={item.title || 'Item'}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-6xl text-text-muted">
                {item.label || '📦'}
              </div>
            )}
          </div>
          {photos.length > 1 && (
            <div className="mt-md flex gap-sm overflow-x-auto">
              {photos.map((photo, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedPhoto(i)}
                  className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border-2 ${
                    selectedPhoto === i ? 'border-accent' : 'border-border'
                  }`}
                >
                  <img
                    src={getPublicUrl(photo)}
                    alt={`Photo ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <h1 className="font-heading text-h1 text-text-primary">
            {item.title || 'Untitled Item'}
          </h1>

          <div className="mt-md flex flex-wrap gap-sm">
            {item.category && <Badge variant="neutral">{item.category}</Badge>}
            {item.condition && (
              <Badge variant="info">{conditionLabels[item.condition] || item.condition}</Badge>
            )}
            {item.urgency && item.urgency !== 'flexible' && (
              <Badge variant={item.urgency === 'urgent' ? 'warning' : 'neutral'}>{item.urgency}</Badge>
            )}
          </div>

          {/* Price */}
          <div className="mt-2xl rounded-md border border-border p-lg">
            <p className="text-sm text-text-secondary">Price Range</p>
            <p className="mt-xs font-heading text-h2 text-text-primary">
              {item.estimated_value_min && item.estimated_value_max
                ? `$${item.estimated_value_min} – $${item.estimated_value_max}`
                : item.market_value_min && item.market_value_max
                ? `$${item.market_value_min} – $${item.market_value_max}`
                : 'Price TBD'}
            </p>
            {item.retail_price && (
              <p className="mt-sm text-sm text-text-secondary">
                Originally purchased for <span className="font-medium text-text-primary">${item.retail_price}</span>
              </p>
            )}
            {item.user_min_price && (
              <p className="mt-xs text-sm text-text-muted">
                Owner&apos;s minimum: ${item.user_min_price}
              </p>
            )}
          </div>

          {/* Notes */}
          {item.notes && (
            <div className="mt-xl">
              <h3 className="text-sm font-medium text-text-secondary">Notes</h3>
              <p className="mt-xs text-md text-text-primary">{item.notes}</p>
            </div>
          )}

          {/* Description */}
          {item.description && (
            <div className="mt-lg">
              <h3 className="text-sm font-medium text-text-secondary">Description</h3>
              <p className="mt-xs text-md text-text-primary">{item.description}</p>
            </div>
          )}

          {/* Pending banner */}
          {isPending && !isSold && (
            <div className="mt-xl rounded-md bg-purple-100 py-md text-center">
              <span className="text-sm font-semibold text-purple-700">⏳ PENDING — A deal has been accepted on this item</span>
            </div>
          )}

          {/* Offers Section */}
          {activeOffers.length > 0 && (
            <div className="mt-xl rounded-md border border-border bg-card overflow-hidden">
              <div className="border-b border-border px-lg py-md">
                <h3 className="text-sm font-medium text-text-secondary">Offers ({activeOffers.length})</h3>
              </div>
              <div className="divide-y divide-border">
                {activeOffers.map((deal, idx) => {
                  const isAgreed = ['agreed', 'logistics'].includes(deal.status);
                  const isMyDeal = user?.id === deal.buyer_id;
                  const isTopOffer = idx === 0;
                  const buyerName = deal.buyer?.first_name || deal.buyer?.display_name || 'Buyer';
                  const buyerYear = deal.buyer?.graduation_year ? `'${String(deal.buyer.graduation_year).slice(-2)}` : '';
                  return (
                    <div key={deal.id} className={`flex items-center justify-between px-lg py-md ${
                      isMyDeal ? 'bg-accent-soft/30 border-l-[3px] border-l-accent' : isAgreed ? 'bg-purple-50' : ''
                    }`}>
                      <div className="flex items-center gap-md">
                        <span className={`text-sm font-medium ${isMyDeal ? 'font-bold text-accent' : 'text-text-primary'}`}>
                          {buyerName} {buyerYear}
                        </span>
                        {isAgreed && (
                          <Badge variant="purple">Accepted</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-md">
                        <span className="text-xs text-text-muted">{new Date(deal.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                        <span className={`text-sm font-semibold ${isMyDeal ? 'text-accent font-bold' : isTopOffer ? 'text-success' : 'text-text-primary'}`}>
                          ${deal.current_offer}
                        </span>
                        {/* Owner-only actions */}
                        {isOwner && deal.status === 'negotiating' && deal.current_offer && !isPending && (
                          <button
                            onClick={() => handleAcceptOffer(deal.id)}
                            disabled={!!acceptingDealId}
                            className="rounded-full bg-success px-lg py-xs text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                          >
                            {acceptingDealId === deal.id ? '...' : 'Accept'}
                          </button>
                        )}
                        {isOwner && (
                          <Link href={`/deals/${deal.id}`} className="rounded-full border border-border px-lg py-xs text-xs font-medium text-text-primary hover:bg-accent-soft">
                            Chat
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action */}
          {!isOwner && (
            <div className="mt-2xl">
              {isSold ? (
                <div className="rounded-md bg-neutral-500 py-lg text-center">
                  <span className="text-lg font-bold tracking-widest text-white">SOLD</span>
                </div>
              ) : user ? (
                existingDeal ? (
                  <Button variant="secondary" className="w-full" disabled>
                    Offer submitted
                  </Button>
                ) : (
                  <Button onClick={() => setBidModalOpen(true)} className="w-full">
                    Make an offer
                  </Button>
                )
              ) : (
                <Button onClick={() => router.push(`/login?redirect=/items/${item.id}`)} className="w-full">
                  Sign in to make an offer
                </Button>
              )}
            </div>
          )}

          {/* Owner actions */}
          {isOwner && (
            <div className="mt-2xl space-y-md">
              <div className="flex gap-md">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={async () => {
                    await markItemAsSold(item.id);
                    const { data } = await getItemById(itemId);
                    setItem(data);
                  }}
                >
                  Mark as Sold
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1 text-danger hover:bg-danger-soft/50"
                  onClick={async () => {
                    const confirmed = window.confirm('Remove this item? This cannot be undone.');
                    if (!confirmed) return;
                    await deleteItem(item.id);
                    router.push('/my-list');
                  }}
                >
                  Remove
                </Button>
              </div>
              {activeOffers.length === 0 && (
                <p className="text-sm text-text-muted">No offers yet. Share the link to get buyers!</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Other items from same owner */}
      {otherItems.length > 0 && (
        <div className="mt-3xl">
          <div className="mb-lg">
            <h2 className="font-heading text-lg font-semibold text-text-primary">
              More from {isOwner ? 'you' : sellerName}
            </h2>
          </div>
          <div className="flex gap-md overflow-x-auto pb-sm -mx-sm px-sm">
            {otherItems.map((other) => {
              const otherPhoto = other.photos?.[0] || other.image_path;
              return (
                <Link
                  key={other.id}
                  href={`/items/${other.id}`}
                  className="flex-shrink-0 w-36 rounded-md border border-border bg-card overflow-hidden transition-shadow hover:shadow-sm"
                >
                  <div className="aspect-square bg-accent-soft">
                    {otherPhoto ? (
                      <img src={getPublicUrl(otherPhoto)} alt={other.title || ''} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-2xl text-text-muted">{other.label || '📦'}</div>
                    )}
                  </div>
                  <div className="p-sm">
                    <p className="truncate text-sm font-medium text-text-primary">{other.title || 'Untitled'}</p>
                    <p className="mt-xs text-xs text-text-muted">
                      {other.estimated_value_min && other.estimated_value_max
                        ? `$${other.estimated_value_min} – $${other.estimated_value_max}`
                        : other.market_value_min && other.market_value_max
                        ? `$${other.market_value_min} – $${other.market_value_max}`
                        : 'Price TBD'}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Bid Modal */}
      <Modal open={bidModalOpen} onClose={() => { setBidModalOpen(false); setBidQuestion(''); }} title="Make an offer">
        <div className="space-y-lg">
          {bidError && (
            <div className="rounded-md bg-danger-soft px-lg py-md text-sm text-danger">{bidError}</div>
          )}
          <div>
            <label htmlFor="bidAmount" className="mb-sm block text-sm text-text-secondary">
              Your offer (optional)
            </label>
            <div className="relative">
              <span className="absolute left-md top-1/2 -translate-y-1/2 text-text-muted">$</span>
              <input
                id="bidAmount"
                type="number"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder="Enter amount"
                min="0"
                step="1"
                className="w-full rounded-md border border-border bg-card py-md pl-8 pr-md text-md text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
            </div>
            <p className="mt-xs text-xs text-text-muted">
              Leave blank to express interest without a specific offer
            </p>
          </div>
          <div>
            <label htmlFor="bidQuestion" className="mb-sm block text-sm text-text-secondary">
              Question for owner (optional)
            </label>
            <textarea
              id="bidQuestion"
              value={bidQuestion}
              onChange={(e) => setBidQuestion(e.target.value)}
              placeholder="Any questions about the item?"
              rows={2}
              className="w-full rounded-md border border-border bg-card px-md py-sm text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none resize-none"
            />
          </div>
          <div className="flex gap-md">
            <Button variant="secondary" onClick={() => { setBidModalOpen(false); setBidQuestion(''); }} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleBid} disabled={bidLoading} className="flex-1">
              {bidLoading ? 'Sending...' : bidAmount ? `Offer $${bidAmount}` : 'Express interest'}
            </Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
