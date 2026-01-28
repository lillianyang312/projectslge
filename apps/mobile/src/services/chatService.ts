/**
 * Chat Service
 * 
 * Handles communication with the chatbot edge function.
 * Maintains conversation history and sends messages to the LLM.
 */

import { supabase } from '../lib/supabase';
import { PriceReference } from '../ui/components';

export interface ChatbotMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatbotRequest {
  systemPrompt?: string;
  userMessage: string;
  conversationHistory?: ChatbotMessage[];
  context?: {
    itemId?: string;
    dealId?: string;
  };
}

export interface ChatbotResponse {
  output: string;
  priceReferences?: PriceReference[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent' | 'other';
  senderName?: string;
  text: string;
  time: string;
  priceReferences?: PriceReference[];
}

/**
 * Convert ChatMessage array to ChatbotMessage format for the API
 */
function convertToChatbotMessages(messages: ChatMessage[]): ChatbotMessage[] {
  return messages
    .filter((msg) => msg.sender === 'user' || msg.sender === 'agent')
    .map((msg) => ({
      role: msg.sender === 'user' ? 'user' as const : 'assistant' as const,
      content: msg.text,
    }));
}

/**
 * Send a message to the chatbot edge function
 */
export async function sendChatMessage(
  userMessage: string,
  conversationHistory: ChatMessage[] = [],
  systemPrompt?: string,
  context?: { itemId?: string; dealId?: string }
): Promise<ChatbotResponse | null> {
  try {
    // Convert conversation history to API format
    const chatbotHistory = convertToChatbotMessages(conversationHistory);

    const requestBody: ChatbotRequest = {
      userMessage,
      ...(chatbotHistory.length > 0 && { conversationHistory: chatbotHistory }),
      ...(systemPrompt && { systemPrompt }),
      ...(context && { context }),
    };

    console.log('🔵 [chatService] Calling chatbot endpoint:', {
      endpoint: 'chatbot',
      userMessage: userMessage.substring(0, 100) + (userMessage.length > 100 ? '...' : ''),
      conversationHistoryLength: chatbotHistory.length,
      hasSystemPrompt: !!systemPrompt,
      context,
      requestBodyKeys: Object.keys(requestBody),
    });

    const startTime = Date.now();
    const { data, error } = await supabase.functions.invoke<ChatbotResponse>(
      'chatbot',
      {
        body: requestBody,
      }
    );
    const duration = Date.now() - startTime;

    if (error) {
      const errorStatus = error.context?.status;
      const errorMessage = error.message;
      
      console.error('❌ [chatService] Error calling chatbot:', {
        error,
        errorMessage,
        errorStatus,
        errorContext: error.context,
        duration: `${duration}ms`,
      });

      // Provide helpful error messages based on status code
      if (errorStatus === 404) {
        console.error('⚠️ [chatService] Chatbot function not found (404). The function may not be deployed.');
        console.error('💡 [chatService] To deploy: supabase functions deploy chatbot');
      } else if (errorStatus === 500) {
        console.error('⚠️ [chatService] Chatbot function error (500). Check OPENAI_API_KEY secret.');
        console.error('💡 [chatService] To set secret: supabase secrets set OPENAI_API_KEY=your_key');
      }
      
      return null;
    }

    console.log('✅ [chatService] Chatbot response received:', {
      hasData: !!data,
      outputLength: data?.output?.length || 0,
      outputPreview: data?.output?.substring(0, 100) + (data?.output && data.output.length > 100 ? '...' : ''),
      priceReferencesCount: data?.priceReferences?.length || 0,
      priceReferences: data?.priceReferences,
      duration: `${duration}ms`,
    });

    return data || null;
  } catch (error) {
    console.error('❌ [chatService] Exception sending chat message:', {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userMessage: userMessage.substring(0, 50),
    });
    return null;
  }
}

/**
 * Format a timestamp to a readable time string
 */
export function formatMessageTime(timestamp: Date = new Date()): string {
  const hours = timestamp.getHours();
  const minutes = timestamp.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');
  return `${displayHours}:${displayMinutes} ${period}`;
}

/**
 * Generate a unique message ID
 */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Send a system message to a deal chat (for notifications like last chance, item updates, etc.)
 */
export async function sendSystemMessage(
  dealId: string,
  content: string,
  metadata?: Record<string, any>
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        deal_id: dealId,
        sender_id: null, // System messages have no sender
        is_agent: true, // Show as system/agent message
        content,
        message_type: 'system',
        metadata,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [chatService] Error sending system message:', error);
      return false;
    }

    console.log('✅ [chatService] System message sent:', { dealId, content: content.substring(0, 50) });
    return true;
  } catch (error) {
    console.error('❌ [chatService] Exception sending system message:', error);
    return false;
  }
}

