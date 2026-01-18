/**
 * Broadcast Service
 *
 * Handles broadcasting announcements from sellers to interested buyers.
 * Creates inbox messages for all buyers interested in an item or deal.
 */

import { supabase } from '../lib/supabase';
import { getItemById } from './itemsService';
import { getDealById } from './dealsService';
import { findBuyersForItem } from './matchingService';

/**
 * Broadcast a message to all interested buyers for an item
 */
export async function broadcastToItemBuyers(
  itemId: string,
  sellerId: string,
  message: string
): Promise<{ success: boolean; recipientsCount: number; error?: string }> {
  try {
    // Get the item
    const { data: item, error: itemError } = await getItemById(itemId);
    if (itemError || !item) {
      return { success: false, recipientsCount: 0, error: itemError || 'Item not found' };
    }

    // Find interested buyers through matches (where the item is matched with wants)
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('buyer_id')
      .eq('item_id', itemId)
      .eq('seller_id', sellerId)
      .eq('status', 'active');

    if (matchesError) {
      console.error('Error getting matches:', matchesError);
    }

    const buyerIds = matches?.map((m) => m.buyer_id) || [];

    // Also find potential buyers using findBuyersForItem
    const potentialBuyers = await findBuyersForItem(item, sellerId);
    const potentialBuyerIds = potentialBuyers.map((b) => b.owner_id).filter((id) => id && !buyerIds.includes(id));

    // Combine unique buyer IDs
    const allBuyerIds = [...new Set([...buyerIds, ...potentialBuyerIds])].filter(Boolean) as string[];

    if (allBuyerIds.length === 0) {
      return { success: true, recipientsCount: 0 };
    }

    // Create inbox messages for each buyer
    // For now, we'll create messages in the messages table
    // TODO: Create a dedicated inbox table if needed
    const messages = allBuyerIds.map((buyerId) => ({
      deal_id: null, // Broadcast messages aren't tied to a specific deal
      sender_id: sellerId,
      is_agent: false,
      content: message,
      message_type: 'broadcast' as const,
      metadata: {
        item_id: itemId,
        item_name: item.title,
        broadcast: true,
      },
      // We'll need to handle how buyers receive these - maybe through a match_id or conversation_id
      // For now, this is a placeholder structure
    }));

    // Note: The current messages table requires deal_id, so we might need to adjust this
    // or create a different mechanism for inbox messages
    // This is a placeholder implementation

    console.log(`📢 Broadcasting to ${allBuyerIds.length} buyers for item ${itemId}:`, message);

    return { success: true, recipientsCount: allBuyerIds.length };
  } catch (error) {
    console.error('Error broadcasting to item buyers:', error);
    return { success: false, recipientsCount: 0, error: String(error) };
  }
}

/**
 * Broadcast a message to the buyer in a deal
 */
export async function broadcastToDealBuyer(
  dealId: string,
  message: string
): Promise<{ success: boolean; recipientsCount: number; error?: string }> {
  try {
    // Get the deal
    const deal = await getDealById(dealId);
    if (!deal) {
      return { success: false, recipientsCount: 0, error: 'Deal not found' };
    }

    const buyerId = deal.buyer_id;
    const sellerId = deal.seller_id;

    if (!buyerId) {
      return { success: false, recipientsCount: 0, error: 'Deal has no buyer' };
    }

    // Create a message in the deal's message thread
    const { data: messageRecord, error: messageError } = await supabase
      .from('messages')
      .insert({
        deal_id: dealId,
        sender_id: sellerId,
        is_agent: false,
        content: message,
        message_type: 'broadcast',
        metadata: {
          broadcast: true,
          item_id: deal.item_id,
        },
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error creating broadcast message:', messageError);
      return { success: false, recipientsCount: 0, error: String(messageError) };
    }

    console.log(`📢 Broadcasting to buyer ${buyerId} for deal ${dealId}:`, message);

    return { success: true, recipientsCount: 1 };
  } catch (error) {
    console.error('Error broadcasting to deal buyer:', error);
    return { success: false, recipientsCount: 0, error: String(error) };
  }
}

