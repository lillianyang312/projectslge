import { supabase } from '../lib/supabase';

// Item status types
export type ItemStatus = 'active' | 'sold' | 'removed';

// Types matching the Supabase schema
export interface Item {
  id: string;
  owner_id: string;
  title: string;
  category: string;
  condition: string;
  photos: string[];
  estimated_value_min?: number;
  estimated_value_max?: number;
  retail_price?: number;
  min_price?: number;
  notes?: string;
  status?: ItemStatus;
  created_at: string;
}

export interface CreateItemInput {
  title: string;
  category: string;
  condition: string;
  photos: string[];
  estimated_value_min?: number;
  estimated_value_max?: number;
  retail_price?: number;
  min_price?: number;
  notes?: string;
}

export interface UpdateItemInput {
  title?: string;
  category?: string;
  condition?: string;
  photos?: string[];
  estimated_value_min?: number;
  estimated_value_max?: number;
  retail_price?: number;
  min_price?: number;
  notes?: string;
  status?: ItemStatus;
}

/**
 * Create a new item in Supabase
 */
export async function createItem(input: CreateItemInput): Promise<{ data: Item | null; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { data: null, error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('items')
      .insert({
        owner_id: user.id,
        title: input.title,
        category: input.category,
        condition: input.condition,
        photos: input.photos,
        // Set image_path to first photo or empty string (legacy field, still required)
        image_path: input.photos[0] || '',
        estimated_value_min: input.estimated_value_min,
        estimated_value_max: input.estimated_value_max,
        retail_price: input.retail_price,
        min_price: input.min_price,
        notes: input.notes,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating item:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err: any) {
    console.error('Error creating item:', err);
    return { data: null, error: err.message };
  }
}

/**
 * Get all items for the current user
 */
export async function getMyItems(): Promise<{ data: Item[]; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { data: [], error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching items:', error);
      return { data: [], error: error.message };
    }

    return { data: data || [], error: null };
  } catch (err: any) {
    console.error('Error fetching items:', err);
    return { data: [], error: err.message };
  }
}

/**
 * Get a single item by ID
 */
export async function getItemById(id: string): Promise<{ data: Item | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching item:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err: any) {
    console.error('Error fetching item:', err);
    return { data: null, error: err.message };
  }
}

/**
 * Update an item
 */
export async function updateItem(id: string, input: UpdateItemInput): Promise<{ data: Item | null; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { data: null, error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('items')
      .update(input)
      .eq('id', id)
      .eq('owner_id', user.id) // Ensure user owns the item
      .select()
      .single();

    if (error) {
      console.error('Error updating item:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err: any) {
    console.error('Error updating item:', err);
    return { data: null, error: err.message };
  }
}

/**
 * Delete an item
 */
export async function deleteItem(id: string): Promise<{ error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { error: 'User not authenticated' };
    }

    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id); // Ensure user owns the item

    if (error) {
      console.error('Error deleting item:', error);
      return { error: error.message };
    }

    return { error: null };
  } catch (err: any) {
    console.error('Error deleting item:', err);
    return { error: err.message };
  }
}

/**
 * Get all items (for browsing/swipe - excludes user's own items)
 */
export async function getAllItems(): Promise<{ data: Item[]; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    let query = supabase
      .from('items')
      .select('*')
      .or('status.is.null,status.eq.active') // Only show active items
      .order('created_at', { ascending: false });

    // If user is logged in, exclude their own items
    if (user) {
      query = query.neq('owner_id', user.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching all items:', error);
      return { data: [], error: error.message };
    }

    return { data: data || [], error: null };
  } catch (err: any) {
    console.error('Error fetching all items:', err);
    return { data: [], error: err.message };
  }
}

/**
 * Get active items for the current user
 */
export async function getMyActiveItems(): Promise<{ data: Item[]; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { data: [], error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('owner_id', user.id)
      .or('status.is.null,status.eq.active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching active items:', error);
      return { data: [], error: error.message };
    }

    return { data: data || [], error: null };
  } catch (err: any) {
    console.error('Error fetching active items:', err);
    return { data: [], error: err.message };
  }
}

/**
 * Get sold/removed items for the current user (Gone section)
 */
export async function getMyGoneItems(): Promise<{ data: Item[]; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { data: [], error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('owner_id', user.id)
      .in('status', ['sold', 'removed'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching gone items:', error);
      return { data: [], error: error.message };
    }

    return { data: data || [], error: null };
  } catch (err: any) {
    console.error('Error fetching gone items:', err);
    return { data: [], error: err.message };
  }
}

/**
 * Mark an item as sold
 */
export async function markItemAsSold(id: string): Promise<{ error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'User not authenticated' };
    }

    const { error } = await supabase
      .from('items')
      .update({ status: 'sold' })
      .eq('id', id)
      .eq('owner_id', user.id);

    if (error) {
      console.error('Error marking item as sold:', error);
      return { error: error.message };
    }

    return { error: null };
  } catch (err: any) {
    console.error('Error marking item as sold:', err);
    return { error: err.message };
  }
}

/**
 * Mark an item as removed (no longer have it)
 */
export async function markItemAsRemoved(id: string): Promise<{ error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'User not authenticated' };
    }

    const { error } = await supabase
      .from('items')
      .update({ status: 'removed' })
      .eq('id', id)
      .eq('owner_id', user.id);

    if (error) {
      console.error('Error marking item as removed:', error);
      return { error: error.message };
    }

    return { error: null };
  } catch (err: any) {
    console.error('Error marking item as removed:', err);
    return { error: err.message };
  }
}

/**
 * Restore an item back to active status
 */
export async function restoreItem(id: string): Promise<{ error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'User not authenticated' };
    }

    const { error } = await supabase
      .from('items')
      .update({ status: 'active' })
      .eq('id', id)
      .eq('owner_id', user.id);

    if (error) {
      console.error('Error restoring item:', error);
      return { error: error.message };
    }

    return { error: null };
  } catch (err: any) {
    console.error('Error restoring item:', err);
    return { error: err.message };
  }
}

