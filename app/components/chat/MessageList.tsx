'use client';

import { RefObject } from 'react';
import { Message } from '../../types/chat';
import SpeakText from '../SpeakText';

interface MessageListProps {
  messages: Message[];
  messagesEndRef: RefObject<HTMLDivElement>;
  isAiResponding: boolean;
}

export default function MessageList({ messages, messagesEndRef, isAiResponding }: MessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message, index) => (
        <div key={index} className="space-y-2">
          {message.user && (
            <div className="flex justify-end">
              <div className="bg-blue-500 text-white rounded-lg p-3 max-w-[80%]">
                {message.user}
              </div>
            </div>
          )}
          {message.ai && (
            <div className="flex justify-start">
              <div className="bg-gray-200 rounded-lg p-3 max-w-[80%]">
                {message.ai}
                {message.audioData && (
                  <SpeakText audioData={message.audioData} />
                )}
              </div>
            </div>
          )}
        </div>
      ))}
      {isAiResponding && (
        <div className="flex justify-start">
          <div className="bg-gray-200 rounded-lg p-3">
            Thinking...
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
} 