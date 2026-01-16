/**
 * Custom hook for calling the LLM endpoint when messages change
 * 
 * This hook watches for new user messages and automatically sends them
 * to the LLM endpoint, logging both the request and response.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  sendChatMessage,
  formatMessageTime,
  generateMessageId,
  type ChatMessage,
} from '../services/chatService';
import { GENERAL_PERSONALITY_SYSTEM_PROMPT } from '../services/chatPrompts';

interface UseChatLLMOptions {
  /**
   * System prompt to use (defaults to GENERAL_PERSONALITY_SYSTEM_PROMPT)
   */
  systemPrompt?: string;
  /**
   * Optional context (itemId, dealId) for the LLM
   */
  context?: { itemId?: string; dealId?: string };
  /**
   * Whether to automatically send messages to LLM (default: true)
   */
  autoSend?: boolean;
}

interface UseChatLLMReturn {
  /**
   * Current agent response (if any)
   */
  agentResponse: ChatMessage | null;
  /**
   * Whether a request is currently in progress
   */
  isLoading: boolean;
  /**
   * Error message if request failed
   */
  error: string | null;
  /**
   * Manually trigger an LLM call with a specific message
   * @param messageText - The message text to send
   * @param messageId - Optional message ID to track this message
   * @param updatedMessages - Optional updated messages array (to include newly added messages)
   */
  sendMessage: (messageText: string, messageId?: string, updatedMessages?: ChatMessage[]) => Promise<ChatMessage | null>;
}

/**
 * Custom hook that watches messages and calls LLM endpoint
 */
