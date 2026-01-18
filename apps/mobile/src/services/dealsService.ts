/**
 * Deals Service
 *
 * Handles deal creation, negotiation, and lifecycle management.
 */

import { supabase } from '../lib/supabase';
import { Deal, Message, DealStatus } from '../types/models';

/**
 * Question from a buyer about an item
 */
export interface ItemQuestion {
  id: string;
  dealId: string;
  buyerId: string;
  buyerName: string;
  questionText: string;
  isAnswered: boolean;
  createdAt: string;
  replies: {
    id: string;
    senderId: string;
    content: string;
    createdAt: string;
  }[];
}

/**
 * Express interest in an item (create a bid)
 * This creates a match and deal in one step
 */
export async function expressInterest(
  buyerId: string,
  itemId: string,
  maxBid?: number,
  interestedFor?: string
): Promise<{ deal: Deal | null; error: string | null }> {
  try {
    // First, get the item to find the seller
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('owner_id, title, estimated_value_min, estimated_value_max')
      .eq('id', itemId)
      .single();

    if (itemError || !item) {
      return { deal: null, error: 'Item not found' };
    }

    if (item.owner_id === buyerId) {
      return { deal: null, error: 'Cannot bid on your own item' };
    }

    // Check if there's already a deal for this buyer+item
    const { data: existingDeal } = await supabase
      .from('deals')
      .select('id')
      .eq('buyer_id', buyerId)
      .eq('item_id', itemId)
      .not('status', 'eq', 'cancelled')
      .single();

    if (existingDeal) {
      return { deal: null, error: 'You already have a pending bid on this item' };
    }

    // Create a match first
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .insert({
        buyer_id: buyerId,
        seller_id: item.owner_id,
        item_id: itemId,
        match_score: 80, // Default score for direct interest
        status: 'deal', // Goes directly to deal status
      })
      .select()
      .single();

    if (matchError) {
      console.error('Error creating match:', matchError);
      return { deal: null, error: 'Failed to create match' };
    }

    // Create the deal
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .insert({
        match_id: match.id,
        buyer_id: buyerId,
        seller_id: item.owner_id,
        item_id: itemId,
        status: 'negotiating',
        current_offer: maxBid || null,
        last_offer_by: maxBid ? buyerId : null,
      })
      .select(`
        *,
        item:items!deals_item_id_fkey(*)
      `)
      .single();

    if (dealError) {
      console.error('Error creating deal:', dealError);
      return { deal: null, error: 'Failed to create deal' };
    }

    // Create initial message if there's a bid
    if (maxBid) {
      await sendMessage(deal.id, buyerId, `Offered $${maxBid}`, 'offer', { amount: maxBid });
    } else {
      await sendMessage(deal.id, buyerId, 'Expressed interest in this item', 'text');
    }

    // Add agent welcome message
    await sendAgentMessage(
      deal.id,
      maxBid
        ? `Great! You've offered $${maxBid} for "${item.title}". The seller will be notified and can accept, counter, or decline.`
        : `You've expressed interest in "${item.title}". Consider making an offer to get the seller's attention!`
    );

    console.log('✅ Created deal:', deal.id);
    return { deal, error: null };
  } catch (error) {
    console.error('Error expressing interest:', error);
    return { deal: null, error: 'Something went wrong' };
  }
}

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
        item:items(*)
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
        item:items(*)
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
 * Get all deals for a specific item (for owner to see bids)
 */
export async function getDealsByItemId(itemId: string): Promise<Deal[]> {
  try {
    const { data: deals, error } = await supabase
      .from('deals')
      .select(`
        *,
        item:items(*)
      `)
      .eq('item_id', itemId)
      .not('status', 'eq', 'cancelled')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return deals || [];
  } catch (error) {
    console.error('Error getting deals by item:', error);
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
        item:items(*)
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

/**
 * Get questions from buyers for a specific item
 * Questions are deals marked with is_question=true
 */
export async function getQuestionsForItem(itemId: string): Promise<ItemQuestion[]> {
  try {
    // Get deals that are questions for this item
    const { data: questionDeals, error } = await supabase
      .from('deals')
      .select(`
        id,
        buyer_id,
        created_at,
        updated_at
      `)
      .eq('item_id', itemId)
      .eq('is_question', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!questionDeals || questionDeals.length === 0) return [];

    // Get messages for these deals to extract questions and replies
    const questions: ItemQuestion[] = await Promise.all(
      questionDeals.map(async (deal) => {
        const messages = await getMessages(deal.id);

        // First message from buyer is the question
        const questionMessage = messages.find(m => m.sender_id === deal.buyer_id && !m.is_agent);

        // Replies are messages from seller (not agent, not buyer)
        const replies = messages
          .filter(m => m.sender_id !== deal.buyer_id && !m.is_agent && m.sender_id)
          .map(m => ({
            id: m.id,
            senderId: m.sender_id!,
            content: m.content,
            createdAt: m.created_at,
          }));

        return {
          id: deal.id,
          dealId: deal.id,
          buyerId: deal.buyer_id,
          buyerName: 'Buyer', // Simplified - could fetch from profiles
          questionText: questionMessage?.content || '',
          isAnswered: replies.length > 0,
          createdAt: deal.created_at,
          replies,
        };
      })
    );

    return questions;
  } catch (error) {
    console.error('Error getting questions for item:', error);
    return [];
  }
}

/**
 * Get deals with expiration info for a specific item
 */
export async function getDealsWithExpiration(itemId: string): Promise<Deal[]> {
  try {
    const { data: deals, error } = await supabase
      .from('deals')
      .select(`
        *,
        item:items(*),
        buyer:profiles!deals_buyer_id_fkey(id, display_name)
      `)
      .eq('item_id', itemId)
      .not('status', 'eq', 'cancelled')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return deals || [];
  } catch (error) {
    console.error('Error getting deals with expiration:', error);
    return [];
  }
}

/**
 * Reply to a buyer's question
 */
export async function replyToQuestion(
  questionDealId: string,
  sellerId: string,
  replyText: string
): Promise<boolean> {
  try {
    await sendMessage(questionDealId, sellerId, replyText, 'text');
    return true;
  } catch (error) {
    console.error('Error replying to question:', error);
    return false;
  }
}
