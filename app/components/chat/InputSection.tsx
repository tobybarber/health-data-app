'use client';

import { useState, useEffect, useRef } from 'react';
import { FaPaperPlane, FaPlus } from 'react-icons/fa';
import MicrophoneButton from '../MicrophoneButton';
import { Message } from '../../types/chat';

interface InputSectionProps {
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  isAiResponding: boolean;
  setIsAiResponding: (isResponding: boolean) => void;
  lastInputWasVoice: boolean;
  setLastInputWasVoice: (wasVoice: boolean) => void;
  onNewChat: () => void;
  onSendMessage: (text: string, wasVoice: boolean) => Promise<void>;
}

export default function InputSection({
  messages,
  setMessages,
  isAiResponding,
  setIsAiResponding,
  lastInputWasVoice,
  setLastInputWasVoice,
  onNewChat,
  onSendMessage
}: InputSectionProps) {
  const [userInput, setUserInput] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const lastVoiceInputRef = useRef<boolean>(lastInputWasVoice);

  // Effect to log voice input state changes and update the ref
  useEffect(() => {
    console.log('Voice input state changed:', lastInputWasVoice);
    lastVoiceInputRef.current = lastInputWasVoice;
  }, [lastInputWasVoice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isAiResponding) return;

    // Capture the current voice input state before resetting
    const wasVoiceInput = lastVoiceInputRef.current;
    console.log('Submitting message, wasVoiceInput:', wasVoiceInput);
    
    // Save the user input and clear the input field
    const messageText = userInput.trim();
    setUserInput('');
    
    // Set the responding state
    setIsAiResponding(true);
    
    try {
      // Add timestamp to the user's message for better tracking
      const userMessage: Message = {
        user: messageText,
        ai: '',
        wasVoiceInput: wasVoiceInput,
        timestamp: Date.now()
      };
      
      // Update the messages immediately with just the user's message
      setMessages([...messages, userMessage]);
      
      // Call the parent's onSendMessage callback
      await onSendMessage(messageText, wasVoiceInput);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsAiResponding(false);
      
      // Always reset voice input state after sending
      if (lastVoiceInputRef.current) {
        setTimeout(() => {
          setLastInputWasVoice(false);
        }, 300); // Small delay to ensure state changes don't conflict
      }
    }
  };

  return (
    <div className="p-4 pb-16 bg-black fixed bottom-0 left-0 right-0 z-20">
      <form onSubmit={handleSubmit} className="flex space-x-2 max-w-4xl mx-auto">
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
          onChange={(e) => {
            setUserInput(e.target.value);
            // If the user types, it's not a voice input anymore
            if (lastInputWasVoice) {
              console.log('User is typing, setting voice input to false');
              setLastInputWasVoice(false);
            }
          }}
          placeholder="Type your message..."
          className="flex-1 p-2 border border-gray-700 bg-gray-900 text-white rounded-lg"
          disabled={isAiResponding || transcribing}
        />
        <MicrophoneButton
          onTranscriptionStart={() => {
            setTranscribing(true);
          }}
          onTranscriptionEnd={() => {
            setTranscribing(false);
          }}
          onTranscription={(text) => {
            console.log('Transcription received, setting voice input to true');
            setUserInput(text);
            setLastInputWasVoice(true);
            lastVoiceInputRef.current = true;
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