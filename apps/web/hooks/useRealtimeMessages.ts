'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Message } from '@/types/models';
import { getMessages } from '@/services/dealsService';

export function useRealtimeMessages(dealId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchMessages = useCallback(async (): Promise<void> => {
    if (!dealId) return;
    setLoading(true);
    const data = await getMessages(dealId);
    setMessages(data);
    setLoading(false);
  }, [dealId]);

  useEffect(() => {
    if (!dealId) return;

    fetchMessages();

    const supabase = createClient();
    const channel = supabase
      .channel(`deal-messages-${dealId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `deal_id=eq.${dealId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dealId, fetchMessages]);

  return { messages, loading, refetch: fetchMessages };
}
