'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageContainer from '@/components/layout/PageContainer';
import { Badge, Button, Spinner, Avatar } from '@/components/ui';
import { getDealById, getDealsByItemId, sendMessage, makeOffer, counterOffer, acceptOffer, cancelDeal, markDealAsRead, getHighestBuyerOfferForItem, broadcastToItemBuyers, setLogistics, completeDeal } from '@/services/dealsService';
import { getPublicUrl } from '@/services/imageService';
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';
import { useAuthStore } from '@/stores/authStore';
import type { Deal, Message } from '@/types/models';

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatOfferDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return `Today ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (diffDays === 1) return `Yesterday ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (diffDays < 7) return `${d.toLocaleDateString([], { weekday: 'short' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function DealDetailPage(): React.ReactElement {
  const params = useParams();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const dealId = params.id as string;

  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [messageText, setMessageText] = useState<string>('');
  const [offerAmount, setOfferAmount] = useState<string>('');
  const [offerLoading, setOfferLoading] = useState<boolean>(false);
  const [showOfferInput, setShowOfferInput] = useState<boolean>(false);
  const [highestOffer, setHighestOffer] = useState<number | null>(null);
  const [broadcastText, setBroadcastText] = useState<string>('');
  const [broadcastSending, setBroadcastSending] = useState<boolean>(false);
  const [showSchedule, setShowSchedule] = useState<boolean>(false);
  const [pickupLocation, setPickupLocation] = useState<string>('');
  const [pickupDate, setPickupDate] = useState<string>('');
  const [scheduleLoading, setScheduleLoading] = useState<boolean>(false);
  const [completingDeal, setCompletingDeal] = useState<boolean>(false);
  const [allItemDeals, setAllItemDeals] = useState<Deal[]>([]);

  const { messages } = useRealtimeMessages(dealId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      const data = await getDealById(dealId);
      setDeal(data);
      setLoading(false);
      if (data && user) {
        markDealAsRead(dealId, user.id);
        const [highest, itemDeals] = await Promise.all([
          getHighestBuyerOfferForItem(data.item_id),
          getDealsByItemId(data.item_id),
        ]);
        setHighestOffer(highest);
        setAllItemDeals(itemDeals);
      }
    }
    load();
  }, [dealId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (): Promise<void> => {
    if (!user || !messageText.trim()) return;
    await sendMessage(dealId, user.id, messageText.trim());
    setMessageText('');
  };

  const handleOffer = async (): Promise<void> => {
    if (!user || !deal || !offerAmount) return;
    setOfferLoading(true);
    const amount = parseFloat(offerAmount);
    const isSeller = deal.seller_id === user.id;

    if (isSeller) {
      await counterOffer(dealId, amount, user.id);
    } else {
      await makeOffer(dealId, amount, user.id);
    }

    setShowOfferInput(false);
    setOfferAmount('');
    setOfferLoading(false);
    const updated = await getDealById(dealId);
    setDeal(updated);
  };

  const handleAccept = async (): Promise<void> => {
    if (!user) return;
    await acceptOffer(dealId, user.id);
    const updated = await getDealById(dealId);
    setDeal(updated);
  };

  const handleCancel = async (): Promise<void> => {
    if (!user) return;
    const confirmed = window.confirm('Are you sure you want to cancel this deal?');
    if (!confirmed) return;
    const success = await cancelDeal(dealId, user.id);
    if (success) {
      router.push('/deals');
    }
  };

  const handleBroadcast = async (): Promise<void> => {
    if (!user || !deal || !broadcastText.trim()) return;
    setBroadcastSending(true);
    const result = await broadcastToItemBuyers(deal.item_id, user.id, broadcastText.trim());
    if (result.success) {
      setBroadcastText('');
    }
    setBroadcastSending(false);
  };

  const handleSchedule = async (): Promise<void> => {
    if (!pickupLocation.trim() && !pickupDate) return;
    setScheduleLoading(true);
    const success = await setLogistics(dealId, {
      delivery_method: 'pickup',
      pickup_location: pickupLocation.trim() || undefined,
      pickup_date: pickupDate || undefined,
    });
    if (success && user) {
      const details = [
        pickupLocation.trim() && `📍 Location: ${pickupLocation.trim()}`,
        pickupDate && `📅 Date: ${new Date(pickupDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`,
      ].filter(Boolean).join('\n');
      await sendMessage(dealId, user.id, `Scheduled pickup:\n${details}`, 'system');
      const updated = await getDealById(dealId);
      setDeal(updated);
      setShowSchedule(false);
    }
    setScheduleLoading(false);
  };

  const handleCompleteDeal = async (): Promise<void> => {
    if (!user) return;
    const confirmed = window.confirm('Confirm that the item has been picked up and the deal is complete?');
    if (!confirmed) return;
    setCompletingDeal(true);
    const success = await completeDeal(dealId, user.id);
    if (success) {
      const updated = await getDealById(dealId);
      setDeal(updated);
    }
    setCompletingDeal(false);
  };

  if (loading) {
    return <PageContainer className="flex justify-center py-huge"><Spinner size="lg" /></PageContainer>;
  }

  if (!deal) {
    return <PageContainer><p className="py-huge text-center text-text-secondary">Deal not found</p></PageContainer>;
  }

  const isSeller = user?.id === deal.seller_id;
  const isBuyer = user?.id === deal.buyer_id;
  const item = deal.item;
  const photoPath = item?.photos?.[0] || item?.image_path;
  const counterparty = isSeller ? deal.buyer : deal.seller;
  const canCounter = deal.status === 'negotiating' && deal.last_offer_by !== user?.id;
  const canAccept = deal.status === 'negotiating' && deal.current_offer && deal.last_offer_by !== user?.id;
  const isAccepted = ['agreed', 'logistics', 'completed'].includes(deal.status);

  const statusBadge = (): { label: string; variant: 'blue' | 'purple' | 'success' | 'warning' | 'neutral' } => {
    switch (deal.status) {
      case 'negotiating': return { label: 'Negotiating', variant: 'blue' };
      case 'agreed': return { label: 'Agreed', variant: 'purple' };
      case 'logistics': return { label: deal.pickup_date ? 'Scheduled' : 'Scheduling', variant: 'warning' };
      case 'completed': return { label: 'Complete', variant: 'success' };
      case 'cancelled': return { label: 'Cancelled', variant: 'neutral' };
      default: return { label: deal.status, variant: 'blue' };
    }
  };

  const badge = statusBadge();

  return (
    <PageContainer className="max-w-3xl">
      <button onClick={() => router.back()} className="mb-xl text-sm text-text-secondary hover:text-text-primary">
        &larr; Back
      </button>

      {/* Deal header */}
      <div className="mb-xl flex items-center gap-lg rounded-md border border-border bg-card p-lg">
        {photoPath && (
          <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-accent-soft">
            <img src={getPublicUrl(photoPath)} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-lg font-medium text-text-primary">{item?.title || 'Item'}</p>
          <div className="mt-xs flex items-center gap-sm">
            <Badge variant={badge.variant}>{badge.label}</Badge>
            {deal.current_offer && !deal.agreed_price && (
              <span className="text-md font-medium">Current: ${deal.current_offer}</span>
            )}
            {deal.agreed_price && (
              <span className="text-md font-medium text-success">Agreed: ${deal.agreed_price}</span>
            )}
          </div>
        </div>
        {counterparty && (
          <a href={`/users/${counterparty.id}`} className="flex items-center gap-sm hover:opacity-80 transition-opacity">
            <Avatar name={counterparty.first_name || counterparty.display_name || ''} size="sm" />
            <div className="text-right">
              <span className="text-sm font-medium text-accent">
                {counterparty.first_name || counterparty.display_name || 'User'}
                {counterparty.graduation_year ? ` '${String(counterparty.graduation_year).slice(-2)}` : ''}
              </span>
              {counterparty.rating && (
                <p className="text-xs text-text-muted">⭐ {counterparty.rating.toFixed(1)}</p>
              )}
            </div>
          </a>
        )}
      </div>

      {/* Profile details — compact, no heading, clickable name */}
      {counterparty && (
        <div className="mb-xl rounded-md border border-border bg-card p-lg">
          <div className="flex items-center gap-lg">
            <a href={`/users/${counterparty.id}`}>
              <Avatar name={counterparty.first_name || counterparty.display_name || ''} size="md" />
            </a>
            <div className="flex-1 space-y-xs">
              <a href={`/users/${counterparty.id}`} className="text-md font-medium text-accent hover:underline">
                {counterparty.first_name || counterparty.display_name || 'Unknown'}
                {counterparty.graduation_year ? ` '${String(counterparty.graduation_year).slice(-2)}` : ''}
              </a>
              <div className="flex gap-lg text-xs text-text-muted">
                {counterparty.rating && (
                  <span>⭐ {counterparty.rating.toFixed(1)} ({counterparty.rating_count || 0})</span>
                )}
                {(counterparty.sales_completed || 0) > 0 && (
                  <span>{counterparty.sales_completed} sales</span>
                )}
                {(counterparty.purchases_completed || 0) > 0 && (
                  <span>{counterparty.purchases_completed} purchases</span>
                )}
              </div>

              {/* Sensitive fields — only after deal accepted */}
              {isAccepted && (
                <div className="mt-sm space-y-xs border-t border-border pt-sm">
                  {counterparty.neighborhood && (
                    <p className="text-sm text-text-primary">🏠 {counterparty.neighborhood}</p>
                  )}
                  {counterparty.dorm_location && (
                    <p className="text-sm text-text-primary">📍 {counterparty.dorm_location}</p>
                  )}
                  {counterparty.phone_number && (
                    <p className="text-sm text-text-primary">📱 {counterparty.phone_number}</p>
                  )}
                  {counterparty.payment_preference && (
                    <div className="flex flex-wrap gap-xs">
                      <span className="text-xs text-text-muted">Accepts:</span>
                      {counterparty.payment_preference.split(',').filter(Boolean).map((m) => (
                        <span key={m} className="rounded-full bg-accent-soft px-sm py-0.5 text-xs text-text-primary">{m.trim()}</span>
                      ))}
                    </div>
                  )}
                  {counterparty.zelle_handle && (
                    <p className="text-xs text-text-muted">Zelle: {counterparty.zelle_handle}</p>
                  )}
                  {counterparty.venmo_handle && (
                    <p className="text-xs text-text-muted">Venmo: {counterparty.venmo_handle}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* All Offers table */}
      {allItemDeals.length > 0 && (
        <div className="mb-xl rounded-md border border-border bg-card">
          <div className="border-b border-border px-lg py-md">
            <h3 className="text-sm font-medium text-text-secondary">Offers ({allItemDeals.filter((d) => d.current_offer).length})</h3>
          </div>
          <div className="divide-y divide-border">
            {allItemDeals
              .filter((d) => d.current_offer)
              .sort((a, b) => (b.current_offer || 0) - (a.current_offer || 0))
              .map((d) => {
                const isCurrentDeal = d.id === dealId;
                const buyerName = d.buyer?.first_name || d.buyer?.display_name || 'Buyer';
                const buyerYear = d.buyer?.graduation_year ? `'${String(d.buyer.graduation_year).slice(-2)}` : '';
                const isTopOffer = highestOffer !== null && d.current_offer === highestOffer;
                return (
                  <div key={d.id} className={`flex items-center justify-between px-lg py-md ${isCurrentDeal ? 'bg-accent-soft/30' : ''}`}>
                    <div className="flex items-center gap-md">
                      <a href={d.buyer?.id ? `/users/${d.buyer.id}` : '#'} className="text-sm font-medium text-accent hover:underline">
                        {buyerName} {buyerYear}
                      </a>
                      {isCurrentDeal && (
                        <span className="text-[10px] text-text-muted">(this deal)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-md">
                      <span className="text-xs text-text-muted">{formatOfferDate(d.updated_at)}</span>
                      <span className={`text-sm font-semibold ${isTopOffer ? 'text-success' : 'text-text-primary'}`}>
                        ${d.current_offer}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Item Details */}
      {item && (
        <div className="mb-xl rounded-md border border-border bg-card p-lg">
          {/* Image gallery */}
          {item.photos && item.photos.length > 1 && (
            <div className="mb-lg flex gap-sm overflow-x-auto">
              {item.photos.map((photo: string, i: number) => (
                <div key={i} className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-md border border-border">
                  <img src={getPublicUrl(photo)} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}
          <h3 className="mb-md text-sm font-medium text-text-secondary">Item Details</h3>
          <div className="space-y-sm text-sm">
            {item.condition && (
              <div className="flex justify-between">
                <span className="text-text-muted">Condition</span>
                <span className="capitalize text-text-primary">{item.condition.replace('_', ' ')}</span>
              </div>
            )}
            {(item.estimated_value_min || item.estimated_value_max) && (
              <div className="flex justify-between">
                <span className="text-text-muted">Estimated value</span>
                <span className="text-text-primary">${item.estimated_value_min || '?'} – ${item.estimated_value_max || '?'}</span>
              </div>
            )}
            {item.retail_price && (
              <div className="flex justify-between">
                <span className="text-text-muted">Retail price</span>
                <span className="text-text-primary">${item.retail_price}</span>
              </div>
            )}
            {item.user_min_price && (
              <div className="flex justify-between">
                <span className="text-text-muted">Minimum price</span>
                <span className="text-text-primary">${item.user_min_price}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Broadcast to all buyers (seller only) */}
      {isSeller && deal.status === 'negotiating' && (
        <div className="mb-lg rounded-md border border-border bg-card p-lg">
          <p className="mb-sm text-sm font-medium text-text-secondary">Broadcast to all interested buyers</p>
          <div className="flex gap-sm">
            <input
              type="text"
              value={broadcastText}
              onChange={(e) => setBroadcastText(e.target.value)}
              placeholder="e.g., 'Can you do $25?'"
              className="flex-1 rounded-md border border-border bg-bg-alt px-md py-sm text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
            <Button size="sm" onClick={handleBroadcast} disabled={broadcastSending || !broadcastText.trim()}>
              {broadcastSending ? '...' : 'Send to all'}
            </Button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="mb-lg max-h-[50vh] overflow-y-auto rounded-md border border-border bg-bg-alt p-lg">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-text-muted py-xl">No messages yet</p>
        ) : (
          <div className="space-y-md">
            {messages.map((msg: Message) => {
              const isOwn = msg.sender_id === user?.id;
              const isAgent = msg.is_agent;

              return (
                <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-lg px-md py-sm ${
                    isAgent ? 'bg-accent-soft text-text-secondary italic' :
                    isOwn ? 'bg-accent text-white' : 'bg-card border border-border text-text-primary'
                  }`}>
                    {msg.message_type === 'broadcast' && (
                      <p className="mb-xs text-xs italic text-text-muted">Broadcast to all buyers</p>
                    )}
                    <p className="text-sm">{msg.content}</p>
                    <p className={`mt-xs text-xs ${isOwn ? 'text-white/60' : 'text-text-muted'}`}>
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Actions */}
      {deal.status === 'negotiating' && (
        <div className="space-y-md">
          {/* Inline offer input — shown when modify/counter is tapped */}
          {showOfferInput ? (
            <div className="flex items-center gap-sm">
              <div className="relative flex-1">
                <span className="absolute left-md top-1/2 -translate-y-1/2 text-text-muted">$</span>
                <input
                  type="number"
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && offerAmount) handleOffer(); }}
                  placeholder="Enter amount"
                  min="0"
                  autoFocus
                  className="w-full rounded-md border border-border bg-card py-sm pl-8 pr-md text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                />
              </div>
              <Button size="sm" onClick={handleOffer} disabled={offerLoading || !offerAmount}>
                {offerLoading ? '...' : 'Send'}
              </Button>
              <button
                onClick={() => { setShowOfferInput(false); setOfferAmount(''); }}
                className="text-sm text-text-muted hover:text-text-primary"
              >
                &times;
              </button>
            </div>
          ) : (
            <div className="flex gap-md">
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                placeholder="Type a message..."
                className="flex-1 rounded-md border border-border bg-card px-md py-sm text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
              <Button size="sm" onClick={handleSend} disabled={!messageText.trim()}>Send</Button>
            </div>
          )}

          {/* Action buttons row */}
          <div className="flex items-center gap-sm">
            <Button variant="secondary" size="sm" onClick={() => setShowOfferInput(true)}>
              {isSeller ? 'Counter offer' : 'Modify offer'}
            </Button>
            {canAccept && (
              <Button size="sm" onClick={handleAccept}>
                Accept ${deal.current_offer}
              </Button>
            )}
            <Button variant="destructive" size="sm" onClick={handleCancel}>
              Cancel deal
            </Button>
          </div>
        </div>
      )}

      {/* Agreed status — schedule pickup */}
      {deal.status === 'agreed' && (
        <div className="space-y-md">
          <div className="rounded-md bg-success-soft p-lg text-center">
            <p className="text-md font-medium text-success">Deal agreed at ${deal.agreed_price}!</p>
            <p className="mt-xs text-sm text-text-secondary">Schedule a pickup to continue.</p>
          </div>

          {/* Message input */}
          <div className="flex gap-md">
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
              placeholder="Type a message..."
              className="flex-1 rounded-md border border-border bg-card px-md py-sm text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
            <Button size="sm" onClick={handleSend} disabled={!messageText.trim()}>Send</Button>
          </div>

          {!showSchedule ? (
            <Button onClick={() => setShowSchedule(true)} className="w-full">
              📅 Schedule Pickup
            </Button>
          ) : (
            <div className="rounded-md border border-border bg-card p-lg space-y-md">
              <h4 className="text-sm font-medium text-text-primary">Schedule Pickup</h4>
              <div>
                <label className="mb-xs block text-xs text-text-secondary">Pickup location</label>
                <input
                  type="text"
                  value={pickupLocation}
                  onChange={(e) => setPickupLocation(e.target.value)}
                  placeholder="e.g., Lamont Library lobby"
                  className="w-full rounded-md border border-border bg-bg-alt px-md py-sm text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-xs block text-xs text-text-secondary">Date &amp; time</label>
                <input
                  type="datetime-local"
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="w-full rounded-md border border-border bg-bg-alt px-md py-sm text-sm text-text-primary focus:border-accent focus:outline-none"
                />
              </div>
              <div className="flex gap-sm">
                <Button variant="secondary" size="sm" onClick={() => setShowSchedule(false)}>Cancel</Button>
                <Button size="sm" onClick={handleSchedule} disabled={scheduleLoading || (!pickupLocation.trim() && !pickupDate)}>
                  {scheduleLoading ? 'Saving...' : 'Confirm Schedule'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Logistics status — pickup scheduled, can complete */}
      {deal.status === 'logistics' && (
        <div className="space-y-md">
          <div className="rounded-md bg-warning-soft p-lg">
            <p className="text-md font-medium text-warning">Pickup {deal.pickup_date ? 'Scheduled' : 'Being Arranged'}</p>
            {deal.pickup_location && (
              <p className="mt-xs text-sm text-text-secondary">📍 {deal.pickup_location}</p>
            )}
            {deal.pickup_date && (
              <p className="mt-xs text-sm text-text-secondary">📅 {new Date(deal.pickup_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
            )}
            <p className="mt-sm text-sm text-text-secondary">Agreed price: <span className="font-medium text-success">${deal.agreed_price}</span></p>
          </div>

          {/* Message input */}
          <div className="flex gap-md">
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
              placeholder="Type a message..."
              className="flex-1 rounded-md border border-border bg-card px-md py-sm text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
            <Button size="sm" onClick={handleSend} disabled={!messageText.trim()}>Send</Button>
          </div>

          <Button
            onClick={handleCompleteDeal}
            disabled={completingDeal}
            className="w-full"
          >
            {completingDeal ? 'Completing...' : '✅ Mark as Sold — Item Picked Up'}
          </Button>
        </div>
      )}

      {/* Completed status */}
      {deal.status === 'completed' && (
        <div className="rounded-md bg-success-soft p-lg text-center">
          <p className="text-lg font-medium text-success">🎉 Deal Complete!</p>
          <p className="mt-xs text-sm text-text-secondary">
            Sold for ${deal.agreed_price}. The item has been marked as sold.
          </p>
        </div>
      )}

      {/* Cancelled status */}
      {deal.status === 'cancelled' && (
        <div className="rounded-md bg-neutral-100 p-lg text-center">
          <p className="text-md font-medium text-text-muted">This deal was cancelled</p>
        </div>
      )}
    </PageContainer>
  );
}
