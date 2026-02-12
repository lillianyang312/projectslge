import { createClient } from '@/lib/supabase/client';
import type { Deal, Message, DealStatus } from '@/types/models';
import { INBOX_PAGE_SIZE } from '@/lib/constants';

export interface DealsCursor {
  updated_at: string;
  id: string;
}

export interface PaginatedDealsResponse {
  deals: Deal[];
  nextCursor?: DealsCursor;
  hasMore: boolean;
}

export interface ItemQuestion {
  id: string;
  dealId: string;
  buyerId: string;
  buyerName: string;
  questionText: string;
  isAnswered: boolean;
  createdAt: string;
  replies: { id: string; senderId: string; content: string; createdAt: string }[];
}

export async function expressInterest(
  buyerId: string,
  itemId: string,
  maxBid?: number,
  interestedFor?: string,
  question?: string
): Promise<{ deal: Deal | null; error: string | null }> {
  try {
    const supabase = createClient();

    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('owner_id, title, estimated_value_min, estimated_value_max')
      .eq('id', itemId)
      .single();

    if (itemError || !item) return { deal: null, error: 'Item not found' };
    if (item.owner_id === buyerId) return { deal: null, error: 'Cannot bid on your own item' };

    // Check if item is already sold
    const { data: completedDeal } = await supabase
      .from('deals')
      .select('id')
      .eq('item_id', itemId)
      .eq('status', 'completed')
      .limit(1)
      .maybeSingle();

    if (completedDeal) return { deal: null, error: 'This item has been sold' };

    const { data: existingDeal } = await supabase
      .from('deals')
      .select('id')
      .eq('buyer_id', buyerId)
      .eq('item_id', itemId)
      .not('status', 'eq', 'cancelled')
      .single();

    if (existingDeal) return { deal: null, error: 'You already have a pending bid on this item' };

    const { data: match, error: matchError } = await supabase
      .from('matches')
      .insert({ buyer_id: buyerId, seller_id: item.owner_id, item_id: itemId, match_score: 80, status: 'deal' })
      .select()
      .single();

    if (matchError) return { deal: null, error: 'Failed to create match' };

    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .insert({
        match_id: match.id,
        buyer_id: buyerId,
        seller_id: item.owner_id,
        item_id: itemId,
        status: 'negotiating',
        current_offer: maxBid || null,
        buyer_offer: maxBid || null,
        last_offer_by: maxBid ? buyerId : null,
        interested_for: interestedFor || null,
      })
      .select('*, item:items!deals_item_id_fkey(*)')
      .single();

    if (dealError) return { deal: null, error: 'Failed to create deal' };

    if (maxBid) {
      await sendMessage(deal.id, buyerId, `Offered $${maxBid}`, 'offer', { amount: maxBid });
    } else {
      await sendMessage(deal.id, buyerId, 'Expressed interest in this item', 'text');
    }

    if (question) {
      await sendMessage(deal.id, buyerId, question, 'text');
    }

    return { deal, error: null };
  } catch (error) {
    return { deal: null, error: 'Something went wrong' };
  }
}

