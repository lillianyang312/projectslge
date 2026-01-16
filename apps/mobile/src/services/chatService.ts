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

    const { data, error } = await supabase.functions.invoke<ChatbotResponse>(
      'chatbot',
      {
        body: requestBody,
      }
    );

    if (error) {
      console.error('Error calling chatbot:', error);
      return null;
    }

    return data || null;
  } catch (error) {
    console.error('Error sending chat message:', error);
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

