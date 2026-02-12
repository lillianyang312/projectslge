/**
 * Broadcast Service
 *
 * Handles broadcasting announcements from sellers to interested buyers.
 * Sends messages to all active deal chats for an item.
 */

import { supabase } from '../lib/supabase';
import { getDealById } from './dealsService';

/**
 * Broadcast a message to all interested buyers for an item
 * Sends the message to each buyer's individual deal chat
 */
export async function broadcastToItemBuyers(
  itemId: string,
  sellerId: string,
  message: string
): Promise<{ success: boolean; recipientsCount: number; error?: string }> {
  try {
    // Get all active deals for this item (these are the interested buyers)
    const { data: deals, error: dealsError } = await supabase
      .from('deals')
      .select('id, buyer_id')
      .eq('item_id', itemId)
      .eq('seller_id', sellerId)
      .not('status', 'eq', 'cancelled')
      .not('status', 'eq', 'completed');

    if (dealsError) {
      console.error('Error getting deals for broadcast:', dealsError);
      return { success: false, recipientsCount: 0, error: String(dealsError) };
    }

    if (!deals || deals.length === 0) {
      return { success: true, recipientsCount: 0 };
    }

    // Send broadcast message to each deal's chat
    let successCount: number = 0;
    for (const deal of deals) {
      try {
        const { error: insertError } = await supabase
          .from('messages')
          .insert({
            deal_id: deal.id,
            sender_id: sellerId,
            is_agent: false,
            content: message,
            message_type: 'broadcast',
            metadata: {
              broadcast: true,
              item_id: itemId,
            },
          });

        if (insertError) {
          console.error(`Failed to send broadcast to deal ${deal.id}:`, insertError);
        } else {
          successCount++;
        }
      } catch (err) {
        console.error(`Failed to send broadcast to deal ${deal.id}:`, err);
      }
    }

    console.log(`Broadcast sent to ${successCount}/${deals.length} buyers for item ${itemId}`);
    return { success: true, recipientsCount: successCount };
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

    console.log(`Broadcasting to buyer ${buyerId} for deal ${dealId}:`, message);

    return { success: true, recipientsCount: 1 };
  } catch (error) {
    console.error('Error broadcasting to deal buyer:', error);
    return { success: false, recipientsCount: 0, error: String(error) };
  }
}
