import { supabase } from '../lib/supabase';

// Types matching the Supabase schema
export interface Want {
  id: string;
  owner_id: string;
  query: string;
  max_price?: number;
  urgency: 'low' | 'normal' | 'high';
  delivery_pref: string;
  created_at: string;
}

export interface CreateWantInput {
  query: string;
  max_price?: number;
  urgency: 'low' | 'normal' | 'high';
  delivery_pref: string;
}

export interface UpdateWantInput {
  query?: string;
  max_price?: number;
  urgency?: 'low' | 'normal' | 'high';
  delivery_pref?: string;
}

/**
 * Create a new want in Supabase
 */
export async function createWant(input: CreateWantInput): Promise<{ data: Want | null; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { data: null, error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('wants')
      .insert({
        owner_id: user.id,
        query: input.query,
        max_price: input.max_price,
        urgency: input.urgency,
        delivery_pref: input.delivery_pref,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating want:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err: any) {
    console.error('Error creating want:', err);
    return { data: null, error: err.message };
  }
}

/**
 * Get all wants for the current user
 */
export async function getMyWants(): Promise<{ data: Want[]; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { data: [], error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('wants')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching wants:', error);
      return { data: [], error: error.message };
    }

    return { data: data || [], error: null };
  } catch (err: any) {
    console.error('Error fetching wants:', err);
    return { data: [], error: err.message };
  }
}

/**
 * Get a single want by ID
 */
export async function getWantById(id: string): Promise<{ data: Want | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('wants')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching want:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err: any) {
    console.error('Error fetching want:', err);
    return { data: null, error: err.message };
  }
}

/**
 * Update a want
 */
export async function updateWant(id: string, input: UpdateWantInput): Promise<{ data: Want | null; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { data: null, error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('wants')
      .update(input)
      .eq('id', id)
      .eq('owner_id', user.id) // Ensure user owns the want
      .select()
      .single();

    if (error) {
      console.error('Error updating want:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err: any) {
    console.error('Error updating want:', err);
    return { data: null, error: err.message };
  }
}

/**
 * Delete a want
 */
export async function deleteWant(id: string): Promise<{ error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { error: 'User not authenticated' };
    }

    const { error } = await supabase
      .from('wants')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id); // Ensure user owns the want

    if (error) {
      console.error('Error deleting want:', error);
      return { error: error.message };
    }

    return { error: null };
  } catch (err: any) {
    console.error('Error deleting want:', err);
    return { error: err.message };
  }
}

/**
 * Get all wants (for browsing/swipe - excludes user's own wants)
 */
export async function getAllWants(): Promise<{ data: Want[]; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    let query = supabase
      .from('wants')
      .select('*')
      .order('created_at', { ascending: false });

    // If user is logged in, exclude their own wants
    if (user) {
      query = query.neq('owner_id', user.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching all wants:', error);
      return { data: [], error: error.message };
    }

    return { data: data || [], error: null };
  } catch (err: any) {
    console.error('Error fetching all wants:', err);
    return { data: [], error: err.message };
  }
}

