'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Message } from '../types/chat';
import { loadMessages, saveMessages, sendMessage } from '../services/messageService';
import { APIError, ValidationError, handleError } from '../utils/errorHandling';

export const useMessages = () => {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAiResponding, setIsAiResponding] = useState(false);

  // Load messages from storage
  useEffect(() => {
    const loadStoredMessages = async () => {
      try {
        if (currentUser) {
          if (sessionStorage.getItem('app_session_id') && sessionStorage.getItem('messages_loaded') === 'true') {
            const loadedMessages = loadMessages(currentUser.uid);
            if (loadedMessages.length > 0) {
              setMessages(loadedMessages);
            }
          } else if (sessionStorage.getItem('app_session_id')) {
            sessionStorage.setItem('messages_loaded', 'true');
          }
        }
      } catch (err) {
        setError(handleError(err).message);
      } finally {
        setIsLoading(false);
      }
    };

    loadStoredMessages();
  }, [currentUser]);

  // Save messages to storage
  useEffect(() => {
    if (currentUser && messages.length > 0) {
      try {
        saveMessages(currentUser.uid, messages);
      } catch (err) {
        console.error('Error saving messages:', err);
      }
    }
  }, [messages, currentUser]);

  // Send a new message
  const sendNewMessage = useCallback(async (
    userInput: string,
    wasVoiceInput: boolean = false
  ) => {
    try {
      setError(null);
      if (!userInput.trim()) {
        throw new ValidationError('Message cannot be empty');
      }

      // Add user message
      const newMessages = [...messages, { user: userInput, ai: '' }];
      setMessages(newMessages);
      setIsAiResponding(true);

      const userId = currentUser?.uid || 'guest-user';
      const response = await sendMessage(userInput, messages, userId, wasVoiceInput);
      
      // Update the last message with AI response
      newMessages[newMessages.length - 1] = {
        ...newMessages[newMessages.length - 1],
        ai: response.message,
        responseId: response.responseId,
        audioData: response.audioData
      };
      
      setMessages([...newMessages]);
    } catch (err) {
      setError(handleError(err).message);
      // Update the last message with error if it exists
      if (messages.length > 0) {
        const newMessages = [...messages];
        newMessages[newMessages.length - 1].ai = 'Sorry, I encountered an error. Please try again.';
        setMessages(newMessages);
      }
    } finally {
      setIsAiResponding(false);
    }
  }, [messages, currentUser]);

  // Clear chat history
  const clearChat = useCallback(() => {
    setMessages([]);
    if (currentUser) {
      saveMessages(currentUser.uid, []);
    }
    sessionStorage.removeItem('messages_loaded');
  }, [currentUser]);

  return {
    messages,
    isLoading,
    error,
    isAiResponding,
    sendNewMessage,
    clearChat
  };
}; 