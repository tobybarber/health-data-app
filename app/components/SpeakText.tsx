'use client';

import { useState, useEffect } from 'react';
import { FaVolumeUp, FaStop } from 'react-icons/fa';

export interface SpeakTextProps {
  text: string;
  audioData?: string;
  voiceInput?: boolean;
}

export default function SpeakText({ text, audioData, voiceInput = false }: SpeakTextProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Cleanup function to stop audio when component unmounts
    return () => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    };
  }, [audio]);

  const handlePlay = async () => {
    try {
      setError(null);
      
      if (!audioData) {
        throw new Error('No audio data available');
      }

      if (isPlaying && audio) {
        audio.pause();
        audio.currentTime = 0;
        setIsPlaying(false);
        return;
      }

      const newAudio = new Audio(audioData);
      setAudio(newAudio);

      await newAudio.play();
      setIsPlaying(true);

      newAudio.onended = () => {
        setIsPlaying(false);
        setAudio(null);
      };

      newAudio.onerror = () => {
        setError('Failed to play audio');
        setIsPlaying(false);
        setAudio(null);
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to play audio');
      setIsPlaying(false);
      setAudio(null);
    }
  };

  return (
    <div className="flex flex-col space-y-2">
      <div className="whitespace-pre-wrap">{text}</div>
      {audioData && (
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePlay}
            className={`p-2 rounded-full ${
              isPlaying 
                ? 'bg-red-500 text-white' 
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
            title={isPlaying ? 'Stop' : 'Play'}
          >
            {isPlaying ? <FaStop /> : <FaVolumeUp />}
          </button>
          {voiceInput && (
            <span className="text-sm text-gray-500">
              Voice input detected - audio response available
            </span>
          )}
        </div>
      )}
      {error && (
        <div className="text-sm text-red-500">
          {error}
        </div>
      )}
    </div>
  );
} 