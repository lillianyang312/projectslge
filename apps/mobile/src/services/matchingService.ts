/**
 * Matching Service
 *
 * Handles intelligent matching between buyers and sellers.
 * Creates matches based on compatibility scores and user preferences.
 */

import { supabase } from '../lib/supabase';
import { Item, Match } from '../types/models';
import { calculateMatchScore } from './marketService';

/**
 * Find potential matches for a buyer's want
 */
export async function findMatchesForWant(
  want: Item,
  userId: string,
  limit: number = 20
): Promise<Item[]> {
  try {
    // Get active items in the same category from other users
    const { data: items, error } = await supabase
      .from('items')
      .select('*')
      .eq('intent', 'owned')
      .eq('is_active', true)
      .eq('phase', 'active')
      .neq('owner_id', userId)
      .limit(limit * 2); // Get more than needed for scoring

    if (error) throw error;
    if (!items) return [];

    // Calculate match scores and sort
    const scoredItems = items
      .map((item) => ({
        item,
        score: calculateMatchScore(want, item),
      }))
      .filter((scored) => scored.score >= 40) // Only show decent matches
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((scored) => scored.item);

    return scoredItems;
  } catch (error) {
    console.error('Error finding matches for want:', error);
    return [];
  }
}

/**
 * Find potential buyers for a seller's item
 */
export async function findBuyersForItem(
  item: Item,
  userId: string,
  limit: number = 20
): Promise<Item[]> {
  try {
    // Get active wants in the same category from other users
    const { data: wants, error } = await supabase
      .from('items')
      .select('*')
      .eq('intent', 'wanted')
      .eq('is_active', true)
      .eq('phase', 'active')
      .neq('owner_id', userId)
      .limit(limit * 2);

    if (error) throw error;
    if (!wants) return [];

    // Calculate match scores and sort
    const scoredWants = wants
      .map((want) => ({
        want,
        score: calculateMatchScore(want, item),
      }))
      .filter((scored) => scored.score >= 40)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((scored) => scored.want);

    return scoredWants;
  } catch (error) {
    console.error('Error finding buyers for item:', error);
    return [];
  }
}

/**
 * Create a match between buyer and seller
 */
export async function createMatch(
  buyerId: string,
  sellerId: string,
  itemId: string,
  wantId?: string
): Promise<Match | null> {
  try {
    // Fetch item and want to calculate match score
    const { data: item } = await supabase
      .from('items')
      .select('*')
      .eq('id', itemId)
      .single();

    let matchScore = 75; // Default score

    if (wantId && item) {
      const { data: want } = await supabase
        .from('items')
        .select('*')
        .eq('id', wantId)
        .single();

      if (want) {
        matchScore = calculateMatchScore(want, item);
      }
    }

    // Create match
    const { data: match, error } = await supabase
      .from('matches')
      .insert({
        buyer_id: buyerId,
        seller_id: sellerId,
        item_id: itemId,
        want_id: wantId,
        match_score: matchScore,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      // Handle unique constraint violation gracefully
      if (error.code === '23505') {
        console.log('Match already exists');
        return null;
      }
      throw error;
    }

    return match;
  } catch (error) {
    console.error('Error creating match:', error);
    return null;
  }
}

/**
 * Get all matches for a user (as buyer or seller)
 */
export async function getMyMatches(userId: string): Promise<Match[]> {
  try {
    const { data: matches, error } = await supabase
      .from('matches')
      .select(`
        *,
        item:items!matches_item_id_fkey(*),
        buyer:auth.users!matches_buyer_id_fkey(id, email),
        seller:auth.users!matches_seller_id_fkey(id, email)
      `)
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return matches || [];
  } catch (error) {
    console.error('Error getting matches:', error);
    return [];
  }
}

/**
 * Record a swipe action
 */
export async function recordSwipeAction(
  userId: string,
  itemId: string,
  action: 'good_deal' | 'skip' | 'save' | 'accept' | 'decline',
  context: 'buy' | 'sell'
): Promise<void> {
  try {
    await supabase.from('swipe_actions').upsert(
      {
        user_id: userId,
        item_id: itemId,
        action,
        context,
      },
      {
        onConflict: 'user_id,item_id,context',
      }
    );
  } catch (error) {
    console.error('Error recording swipe action:', error);
  }
}

/**
 * Get items for "Swipe to Buy" feed
 * Returns active items from sellers, excluding items already swiped
 */
export async function getSwipeToBuyFeed(
  userId: string,
  limit: number = 50
): Promise<Item[]> {
  try {
    // Get items user has already swiped on
    const { data: swipedActions } = await supabase
      .from('swipe_actions')
      .select('item_id')
      .eq('user_id', userId)
      .eq('context', 'buy');

    const swipedIds = swipedActions?.map((a) => a.item_id) || [];

    // Get active items, excluding swiped ones
    let query = supabase
      .from('items')
      .select('*')
      .eq('intent', 'owned')
      .eq('is_active', true)
      .eq('phase', 'active')
      .neq('owner_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (swipedIds.length > 0) {
      query = query.not('id', 'in', `(${swipedIds.join(',')})`);
    }

    const { data: items, error } = await query;

    if (error) throw error;
    return items || [];
  } catch (error) {
    console.error('Error getting swipe feed:', error);
    return [];
  }
}

/**
 * Get incoming interest for "Swipe to Sell" feed
 * Returns wants/buyers potentially interested in user's items
 */
export async function getSwipeToSellFeed(
  userId: string,
  limit: number = 50
): Promise<{ want: Item; myItem: Item }[]> {
  try {
    // Get user's active items
    const { data: myItems, error: itemsError } = await supabase
      .from('items')
      .select('*')
      .eq('owner_id', userId)
      .eq('intent', 'owned')
      .eq('is_active', true)
      .eq('phase', 'active');

    if (itemsError) throw itemsError;
    if (!myItems || myItems.length === 0) return [];

    // Get wants that might match
    const { data: wants, error: wantsError } = await supabase
      .from('items')
      .select('*')
      .eq('intent', 'wanted')
      .eq('is_active', true)
      .eq('phase', 'active')
      .neq('owner_id', userId)
      .limit(limit);

    if (wantsError) throw wantsError;
    if (!wants || wants.length === 0) return [];

    // Match wants to user's items
    const matches: { want: Item; myItem: Item; score: number }[] = [];

    for (const want of wants) {
      for (const myItem of myItems) {
        const score = calculateMatchScore(want, myItem);
        if (score >= 40) {
          matches.push({ want, myItem, score });
        }
      }
    }

    // Sort by score and return top matches
    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ want, myItem }) => ({ want, myItem }));
  } catch (error) {
    console.error('Error getting sell feed:', error);
    return [];
  }
}
