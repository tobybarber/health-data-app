'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { isApiKeyValid } from '../../lib/openai';
import MicrophoneButton from '../MicrophoneButton';
import MessageList from './MessageList';
import InputSection from './InputSection';
import { Message } from '../../types/chat';
import { sendMessage } from '../../services/messageService';

// Helper functions for session-based chat storage
const saveSessionMessages = (userId: string, messages: Message[]): void => {
  if (typeof window === 'undefined') return;
  
  if (messages.length > 0) {
    sessionStorage.setItem(`chat_messages_${userId}`, JSON.stringify(messages));
  } else {
    sessionStorage.removeItem(`chat_messages_${userId}`);
  }
};

const loadSessionMessages = (userId: string): Message[] => {
  if (typeof window === 'undefined') return [];
  
  const savedMessages = sessionStorage.getItem(`chat_messages_${userId}`);
  if (savedMessages) {
    try {
      const parsedMessages = JSON.parse(savedMessages);
      // Ensure all messages have timestamp
      return parsedMessages.map((msg: Message) => ({
        ...msg,
        timestamp: msg.timestamp || Date.now()
      }));
    } catch (e) {
      console.error('Error parsing saved messages:', e);
      return [];
    }
  }
  return [];
};

export default function ChatContainer() {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyValid, setApiKeyValid] = useState<boolean | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const messageIdCounterRef = useRef<number>(0);
  const [lastInputWasVoice, setLastInputWasVoice] = useState(false);

  // Load messages from sessionStorage when component mounts
  useEffect(() => {
    const userId = currentUser?.uid || 'guest-user';
    const loadedMessages = loadSessionMessages(userId);
    
    if (loadedMessages.length > 0) {
      setMessages(loadedMessages);
      // Update the message counter to be higher than any existing message
      const highestId = Math.max(...loadedMessages.map(m => m.timestamp || 0));
      messageIdCounterRef.current = highestId + 1;
      
      // Scroll to the most recent message after loading
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [currentUser]);

  // Save messages to sessionStorage whenever they change
  useEffect(() => {
    const userId = currentUser?.uid || 'guest-user';
    saveSessionMessages(userId, messages);
  }, [messages, currentUser]);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  // Function to clear chat history
  const handleNewChat = () => {
    setMessages([]);
    const userId = currentUser?.uid || 'guest-user';
    saveSessionMessages(userId, []);
  };

  // Handle sending messages
  const handleSendMessage = async (text: string, wasVoice: boolean) => {
    setIsLoading(true);
    
    try {
      const userId = currentUser?.uid || 'guest-user';
      const timestamp = Date.now();
      
      // User message should already be added by InputSection
      // Just get the AI response
      const response = await sendMessage(text, messages, userId, wasVoice);
      
      // Find the user message and add AI response
      setMessages(prevMessages => {
        // Get the last message (should be the user message)
        const updatedMessages = [...prevMessages];
        if (updatedMessages.length > 0) {
          const lastIndex = updatedMessages.length - 1;
          const lastMessage = updatedMessages[lastIndex];
          
          // Update the last message with AI response
          updatedMessages[lastIndex] = {
            ...lastMessage,
            ai: response.message,
            responseId: response.responseId,
            audioData: response.audioData,
            wasVoiceInput: wasVoice,
            timestamp: lastMessage.timestamp || timestamp
          };
        }
        
        return updatedMessages;
      });
      
    } catch (error) {
      console.error('Error getting AI response:', error);
      
      // Update the last message with error
      setMessages(prevMessages => {
        const updatedMessages = [...prevMessages];
        if (updatedMessages.length > 0) {
          const lastIndex = updatedMessages.length - 1;
          updatedMessages[lastIndex] = {
            ...updatedMessages[lastIndex],
            ai: 'Sorry, I encountered an error. Please try again.'
          };
        }
        return updatedMessages;
      });
      
    } finally {
      setIsLoading(false);
      // Voice input state will be reset in InputSection
    }
  };

  return (
    <div className="flex flex-col h-full" ref={chatRef}>
      <div className="flex-1 overflow-y-auto ios-scrollable pb-28">
        <MessageList 
          messages={messages} 
          messagesEndRef={messagesEndRef}
          isAiResponding={isLoading}
        />
      </div>
      <InputSection
        messages={messages}
        setMessages={setMessages}
        isAiResponding={isLoading}
        setIsAiResponding={setIsLoading}
        lastInputWasVoice={lastInputWasVoice}
        setLastInputWasVoice={setLastInputWasVoice}
        onNewChat={handleNewChat}
        onSendMessage={handleSendMessage}
      />
    </div>
  );
} 