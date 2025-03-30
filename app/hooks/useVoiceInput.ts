'use client';

import { useState, useEffect, useCallback } from 'react';
import { handleError } from '../utils/errorHandling';
import type { SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent } from 'web-speech-types';

interface VoiceInputState {
  isListening: boolean;
  transcript: string;
  error: string | null;
}

export const useVoiceInput = () => {
  const [state, setState] = useState<VoiceInputState>({
    isListening: false,
    transcript: '',
    error: null,
  });
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setState(prev => ({ ...prev, isListening: true, error: null }));
        };

        recognition.onend = () => {
          setState(prev => ({ ...prev, isListening: false }));
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = Array.from(event.results)
            .map(result => result[0])
            .map(result => result.transcript)
            .join('');
          setState(prev => ({ ...prev, transcript }));
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          const error = handleError(event.error);
          setState(prev => ({ ...prev, error: error.message, isListening: false }));
        };

        setRecognition(recognition);
      } else {
        setState(prev => ({ 
          ...prev, 
          error: 'Speech recognition is not supported in this browser.' 
        }));
      }
    }

    return () => {
      if (recognition) {
        recognition.stop();
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (recognition && !state.isListening) {
      try {
        recognition.start();
        setState(prev => ({ ...prev, error: null }));
      } catch (error) {
        const handledError = handleError(error);
        setState(prev => ({ ...prev, error: handledError.message }));
      }
    }
  }, [recognition, state.isListening]);

  const stopListening = useCallback(() => {
    if (recognition && state.isListening) {
      recognition.stop();
    }
  }, [recognition, state.isListening]);

  const resetTranscript = useCallback(() => {
    setState(prev => ({ ...prev, transcript: '', error: null }));
  }, []);

  return {
    isListening: state.isListening,
    transcript: state.transcript,
    error: state.error,
    startListening,
    stopListening,
    resetTranscript,
    isSupported: !!recognition
  };
}; 