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
        interested_for: interestedFor || null,
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
 * Get a single deal by ID with buyer/seller profiles
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
    if (!deal) return null;

    // Fetch buyer and seller profiles if deal is accepted (agreed, logistics, or completed)
    const isAccepted = ['agreed', 'logistics', 'completed'].includes(deal.status);

    if (isAccepted) {
      console.log('📦 [getDealById] Fetching profiles for accepted deal:', dealId);

      // Fetch both profiles
      const [buyerResult, sellerResult] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('id, full_name, harvard_email, house, graduation_year')
          .eq('id', deal.buyer_id)
          .single(),
        supabase
          .from('user_profiles')
          .select('id, full_name, harvard_email, house, graduation_year')
          .eq('id', deal.seller_id)
          .single(),
      ]);

      console.log('📦 [getDealById] Buyer profile result:', buyerResult.data, buyerResult.error);
      console.log('📦 [getDealById] Seller profile result:', sellerResult.data, sellerResult.error);

      // Handle buyer profile - if not in user_profiles, try to get email from auth
      if (buyerResult.data) {
        const buyerDisplayName = buyerResult.data.full_name ||
          (buyerResult.data.harvard_email ? buyerResult.data.harvard_email.split('@')[0] : 'Buyer');
        deal.buyer = {
          id: buyerResult.data.id,
          email: buyerResult.data.harvard_email || '',
          display_name: buyerDisplayName,
          neighborhood: buyerResult.data.house || undefined,
          created_at: '',
        };
        console.log('✅ [getDealById] Set buyer display_name:', buyerDisplayName);
      } else {
        // Buyer profile doesn't exist - set a default with their ID
        console.log('⚠️ [getDealById] Buyer profile not found, using default');
        deal.buyer = {
          id: deal.buyer_id,
          email: '',
          display_name: 'Buyer',
          created_at: '',
        };
      }

      // Handle seller profile - if not in user_profiles, use default
      if (sellerResult.data) {
        const sellerDisplayName = sellerResult.data.full_name ||
          (sellerResult.data.harvard_email ? sellerResult.data.harvard_email.split('@')[0] : 'Seller');
        deal.seller = {
          id: sellerResult.data.id,
          email: sellerResult.data.harvard_email || '',
          display_name: sellerDisplayName,
          neighborhood: sellerResult.data.house || undefined,
          created_at: '',
        };
        console.log('✅ [getDealById] Set seller display_name:', sellerDisplayName);
      } else {
        // Seller profile doesn't exist - set a default with their ID
        console.log('⚠️ [getDealById] Seller profile not found, using default');
        deal.seller = {
          id: deal.seller_id,
          email: '',
          display_name: 'Seller',
          created_at: '',
        };
      }
    }

    return deal;
  } catch (error) {
    console.error('Error getting deal:', error);
    return null;
  }
}

/**
 * Make an offer on a deal and notify competing buyers if outbid
 */
export async function makeOffer(
  dealId: string,
  amount: number,
  userId: string
): Promise<boolean> {
  try {
    // First get the deal to know the item
    const deal = await getDealById(dealId);
    if (!deal) return false;

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

    // Notify other buyers who have been outbid
    await notifyOutbidBuyers(deal.item_id, dealId, amount);

    return true;
  } catch (error) {
    console.error('Error making offer:', error);
    return false;
  }
}

/**
 * Notify other buyers when they've been outbid
 */