export async function getMyDeals(
  userId: string,
  limit?: number,
  cursor?: DealsCursor
): Promise<PaginatedDealsResponse> {
  try {
    const supabase = createClient();
    const pageSize = limit || INBOX_PAGE_SIZE;
    const fetchLimit = pageSize + 1;

    let query = supabase
      .from('deals')
      .select('*, item:items(*)')
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order('updated_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(fetchLimit);

    if (cursor?.updated_at && cursor?.id) {
      query = query.or(
        `updated_at.lt.${cursor.updated_at},and(updated_at.eq.${cursor.updated_at},id.lt.${cursor.id})`
      );
    }

    const { data: deals, error } = await query;
    if (error) throw error;

    const fetchedDeals = deals || [];
    const hasMore = fetchedDeals.length > pageSize;
    const pageDeals = fetchedDeals.slice(0, pageSize);
    const lastDeal = pageDeals[pageDeals.length - 1];
    const nextCursor = hasMore && lastDeal
      ? { updated_at: lastDeal.updated_at, id: lastDeal.id }
      : undefined;

    return { deals: pageDeals, nextCursor, hasMore };
  } catch {
    return { deals: [], hasMore: false };
  }
}

export async function getDealsByItemId(itemId: string): Promise<Deal[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('deals')
      .select('*, item:items(*), buyer:profiles!deals_buyer_id_fkey(display_name)')
      .eq('item_id', itemId)
      .not('status', 'eq', 'cancelled')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}

export async function getDealById(dealId: string): Promise<Deal | null> {
  try {
    const supabase = createClient();
    const { data: deal, error } = await supabase
      .from('deals')
      .select('*, item:items(*)')
      .eq('id', dealId)
      .single();

    if (error || !deal) return null;

    const isAccepted = ['agreed', 'logistics', 'completed'].includes(deal.status);
    if (isAccepted) {
      const [buyerResult, sellerResult] = await Promise.all([
        supabase.from('user_profiles')
          .select('id, full_name, house, graduation_year, dorm_building, dorm_room, last_seen_at, rating, rating_count, sales_completed, purchases_completed')
          .eq('id', deal.buyer_id).maybeSingle(),
        supabase.from('user_profiles')
          .select('id, full_name, house, graduation_year, dorm_building, dorm_room, last_seen_at, rating, rating_count, sales_completed, purchases_completed')
          .eq('id', deal.seller_id).maybeSingle(),
      ]);

      if (buyerResult.data) {
        const b = buyerResult.data;
        deal.buyer = {
          id: b.id, email: '', display_name: b.full_name || 'Buyer',
          neighborhood: b.house || undefined,
          dorm_location: [b.dorm_building, b.dorm_room].filter(Boolean).join(' ') || undefined,
          graduation_year: b.graduation_year || undefined,
          last_seen_at: b.last_seen_at || undefined,
          rating: b.rating || undefined, rating_count: b.rating_count || 0,
          sales_completed: b.sales_completed || 0, purchases_completed: b.purchases_completed || 0,
          created_at: '',
        };
      } else {
        deal.buyer = { id: deal.buyer_id, email: '', display_name: 'Buyer', created_at: '' };
      }

      if (sellerResult.data) {
        const s = sellerResult.data;
        deal.seller = {
          id: s.id, email: '', display_name: s.full_name || 'Seller',
          neighborhood: s.house || undefined,
          dorm_location: [s.dorm_building, s.dorm_room].filter(Boolean).join(' ') || undefined,
          graduation_year: s.graduation_year || undefined,
          last_seen_at: s.last_seen_at || undefined,
          rating: s.rating || undefined, rating_count: s.rating_count || 0,
          sales_completed: s.sales_completed || 0, purchases_completed: s.purchases_completed || 0,
          created_at: '',
        };
      } else {
        deal.seller = { id: deal.seller_id, email: '', display_name: 'Seller', created_at: '' };
      }
    }

    return deal;
  } catch {
    return null;
  }
}

export async function makeOffer(dealId: string, amount: number, userId: string): Promise<boolean> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('deals')
      .update({ current_offer: amount, buyer_offer: amount, last_offer_by: userId })
      .eq('id', dealId);

    if (error) throw error;
    await sendMessage(dealId, userId, `Offered $${amount}`, 'offer', { amount });
    return true;
  } catch {
    return false;
  }
}

export async function counterOffer(dealId: string, amount: number, userId: string): Promise<boolean> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('deals')
      .update({ current_offer: amount, last_offer_by: userId })
      .eq('id', dealId);

    if (error) throw error;
    await sendMessage(dealId, userId, `Counter-offered $${amount}`, 'counter', { amount });
    return true;
  } catch {
    return false;
  }
}

export async function acceptOffer(dealId: string, userId: string): Promise<boolean> {
  try {
    const deal = await getDealById(dealId);
    if (!deal || !deal.current_offer) return false;

    const supabase = createClient();
    const { error } = await supabase
      .from('deals')
      .update({ agreed_price: deal.current_offer, status: 'agreed' })
      .eq('id', dealId);

    if (error) throw error;
    await sendMessage(dealId, userId, `Accepted offer of $${deal.current_offer}`, 'system');

    // Notify other active buyers that item is now pending
    const supabase2 = createClient();
    const { data: otherDeals } = await supabase2
      .from('deals')
      .select('id')
      .eq('item_id', deal.item_id)
      .eq('status', 'negotiating')
      .neq('id', dealId);

    if (otherDeals) {
      for (const otherDeal of otherDeals) {
        await sendAgentMessage(
          otherDeal.id,
          'This item is now pending sale to another buyer. Your offer is still on file in case the deal falls through.'
        );
      }
    }

    return true;
  } catch {
    return false;
  }
}

export async function setLogistics(
  dealId: string,
  logistics: { delivery_method: 'pickup' | 'shipping'; pickup_location?: string; pickup_date?: string; shipping_address?: string }
): Promise<boolean> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('deals')
      .update({ ...logistics, status: 'logistics' })
      .eq('id', dealId);

    if (error) throw error;
    return true;
  } catch {
    return false;
  }
}

export async function completeDeal(dealId: string, userId: string): Promise<boolean> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('deals').update({ status: 'completed' }).eq('id', dealId);
    if (error) throw error;
    await sendMessage(dealId, userId, 'Deal completed!', 'system');

    // Get the deal for item_id
    const completedDeal = await getDealById(dealId);
    if (completedDeal) {
      // Notify other buyers
      const supabase3 = createClient();
      const { data: otherDeals } = await supabase3
        .from('deals')
        .select('id')
        .eq('item_id', completedDeal.item_id)
        .neq('id', dealId)
        .not('status', 'in', '("completed","cancelled")');

      if (otherDeals) {
        for (const otherDeal of otherDeals) {
          await sendAgentMessage(
            otherDeal.id,
            'This item has been sold to another buyer.'
          );
        }
      }

      // Mark item as sold
      const supabase4 = createClient();
      await supabase4
        .from('items')
        .update({ status: 'sold' })
        .eq('id', completedDeal.item_id);
    }

    return true;
  } catch {
    return false;
  }
}

