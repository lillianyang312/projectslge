'use client';

import { useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Subscribe to real-time deal updates for the current user.
 * Calls onUpdate when any deal the user is involved in changes.
 */
export function useRealtimeDeals(
  userId: string | null,
  onUpdate: () => void
): void {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const stableCallback = useCallback(() => {
    onUpdateRef.current();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`user-deals-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deals',
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (row.buyer_id === userId || row.seller_id === userId) {
            stableCallback();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, stableCallback]);
}
