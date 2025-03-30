'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { loadMessages, saveMessages } from '../services/messageService';
import type { Message } from '../types/chat';

interface SessionState {
  messages: Message[];
  sessionId: string | null;
  lastInputWasVoice: boolean;
}

interface UseSessionReturn extends SessionState {
  setMessages: (messages: Message[]) => void;
  clearSession: () => void;
  setLastInputWasVoice: (wasVoice: boolean) => void;
}

export const useSession = (): UseSessionReturn => {
  const { currentUser } = useAuth();
  const [state, setState] = useState<SessionState>({
    messages: [],
    sessionId: null,
    lastInputWasVoice: false,
  });

  useEffect(() => {
    if (currentUser?.uid) {
      const loadedMessages = loadMessages(currentUser.uid);
      const sessionId = `${currentUser.uid}-${Date.now()}`;
      setState(prev => ({ 
        ...prev, 
        messages: loadedMessages,
        sessionId,
      }));
    }
  }, [currentUser?.uid]);

  useEffect(() => {
    if (currentUser?.uid && state.messages.length > 0) {
      saveMessages(currentUser.uid, state.messages);
    }
  }, [currentUser?.uid, state.messages]);

  const setMessages = useCallback((messages: Message[]) => {
    setState(prev => ({ ...prev, messages }));
  }, []);

  const clearSession = useCallback(() => {
    if (currentUser?.uid) {
      saveMessages(currentUser.uid, []);
      setState(prev => ({
        ...prev,
        messages: [],
        sessionId: `${currentUser.uid}-${Date.now()}`,
        lastInputWasVoice: false,
      }));
    }
  }, [currentUser?.uid]);

  const setLastInputWasVoice = useCallback((wasVoice: boolean) => {
    setState(prev => ({ ...prev, lastInputWasVoice: wasVoice }));
  }, []);

  return {
    ...state,
    setMessages,
    clearSession,
    setLastInputWasVoice,
  };
}; 