export async function cancelDeal(dealId: string, userId: string): Promise<boolean> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('deals').update({ status: 'cancelled' }).eq('id', dealId);
    if (error) throw error;
    await sendMessage(dealId, userId, 'Deal cancelled', 'system');
    return true;
  } catch {
    return false;
  }
}

export async function getMessages(dealId: string): Promise<Message[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}

export async function sendMessage(
  dealId: string,
  senderId: string,
  content: string,
  messageType: 'text' | 'offer' | 'counter' | 'quick_action' | 'system' | 'broadcast' = 'text',
  metadata?: Record<string, unknown>
): Promise<Message | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('messages')
      .insert({ deal_id: dealId, sender_id: senderId, is_agent: false, content, message_type: messageType, metadata })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch {
    return null;
  }
}

export async function sendAgentMessage(
  dealId: string,
  content: string,
  metadata?: Record<string, unknown>
): Promise<Message | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('messages')
      .insert({ deal_id: dealId, sender_id: null, is_agent: true, content, message_type: 'system', metadata })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch {
    return null;
  }
}

export async function markDealAsRead(dealId: string, userId: string): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data: deal, error: fetchError } = await supabase
      .from('deals')
      .select('buyer_id, seller_id')
      .eq('id', dealId)
      .single();

    if (fetchError || !deal) return false;

    const now = new Date().toISOString();
    const updateField = deal.buyer_id === userId
      ? { buyer_last_read_at: now }
      : { seller_last_read_at: now };

    const { error } = await supabase.from('deals').update(updateField).eq('id', dealId);
    return !error;
  } catch {
    return false;
  }
}

export async function getTopBidsForItems(
  itemIds: string[]
): Promise<Record<string, { topBid: number | undefined; interestedCount: number; dealStatus?: 'pending' | 'sold' }>> {
  if (itemIds.length === 0) return {};

  try {
    const supabase = createClient();
    const { data: deals, error } = await supabase
      .from('deals')
      .select('item_id, current_offer, buyer_offer, status')
      .in('item_id', itemIds)
      .not('status', 'eq', 'cancelled');

    if (error) throw error;

    const result: Record<string, { topBid: number | undefined; interestedCount: number; dealStatus?: 'pending' | 'sold' }> = {};
    for (const itemId of itemIds) {
      result[itemId] = { topBid: undefined, interestedCount: 0 };
    }

    for (const deal of deals || []) {
      const itemId = deal.item_id;
      if (!result[itemId]) result[itemId] = { topBid: undefined, interestedCount: 0 };
      result[itemId].interestedCount++;

      if (deal.buyer_offer) {
        const offer = deal.buyer_offer;
        if (!result[itemId].topBid || offer > result[itemId].topBid!) {
          result[itemId].topBid = offer;
        }
      }

      // Track item deal status for public display
      if (deal.status === 'completed') {
        result[itemId].dealStatus = 'sold';
      } else if (['agreed', 'logistics'].includes(deal.status) && result[itemId].dealStatus !== 'sold') {
        result[itemId].dealStatus = 'pending';
      }
    }

    return result;
  } catch {
    return {};
  }
}

export async function getHighestBuyerOfferForItem(
  itemId: string
): Promise<number | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('deals')
      .select('buyer_offer')
      .eq('item_id', itemId)
      .not('status', 'eq', 'cancelled')
      .not('buyer_offer', 'is', null)
      .order('buyer_offer', { ascending: false })
      .limit(1);

    if (error) throw error;
    return data?.[0]?.buyer_offer ?? null;
  } catch {
    return null;
  }
}

export async function broadcastToItemBuyers(
  itemId: string,
  sellerId: string,
  message: string
): Promise<{ success: boolean; recipientsCount: number; error?: string }> {
  try {
    const supabase = createClient();
    const { data: deals, error: dealsError } = await supabase
      .from('deals')
      .select('id, buyer_id')
      .eq('item_id', itemId)
      .eq('seller_id', sellerId)
      .not('status', 'eq', 'cancelled')
      .not('status', 'eq', 'completed');

    if (dealsError) {
      return { success: false, recipientsCount: 0, error: String(dealsError) };
    }

    if (!deals || deals.length === 0) {
      return { success: true, recipientsCount: 0 };
    }

    let successCount = 0;
    for (const deal of deals) {
      await sendMessage(deal.id, sellerId, message, 'broadcast', {
        broadcast: true,
        item_id: itemId,
      });
      successCount++;
    }

    return { success: true, recipientsCount: successCount };
  } catch (error) {
    return { success: false, recipientsCount: 0, error: String(error) };
  }
}
