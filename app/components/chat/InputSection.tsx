'use client';

import { useState } from 'react';
import { FaPaperPlane, FaPlus } from 'react-icons/fa';
import MicrophoneButton from '../MicrophoneButton';
import { Message } from '../../types/chat';
import { sendMessage } from '../../services/messageService';
import { useAuth } from '../../lib/AuthContext';

interface InputSectionProps {
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  isAiResponding: boolean;
  setIsAiResponding: (isResponding: boolean) => void;
  lastInputWasVoice: boolean;
  setLastInputWasVoice: (wasVoice: boolean) => void;
  onNewChat: () => void;
}

export default function InputSection({
  messages,
  setMessages,
  isAiResponding,
  setIsAiResponding,
  lastInputWasVoice,
  setLastInputWasVoice,
  onNewChat
}: InputSectionProps) {
  const [userInput, setUserInput] = useState('');
  const { currentUser } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isAiResponding) return;

    // Add user message
    const newMessages = [...messages, { user: userInput, ai: '' }];
    setMessages(newMessages);
    setUserInput('');
    setIsAiResponding(true);

    try {
      const userId = currentUser?.uid || 'guest-user';
      const response = await sendMessage(userInput, messages, userId, lastInputWasVoice);
      
      // Update the last message with AI response
      newMessages[newMessages.length - 1].ai = response.message;
      if (response.responseId) newMessages[newMessages.length - 1].responseId = response.responseId;
      if (response.audioData) newMessages[newMessages.length - 1].audioData = response.audioData;
      
      setMessages([...newMessages]);
    } catch (error) {
      console.error('Error getting AI response:', error);
      // Update the last message with error
      newMessages[newMessages.length - 1].ai = 'Sorry, I encountered an error. Please try again.';
      setMessages([...newMessages]);
    } finally {
      setIsAiResponding(false);
      setLastInputWasVoice(false);
    }
  };

  return (
    <div className="border-t p-4">
      <form onSubmit={handleSubmit} className="flex space-x-2">
        <button
          type="button"
          onClick={onNewChat}
          className="p-2 text-gray-500 hover:text-gray-700"
          title="New Chat"
        >
          <FaPlus />
        </button>
        <input
          type="text"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 p-2 border rounded-lg"
          disabled={isAiResponding}
        />
        <MicrophoneButton
          onTranscription={(text) => {
            setUserInput(text);
            setLastInputWasVoice(true);
          }}
          disabled={isAiResponding}
        />
        <button
          type="submit"
          disabled={!userInput.trim() || isAiResponding}
          className="p-2 text-blue-500 hover:text-blue-700 disabled:text-gray-400"
        >
          <FaPaperPlane />
        </button>
      </form>
    </div>
  );
} 