export function useChatLLM(
  messages: ChatMessage[],
  options: UseChatLLMOptions = {}
): UseChatLLMReturn {
  const {
    systemPrompt = GENERAL_PERSONALITY_SYSTEM_PROMPT,
    context,
    autoSend = true,
  } = options;

  const [agentResponse, setAgentResponse] = useState<ChatMessage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the last processed message ID to avoid duplicate calls
  const lastProcessedMessageId = useRef<string | null>(null);
  const lastMessagesLength = useRef<number>(0);
  const pendingMessageIds = useRef<Set<string>>(new Set());

  /**
   * Send a message to the LLM and return the agent response
   */
  const sendMessage = useCallback(
    async (messageText: string, messageId?: string, updatedMessages?: ChatMessage[]): Promise<ChatMessage | null> => {
      if (!messageText.trim() || isLoading) {
        console.log('⏸️ [useChatLLM] sendMessage blocked:', {
          hasMessage: !!messageText.trim(),
          isLoading,
        });
        return null;
      }

      // Use the updated messages if provided (to include the newly added user message),
      // otherwise fall back to the current messages state
      const currentMessages = updatedMessages || messages;

      // Use provided messageId or find the matching message in the array
      const targetMessageId =
        messageId ||
        [...currentMessages]
          .reverse()
          .find((msg) => msg.sender === 'user' && msg.text === messageText)?.id;

      // Check if this message is already being processed
      if (targetMessageId && pendingMessageIds.current.has(targetMessageId)) {
        console.log('⏭️ [useChatLLM] Skipping duplicate send for message:', targetMessageId);
        return null;
      }

      if (targetMessageId) {
        pendingMessageIds.current.add(targetMessageId);
      }

      setIsLoading(true);
      setError(null);

      try {
        // Filter conversation history (only user and agent messages)
        // Include the current message in the history if it's not already there
        let conversationHistory = currentMessages.filter(
          (msg) => msg.sender === 'user' || msg.sender === 'agent'
        );

        // Ensure the current message is in the history
        // If messageId is provided, check if that message exists in history
        if (targetMessageId) {
          const messageExists = conversationHistory.some((msg) => msg.id === targetMessageId);
          if (!messageExists) {
            // Add the current message to history if it's not there
            const currentMessage: ChatMessage = {
              id: targetMessageId,
              sender: 'user',
              text: messageText,
              time: formatMessageTime(),
            };
            conversationHistory = [...conversationHistory, currentMessage];
            console.log('➕ [useChatLLM] Added current message to conversation history');
          }
        }

        // Log the request
        console.log('📤 [useChatLLM] Sending LLM Request:', {
          messageId: targetMessageId,
          userMessage: messageText,
          userMessageLength: messageText.length,
          conversationHistoryLength: conversationHistory.length,
          conversationHistory: conversationHistory.map((msg) => ({
            id: msg.id,
            sender: msg.sender,
            text: msg.text.substring(0, 50) + (msg.text.length > 50 ? '...' : ''),
            time: msg.time,
          })),
          systemPromptLength: systemPrompt.length,
          systemPromptPreview: systemPrompt.substring(0, 100) + (systemPrompt.length > 100 ? '...' : ''),
          context,
          usingUpdatedMessages: !!updatedMessages,
        });

        // Send to chatbot
        const response = await sendChatMessage(
          messageText,
          conversationHistory,
          systemPrompt,
          context
        );

        if (response) {
          // Log the response
          console.log('📥 [useChatLLM] LLM Response received:', {
            messageId: targetMessageId,
            outputLength: response.output.length,
            outputPreview: response.output.substring(0, 150) + (response.output.length > 150 ? '...' : ''),
            priceReferencesCount: response.priceReferences?.length || 0,
            priceReferences: response.priceReferences,
          });

          // Create agent message
          const agentMessage: ChatMessage = {
            id: generateMessageId(),
            sender: 'agent',
            senderName: 'Agent',
            text: response.output,
            time: formatMessageTime(),
            priceReferences: response.priceReferences,
          };

          setAgentResponse(agentMessage);
          if (targetMessageId) {
            pendingMessageIds.current.delete(targetMessageId);
            lastProcessedMessageId.current = targetMessageId;
          }
          return agentMessage;
        } else {
          console.warn('⚠️ [useChatLLM] LLM Response: null or empty', {
            messageId: targetMessageId,
            userMessage: messageText.substring(0, 50),
          });
          setError('No response from LLM');
          if (targetMessageId) {
            pendingMessageIds.current.delete(targetMessageId);
          }
          return null;
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error occurred';
        console.error('❌ [useChatLLM] LLM Error:', {
          messageId: targetMessageId,
          error: errorMessage,
          errorName: err instanceof Error ? err.name : undefined,
          message: messageText.substring(0, 100),
          stack: err instanceof Error ? err.stack : undefined,
        });
        setError(errorMessage);
        if (targetMessageId) {
          pendingMessageIds.current.delete(targetMessageId);
        }
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [messages, systemPrompt, context, isLoading]
  );

  /**
   * Auto-send new user messages to LLM
   */
  useEffect(() => {
    if (!autoSend || isLoading) {
      return;
    }

    // Find the last user message
    const lastUserMessage = [...messages]
      .reverse()
      .find((msg) => msg.sender === 'user');

    // Check if we have a new user message that hasn't been processed
    if (
      lastUserMessage &&
      lastUserMessage.id !== lastProcessedMessageId.current
    ) {
      // Check if there's already an agent response after this user message
      const userMessageIndex = messages.indexOf(lastUserMessage);
      const hasAgentResponse = messages
        .slice(userMessageIndex + 1)
        .some((msg) => msg.sender === 'agent');

      // Only send if there's no agent response yet and not already pending
      if (
        !hasAgentResponse &&
        !pendingMessageIds.current.has(lastUserMessage.id)
      ) {
        lastMessagesLength.current = messages.length;

        console.log('🔄 [useChatLLM] Auto-sending user message to LLM:', {
          messageId: lastUserMessage.id,
          text: lastUserMessage.text.substring(0, 100) + (lastUserMessage.text.length > 100 ? '...' : ''),
          timestamp: lastUserMessage.time,
          totalMessages: messages.length,
        });

        sendMessage(lastUserMessage.text, lastUserMessage.id).catch((err) => {
          console.error('Failed to auto-send message:', err);
        });
      } else {
        // Mark as processed even if we don't send (agent already responded or pending)
        lastProcessedMessageId.current = lastUserMessage.id;
      }
    }
  }, [messages, autoSend, isLoading, sendMessage]);

  return {
    agentResponse,
    isLoading,
    error,
    sendMessage,
  };
}