async function notifyOutbidBuyers(
  itemId: string,
  currentDealId: string,
  newOfferAmount: number
): Promise<void> {
  try {
    // Get all other active deals on this item with lower offers
    const { data: competingDeals, error } = await supabase
      .from('deals')
      .select('id, current_offer, buyer_id')
      .eq('item_id', itemId)
      .eq('status', 'negotiating')
      .neq('id', currentDealId);

    if (error || !competingDeals) return;

    // Notify buyers who have been outbid (their offer is lower)
    for (const deal of competingDeals) {
      if (deal.current_offer && deal.current_offer < newOfferAmount) {
        // Send agent message notifying them they've been outbid
        await sendAgentMessage(
          deal.id,
          `Heads up! Someone just made a higher offer of $${newOfferAmount} on this item. Your current offer is $${deal.current_offer}. Would you like to raise your offer to stay competitive?`,
          { outbidNotification: true, competingOffer: newOfferAmount }
        );
        console.log(`[dealsService] Notified buyer ${deal.buyer_id} they were outbid`);
      }
    }
  } catch (error) {
    console.error('Error notifying outbid buyers:', error);
    // Don't fail the main operation if notification fails
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

    // Get seller's scheduling info
    const sellerInfo = await getUserSchedulingInfo(deal.seller_id);

    // Build agent message with seller info if available
    let agentMsg = `Deal agreed at $${deal.current_offer}! Now let's arrange logistics.\n\n`;

    if (sellerInfo) {
      if (sellerInfo.dormLocation) {
        agentMsg += `📍 Seller's preferred meetup: ${sellerInfo.dormLocation}\n`;
      }
      if (sellerInfo.paymentPreference) {
        agentMsg += `💳 Seller accepts: ${sellerInfo.paymentPreference.split(',').join(', ')}\n`;
      }
      if (sellerInfo.dormLocation || sellerInfo.paymentPreference) {
        agentMsg += `\nSeller, please confirm if this location and payment method are still preferred for this transaction.`;
      }
    }

    // Create agent message
    await sendAgentMessage(dealId, agentMsg);

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
 * Includes buyer profiles for accepted deals
 */
export async function getDealsWithExpiration(itemId: string): Promise<Deal[]> {
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
    if (!deals) return [];

    // Fetch buyer profiles for accepted deals
    const acceptedDeals = deals.filter(d => ['agreed', 'logistics', 'completed'].includes(d.status));
    if (acceptedDeals.length > 0) {
      const buyerIds = acceptedDeals.map(d => d.buyer_id);
      console.log('📦 [getDealsWithExpiration] Fetching buyer profiles for IDs:', buyerIds);

      const { data: buyerProfiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, full_name, harvard_email, house')
        .in('id', buyerIds);

      if (profileError) {
        console.error('❌ [getDealsWithExpiration] Error fetching buyer profiles:', profileError);
      }

      console.log('📦 [getDealsWithExpiration] Fetched buyer profiles:', buyerProfiles);

      const profileMap = new Map(buyerProfiles?.map(p => [p.id, p]) || []);
      for (const deal of deals) {
        if (['agreed', 'logistics', 'completed'].includes(deal.status)) {
          const profile = profileMap.get(deal.buyer_id);
          console.log('📦 [getDealsWithExpiration] Mapping profile for deal:', deal.id, 'buyer:', deal.buyer_id, 'profile:', profile);
          if (profile) {
            // Use full_name if available, fallback to email prefix or 'Buyer'
            const displayName = profile.full_name ||
              (profile.harvard_email ? profile.harvard_email.split('@')[0] : 'Buyer');
            deal.buyer = {
              id: profile.id,
              email: profile.harvard_email || '',
              display_name: displayName,
              neighborhood: profile.house || undefined,
              created_at: '',
            };
            console.log('✅ [getDealsWithExpiration] Set buyer display_name:', displayName);
          } else {
            // Buyer profile doesn't exist - set a default
            console.log('⚠️ [getDealsWithExpiration] Buyer profile not found for:', deal.buyer_id);
            deal.buyer = {
              id: deal.buyer_id,
              email: '',
              display_name: 'Buyer',
              created_at: '',
            };
          }
        }
      }
    }

    return deals;
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

/**
 * Get top bid info for multiple items at once
 * Returns a map of itemId -> { topBid, interestedCount, bidStatus }
 */
export async function getTopBidsForItems(
  itemIds: string[],
  minPrices?: Record<string, number | undefined>,
  estimatedMaxPrices?: Record<string, number | undefined>
): Promise<Record<string, { topBid: number | undefined; interestedCount: number; bidStatus: 'accept' | 'consider' | 'low' | undefined }>> {
  if (itemIds.length === 0) return {};

  try {
    const { data: deals, error } = await supabase
      .from('deals')
      .select('item_id, current_offer, status')
      .in('item_id', itemIds)
      .not('status', 'eq', 'cancelled');

    if (error) throw error;

    const result: Record<string, { topBid: number | undefined; interestedCount: number; bidStatus: 'accept' | 'consider' | 'low' | undefined }> = {};

    // Initialize all items with default values
    for (const itemId of itemIds) {
      result[itemId] = { topBid: undefined, interestedCount: 0, bidStatus: undefined };
    }

    // Group deals by item and calculate top bid
    for (const deal of deals || []) {
      const itemId = deal.item_id;
      if (!result[itemId]) {
        result[itemId] = { topBid: undefined, interestedCount: 0, bidStatus: undefined };
      }

      result[itemId].interestedCount++;

      if (deal.current_offer) {
        const currentOffer = deal.current_offer;
        if (!result[itemId].topBid || currentOffer > result[itemId].topBid!) {
          result[itemId].topBid = currentOffer;

          // Determine bid status based on min price and estimated max
          const minPrice = minPrices?.[itemId];
          const estimatedMax = estimatedMaxPrices?.[itemId];

          if (minPrice && currentOffer >= minPrice) {
            // Bid is at or above minimum price - great!
            if (estimatedMax && currentOffer >= estimatedMax * 0.9) {
              result[itemId].bidStatus = 'accept'; // Within 90% of max estimate
            } else {
              result[itemId].bidStatus = 'consider';
            }
          } else if (minPrice && currentOffer < minPrice) {
            result[itemId].bidStatus = 'low';
          } else {
            // No min price set - use estimated value to determine
            if (estimatedMax && currentOffer >= estimatedMax * 0.8) {
              result[itemId].bidStatus = 'accept';
            } else if (estimatedMax && currentOffer >= estimatedMax * 0.5) {
              result[itemId].bidStatus = 'consider';
            } else {
              result[itemId].bidStatus = 'low';
            }
          }
        }
      }
    }

    return result;
  } catch (error) {
    console.error('Error getting top bids for items:', error);
    return {};
  }
}

/**
 * User profile info for scheduling coordination
 */
export interface UserSchedulingInfo {
  firstName: string;
  lastName: string;
  fullName: string;
  dormLocation: string | null;
  paymentPreference: string | null;
  house: string | null;
}

/**
 * Get user profile info for scheduling coordination
 */
export async function getUserSchedulingInfo(userId: string): Promise<UserSchedulingInfo | null> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('full_name, first_name, last_name, dorm_location, payment_preference, house')
      .eq('id', userId)
      .single();

    if (error || !data) {
      console.error('Error fetching user scheduling info:', error);
      return null;
    }

    return {
      firstName: data.first_name || data.full_name?.split(' ')[0] || 'User',
      lastName: data.last_name || data.full_name?.split(' ').slice(1).join(' ') || '',
      fullName: data.full_name || 'User',
      dormLocation: data.dorm_location,
      paymentPreference: data.payment_preference,
      house: data.house,
    };
  } catch (error) {
    console.error('Error getting user scheduling info:', error);
    return null;
  }
}

/**
 * Mark a deal as read by the current user
 * Updates the appropriate last_read_at field based on whether user is buyer or seller
 */
export async function markDealAsRead(dealId: string, userId: string): Promise<boolean> {
  try {
    // First, get the deal to determine if user is buyer or seller
    const { data: deal, error: fetchError } = await supabase
      .from('deals')
      .select('buyer_id, seller_id')
      .eq('id', dealId)
      .single();

    if (fetchError || !deal) {
      console.error('Error fetching deal for read marking:', fetchError);
      return false;
    }

    const now = new Date().toISOString();
    const updateField = deal.buyer_id === userId
      ? { buyer_last_read_at: now }
      : { seller_last_read_at: now };

    const { error: updateError } = await supabase
      .from('deals')
      .update(updateField)
      .eq('id', dealId);

    if (updateError) {
      console.error('Error marking deal as read:', updateError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in markDealAsRead:', error);
    return false;
  }
}
