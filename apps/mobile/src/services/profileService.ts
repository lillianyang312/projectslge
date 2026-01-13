import { supabase } from '../lib/supabase';

export interface Profile {
  id: string;
  created_at: string;
  display_name?: string;
  avatar_url?: string;
}

/**
 * Get the current user's profile
 */
export async function getMyProfile(): Promise<{ data: Profile | null; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { data: null, error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching profile:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err: any) {
    console.error('Error fetching profile:', err);
    return { data: null, error: err.message };
  }
}

/**
 * Create a profile for the current user
 */
export async function createProfile(displayName?: string): Promise<{ data: Profile | null; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { data: null, error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        display_name: displayName || user.email?.split('@')[0] || 'User',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating profile:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err: any) {
    console.error('Error creating profile:', err);
    return { data: null, error: err.message };
  }
}

/**
 * Update the current user's profile
 */
export async function updateProfile(updates: { display_name?: string; avatar_url?: string }): Promise<{ data: Profile | null; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { data: null, error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err: any) {
    console.error('Error updating profile:', err);
    return { data: null, error: err.message };
  }
}

/**
 * Ensure user has a profile (create if doesn't exist)
 * Note: This is non-blocking - if profiles table doesn't exist, it will silently fail
 */
export async function ensureProfile(): Promise<{ data: Profile | null; error: string | null }> {
  try {
    const { data: existingProfile } = await getMyProfile();

    if (existingProfile) {
      return { data: existingProfile, error: null };
    }

    return await createProfile();
  } catch (err) {
    // Silently fail - profiles table may not exist in this version
    console.warn('Profile ensure failed (non-blocking):', err);
    return { data: null, error: null };
  }
}

