import { createClient } from '@/lib/supabase/client';
import type { Item } from '@/types/models';

export type ItemStatus = 'active' | 'sold' | 'removed';

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
  description?: string;
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

export async function createItem(input: CreateItemInput): Promise<{ data: Item | null; error: string | null }> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'User not authenticated' };

    const { data, error } = await supabase
      .from('items')
      .insert({
        owner_id: user.id,
        title: input.title,
        category: input.category,
        condition: input.condition,
        photos: input.photos,
        image_path: input.photos[0] || '',
        estimated_value_min: input.estimated_value_min,
        estimated_value_max: input.estimated_value_max,
        retail_price: input.retail_price,
        min_price: input.min_price,
        notes: input.notes,
        description: input.description,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { data: null, error: message };
  }
}

export async function getMyItems(): Promise<{ data: Item[]; error: string | null }> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: [], error: 'User not authenticated' };

    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    if (error) return { data: [], error: error.message };
    return { data: data || [], error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { data: [], error: message };
  }
}

export async function getItemById(id: string): Promise<{ data: Item | null; error: string | null }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { data: null, error: message };
  }
}

export async function updateItem(id: string, input: UpdateItemInput): Promise<{ data: Item | null; error: string | null }> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'User not authenticated' };

    const { data, error } = await supabase
      .from('items')
      .update(input)
      .eq('id', id)
      .eq('owner_id', user.id)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { data: null, error: message };
  }
}

export async function deleteItem(id: string): Promise<{ error: string | null }> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'User not authenticated' };

    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id);

    if (error) return { error: error.message };
    return { error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { error: message };
  }
}

export async function getAllItems(): Promise<{ data: Item[]; error: string | null }> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let query = supabase
      .from('items')
      .select('*')
      .or('status.is.null,status.eq.active')
      .order('created_at', { ascending: false });

    if (user) {
      query = query.neq('owner_id', user.id);
    }

    const { data, error } = await query;
    if (error) return { data: [], error: error.message };
    return { data: data || [], error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { data: [], error: message };
  }
}

export async function getMyActiveItems(): Promise<{ data: Item[]; error: string | null }> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: [], error: 'User not authenticated' };

    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('owner_id', user.id)
      .or('status.is.null,status.eq.active')
      .order('created_at', { ascending: false });

    if (error) return { data: [], error: error.message };
    return { data: data || [], error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { data: [], error: message };
  }
}

export async function getMyGoneItems(): Promise<{ data: Item[]; error: string | null }> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: [], error: 'User not authenticated' };

    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('owner_id', user.id)
      .eq('status', 'sold')
      .order('created_at', { ascending: false });

    if (error) return { data: [], error: error.message };
    return { data: data || [], error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { data: [], error: message };
  }
}

export async function markItemAsSold(id: string): Promise<{ error: string | null }> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'User not authenticated' };

    const { error } = await supabase
      .from('items')
      .update({ status: 'sold' })
      .eq('id', id)
      .eq('owner_id', user.id);

    if (error) return { error: error.message };
    return { error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { error: message };
  }
}

export async function markItemAsRemoved(id: string): Promise<{ error: string | null }> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'User not authenticated' };

    const { error } = await supabase
      .from('items')
      .update({ status: 'removed' })
      .eq('id', id)
      .eq('owner_id', user.id);

    if (error) return { error: error.message };
    return { error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { error: message };
  }
}

export async function getItemsByOwnerId(
  ownerId: string,
  excludeItemId?: string
): Promise<{ data: Item[]; error: string | null }> {
  try {
    const supabase = createClient();
    let query = supabase
      .from('items')
      .select('*')
      .eq('owner_id', ownerId)
      .or('status.is.null,status.eq.active')
      .order('created_at', { ascending: false })
      .limit(10);

    if (excludeItemId) {
      query = query.neq('id', excludeItemId);
    }

    const { data, error } = await query;
    if (error) return { data: [], error: error.message };
    return { data: data || [], error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { data: [], error: message };
  }
}

export async function restoreItem(id: string): Promise<{ error: string | null }> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'User not authenticated' };

    const { error } = await supabase
      .from('items')
      .update({ status: 'active' })
      .eq('id', id)
      .eq('owner_id', user.id);

    if (error) return { error: error.message };
    return { error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { error: message };
  }
}
