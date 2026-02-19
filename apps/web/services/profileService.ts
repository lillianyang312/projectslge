import { createClient } from '@/lib/supabase/client';
import type { UserProfile } from '@/stores/authStore';

export async function getMyProfile(): Promise<{ data: UserProfile | null; error: string | null }> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'User not authenticated' };

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { data: null, error: message };
  }
}

export async function updateProfile(
  updates: Partial<Pick<UserProfile, 'full_name' | 'first_name' | 'last_name' | 'gender' | 'phone_number' | 'house' | 'dorm_building' | 'dorm_room' | 'graduation_year' | 'payment_preference' | 'zelle_handle' | 'venmo_handle'>>
): Promise<{ data: UserProfile | null; error: string | null }> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'User not authenticated' };

    const { data, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { data: null, error: message };
  }
}

export async function getUserRatings(userId: string): Promise<{ id: string; rating: number; comment: string | null; created_at: string; rater_name: string }[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('user_ratings')
      .select('id, rating, comment, created_at, rater_id')
      .eq('rated_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !data || data.length === 0) return [];

    const raterIds = Array.from(new Set(data.map((r) => r.rater_id)));
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, full_name')
      .in('id', raterIds);

    const profileMap = new Map(profiles?.map((p) => [p.id, p.full_name]) || []);

    return data.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at,
      rater_name: profileMap.get(r.rater_id) || 'User',
    }));
  } catch {
    return [];
  }
}
