/**
 * Deals Service
 *
 * Handles deal creation, negotiation, and lifecycle management.
 */

import { supabase } from '../lib/supabase';
import { Deal, Message, DealStatus } from '../types/models';

/**
 * Create a deal from a match
 */
export async function createDealFromMatch(
  matchId: string,
  buyerId: string,
  sellerId: string,
  itemId: string
): Promise<Deal | null> {
  try {
    const { data: deal, error } = await supabase
      .from('deals')
      .insert({
        match_id: matchId,
        buyer_id: buyerId,
        seller_id: sellerId,
        item_id: itemId,
        status: 'negotiating',
      })
      .select()
      .single();

    if (error) throw error;

    // Update match status to 'deal'
    await supabase
      .from('matches')
      .update({ status: 'deal' })
      .eq('id', matchId);

    return deal;
  } catch (error) {
    console.error('Error creating deal:', error);
    return null;
  }
}

/**
 * Get all deals for a user
 */
export async function getMyDeals(userId: string): Promise<Deal[]> {
  try {
    const { data: deals, error } = await supabase
      .from('deals')
      .select(`
        *,
        item:items!deals_item_id_fkey(*),
        buyer:auth.users!deals_buyer_id_fkey(id, email),
        seller:auth.users!deals_seller_id_fkey(id, email)
      `)
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return deals || [];
  } catch (error) {
    console.error('Error getting deals:', error);
    return [];
  }
}

/**
 * Get deals by status
 */
export async function getDealsByStatus(
  userId: string,
  status: DealStatus
): Promise<Deal[]> {
  try {
    const { data: deals, error } = await supabase
      .from('deals')
      .select(`
        *,
        item:items!deals_item_id_fkey(*),
        buyer:auth.users!deals_buyer_id_fkey(id, email),
        seller:auth.users!deals_seller_id_fkey(id, email)
      `)
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .eq('status', status)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return deals || [];
  } catch (error) {
    console.error('Error getting deals by status:', error);
    return [];
  }
}

/**
 * Get a single deal by ID
 */
export async function getDealById(dealId: string): Promise<Deal | null> {
  try {
    const { data: deal, error } = await supabase
      .from('deals')
      .select(`
        *,
        item:items!deals_item_id_fkey(*),
        buyer:auth.users!deals_buyer_id_fkey(id, email),
        seller:auth.users!deals_seller_id_fkey(id, email)
      `)
      .eq('id', dealId)
      .single();

    if (error) throw error;
    return deal;
  } catch (error) {
    console.error('Error getting deal:', error);
    return null;
  }
}

/**
 * Make an offer on a deal
 */
export async function makeOffer(
  dealId: string,
  amount: number,
  userId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('deals')
      .update({
        current_offer: amount,
        last_offer_by: userId,
      })
      .eq('id', dealId);

    if (error) throw error;

    // Create message record
    await sendMessage(dealId, userId, `Offered $${amount}`, 'offer', { amount });

    return true;
  } catch (error) {
    console.error('Error making offer:', error);
    return false;
  }
}

/**
 * Accept current offer
 */
export async function acceptOffer(dealId: string, userId: string): Promise<boolean> {
  try {
    // Get current deal to get offer amount
    const deal = await getDealById(dealId);
    if (!deal || !deal.current_offer) return false;

    const { error } = await supabase
      .from('deals')
      .update({
        agreed_price: deal.current_offer,
        status: 'agreed',
      })
      .eq('id', dealId);

    if (error) throw error;

    // Create message record
    await sendMessage(
      dealId,
      userId,
      `Accepted offer of $${deal.current_offer}`,
      'system'
    );

    // Create agent message
    await sendAgentMessage(
      dealId,
      `Deal agreed at $${deal.current_offer}! Now let's arrange logistics.`
    );

    return true;
  } catch (error) {
    console.error('Error accepting offer:', error);
    return false;
  }
}

/**
 * Set logistics (pickup or shipping)
 */
export async function setLogistics(
  dealId: string,
  logistics: {
    delivery_method: 'pickup' | 'shipping';
    pickup_location?: string;
    pickup_date?: string;
    shipping_address?: string;
  }
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('deals')
      .update({
        ...logistics,
        status: 'logistics',
      })
      .eq('id', dealId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error setting logistics:', error);
    return false;
  }
}

/**
 * Complete a deal
 */
export async function completeDeal(dealId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('deals')
      .update({ status: 'completed' })
      .eq('id', dealId);

    if (error) throw error;

    await sendMessage(dealId, userId, 'Deal completed!', 'system');

    return true;
  } catch (error) {
    console.error('Error completing deal:', error);
    return false;
  }
}

/**
 * Cancel a deal
 */
export async function cancelDeal(dealId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('deals')
      .update({ status: 'cancelled' })
      .eq('id', dealId);

    if (error) throw error;

    await sendMessage(dealId, userId, 'Deal cancelled', 'system');

    return true;
  } catch (error) {
    console.error('Error cancelling deal:', error);
    return false;
  }
}

/**
 * Get messages for a deal
 */
export async function getMessages(dealId: string): Promise<Message[]> {
  try {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return messages || [];
  } catch (error) {
    console.error('Error getting messages:', error);
    return [];
  }
}

/**
 * Send a message in a deal
 */
export async function sendMessage(
  dealId: string,
  senderId: string,
  content: string,
  messageType: 'text' | 'offer' | 'counter' | 'quick_action' | 'system' = 'text',
  metadata?: Record<string, any>
): Promise<Message | null> {
  try {
    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        deal_id: dealId,
        sender_id: senderId,
        is_agent: false,
        content,
        message_type: messageType,
        metadata,
      })
      .select()
      .single();

    if (error) throw error;
    return message;
  } catch (error) {
    console.error('Error sending message:', error);
    return null;
  }
}

/**
 * Send an agent message
 */
export async function sendAgentMessage(
  dealId: string,
  content: string,
  metadata?: Record<string, any>
): Promise<Message | null> {
  try {
    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        deal_id: dealId,
        sender_id: null,
        is_agent: true,
        content,
        message_type: 'system',
        metadata,
      })
      .select()
      .single();

    if (error) throw error;
    return message;
  } catch (error) {
    console.error('Error sending agent message:', error);
    return null;
  }
}
