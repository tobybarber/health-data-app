'use client';

import { useState, useEffect, useCallback } from 'react';
import { FaMicrophone } from 'react-icons/fa';

export interface MicrophoneButtonProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
}

export default function MicrophoneButton({ onTranscription, disabled = false }: MicrophoneButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // @ts-ignore
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          onTranscription(transcript);
          setIsListening(false);
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        setRecognition(recognition);
      }
    }
  }, [onTranscription]);

  const toggleListening = useCallback(() => {
    if (disabled) return;
    
    if (isListening) {
      recognition?.stop();
      setIsListening(false);
    } else if (recognition) {
      recognition.start();
      setIsListening(true);
    }
  }, [isListening, recognition, disabled]);

  if (!recognition) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={toggleListening}
      disabled={disabled}
      className={`p-2 rounded-full ${
        isListening 
          ? 'bg-red-500 text-white' 
          : disabled 
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
            : 'text-gray-500 hover:text-gray-700'
      }`}
      title={isListening ? 'Stop recording' : 'Start recording'}
    >
      <FaMicrophone className={`w-5 h-5 ${isListening ? 'animate-pulse' : ''}`} />
    </button>
  );
} 