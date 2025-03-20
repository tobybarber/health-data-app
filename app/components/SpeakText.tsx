'use client';

import { useState, useEffect } from 'react';
import { FaVolumeUp, FaVolumeMute, FaSpinner } from 'react-icons/fa';
import { speak, stopSpeaking } from '../lib/speech-utils';

interface SpeakTextProps {
  text: string;
  className?: string;
}

export default function SpeakText({ text, className = '' }: SpeakTextProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);
  
  // Clean up if text changes while speaking
  useEffect(() => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
    }
  }, [text]);
  
  const handleToggleSpeech = () => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
      speak(text, {
        onEnd: () => setIsSpeaking(false),
        // If the speech fails to start, make sure we reset the state
        onStart: () => setTimeout(() => {
          if (!document.querySelector('speech-synthesis-boundary')) {
            setIsSpeaking(true);
          }
        }, 500)
      });
    }
  };
  
  return (
    <button
      onClick={handleToggleSpeech}
      className={`p-1 rounded-full ${isSpeaking ? 'text-primary-blue' : 'text-gray-400 hover:text-gray-300'} ${className}`}
      aria-label={isSpeaking ? 'Stop speaking' : 'Speak text'}
    >
      {isSpeaking ? <FaVolumeUp size={16} /> : <FaVolumeMute size={16} />}
    </button>
  );
} 