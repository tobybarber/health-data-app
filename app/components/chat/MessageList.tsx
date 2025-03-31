'use client';

import { RefObject, useState, useEffect, useRef } from 'react';
import { Message } from '../../types/chat';
import SpeakText from '../SpeakText';

interface MessageListProps {
  messages: Message[];
  messagesEndRef: RefObject<HTMLDivElement>;
  isAiResponding: boolean;
}

export default function MessageList({ messages, messagesEndRef, isAiResponding }: MessageListProps) {
  // Keep track of which message has been auto-played
  const [autoPlayedMessageIds, setAutoPlayedMessageIds] = useState<Set<string>>(new Set());
  const prevMessagesLengthRef = useRef<number>(0);
  
  // When messages change, check if there's a new voice input message that should autoplay
  useEffect(() => {
    // Only process when we have new messages
    if (messages.length > prevMessagesLengthRef.current) {
      const lastMessageIndex = messages.length - 1;
      const lastMessage = messages[lastMessageIndex];
      
      // Generate a stable ID for this message
      const messageId = `${lastMessageIndex}-${lastMessage.timestamp || Date.now()}`;
      
      // Check if this is an AI message with audio data from voice input that hasn't been auto-played yet
      if (
        lastMessage.ai && 
        lastMessage.audioData && 
        lastMessage.wasVoiceInput === true && 
        !autoPlayedMessageIds.has(messageId)
      ) {
        console.log('New voice input message detected, marking for autoplay');
        
        // Mark this message as auto-played
        setAutoPlayedMessageIds(prev => {
          const newSet = new Set(prev);
          newSet.add(messageId);
          return newSet;
        });
      }
      
      // Update our reference to the current message count
      prevMessagesLengthRef.current = messages.length;
    }
  }, [messages, autoPlayedMessageIds]);

  // Calculate stable keys for SpeakText components
  const getMessageKey = (message: Message, index: number) => {
    // Use timestamp if available, otherwise use the index with a salt
    const timeKey = message.timestamp || `${index}-${Date.now()}`;
    return `speak-text-${index}-${message.wasVoiceInput ? 'voice' : 'text'}-${timeKey}`;
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message, index) => {
        // Generate a stable ID for this message
        const messageId = `${index}-${message.timestamp || Date.now()}`;
        
        // Determine if this message should auto-play - ensure it's a boolean
        const shouldAutoPlay = !!(
          message.ai && 
          message.audioData && 
          message.wasVoiceInput === true && 
          autoPlayedMessageIds.has(messageId)
        );
        
        return (
          <div key={index} className="space-y-2">
            {message.user && (
              <div className="flex justify-end">
                <div className="bg-blue-500 text-white rounded-lg p-3 max-w-[80%]">
                  {message.user}
                </div>
              </div>
            )}
            {message.ai && (
              <div className="flex justify-start relative">
                <div className="bg-gray-800 text-white rounded-lg p-3 max-w-[80%]">
                  <div className="whitespace-pre-wrap">{message.ai}</div>
                </div>
                {message.audioData && (
                  <div className="absolute top-2 -right-3 z-10">
                    <SpeakText 
                      text=""
                      audioData={message.audioData} 
                      voiceInput={message.wasVoiceInput === true}
                      iconOnly={true}
                      autoPlay={shouldAutoPlay}
                      key={getMessageKey(message, index)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {isAiResponding && (
        <div className="flex justify-start">
          <div className="bg-gray-800 text-white rounded-lg p-3">
            Thinking...
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
} 