'use client';

import { useState, useEffect } from 'react';
import { FaVolumeUp, FaVolumeMute, FaSpinner } from 'react-icons/fa';
import { speak, stopSpeaking, findBestVoice, isIOS } from '../lib/speech-utils';

interface SpeakTextProps {
  text: string;
  className?: string;
}

export default function SpeakText({ text, className = '' }: SpeakTextProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasVoices, setHasVoices] = useState(false);

  // Check if we have voices available
  useEffect(() => {
    const checkVoices = () => {
      const bestVoice = findBestVoice();
      if (bestVoice) {
        setHasVoices(true);
        return true;
      }
      return false;
    };

    // Check immediately
    if (checkVoices()) return;

    // If no voices yet, wait for them to load
    const handleVoicesChanged = () => {
      checkVoices();
    };

    // Different browsers handle voiceschanged event differently
    if (window.speechSynthesis) {
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
      } else {
        // For browsers that don't support the event, check periodically
        const interval = setInterval(() => {
          if (checkVoices()) {
            clearInterval(interval);
          }
        }, 100);
        return () => clearInterval(interval);
      }
    }
  }, []);

  const handleSpeak = () => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
      return;
    }

    setIsLoading(true);

    // Device-specific speech options
    const speechOptions = {
      onStart: () => {
        setIsLoading(false);
        setIsSpeaking(true);
      },
      onEnd: () => {
        setIsSpeaking(false);
      }
    };

    // Speak with optimized parameters
    speak(text, speechOptions);
  };

  return (
    <button
      onClick={handleSpeak}
      className={`flex items-center justify-center p-2 rounded-full transition-colors ${
        isSpeaking
          ? 'bg-blue-500 text-white'
          : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
      } ${className}`}
      disabled={isLoading || !hasVoices}
      title={isSpeaking ? 'Stop speaking' : 'Speak text'}
      aria-label={isSpeaking ? 'Stop speaking' : 'Speak text'}
    >
      {isLoading ? (
        <FaSpinner className="w-5 h-5 animate-spin" />
      ) : isSpeaking ? (
        <FaVolumeMute className="w-5 h-5" />
      ) : (
        <FaVolumeUp className="w-5 h-5" />
      )}
    </button>
  );
} 