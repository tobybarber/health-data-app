'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { useBackgroundLogo } from '../ClientWrapper';
import MessageList from './MessageList';
import InputSection from './InputSection';
import { Message } from '../../types/chat';
import { loadMessages, saveMessages } from '../../services/messageService';

export default function ChatContainer() {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAiResponding, setIsAiResponding] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { setShowBackgroundLogo } = useBackgroundLogo();
  const [lastInputWasVoice, setLastInputWasVoice] = useState(false);

  // Load messages from localStorage when component mounts
  useEffect(() => {
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
  }, [currentUser]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (currentUser) {
      saveMessages(currentUser.uid, messages);
    }
  }, [messages, currentUser]);

  // Hide background logo when messages are present
  useEffect(() => {
    setShowBackgroundLogo(messages.length === 0);
  }, [messages, setShowBackgroundLogo]);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1].ai === '') {
      scrollToBottom();
    }
  }, [messages]);

  // Function to clear chat history
  const handleNewChat = () => {
    setMessages([]);
    if (currentUser) {
      saveMessages(currentUser.uid, []);
    }
    sessionStorage.removeItem('messages_loaded');
  };

  return (
    <div className="flex flex-col h-full mb-20" ref={chatRef}>
      <MessageList 
        messages={messages} 
        messagesEndRef={messagesEndRef}
        isAiResponding={isAiResponding}
      />
      <InputSection
        messages={messages}
        setMessages={setMessages}
        isAiResponding={isAiResponding}
        setIsAiResponding={setIsAiResponding}
        lastInputWasVoice={lastInputWasVoice}
        setLastInputWasVoice={setLastInputWasVoice}
        onNewChat={handleNewChat}
      />
    </div>
  );
} 