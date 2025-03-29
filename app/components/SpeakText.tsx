'use client';

import { useEffect, useRef, useState } from 'react';
import { FaPlayCircle, FaPauseCircle } from 'react-icons/fa';

interface SpeakTextProps {
  text: string;
  audioData?: string; // Base64 encoded audio
  autoPlay?: boolean;
  voiceInput?: boolean; // Whether the user used voice to input their question
}

export default function SpeakText({ text, audioData, autoPlay = true, voiceInput = false }: SpeakTextProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(false);
  
  // Generate a unique ID for this specific message's audio
  const getAudioId = () => {
    // Create a simple hash of the text and audio data to use as ID
    if (!audioData) return null;
    const textHash = text.substring(0, 20); // first 20 chars should be unique enough
    return `audio_played_${textHash}`;
  };

  useEffect(() => {
    if (audioData && audioRef.current) {
      const audioSrc = `data:audio/mp3;base64,${audioData}`;
      audioRef.current.src = audioSrc;
      
      // Check if we've already played this audio
      const audioId = getAudioId();
      const hasPlayed = audioId ? sessionStorage.getItem(audioId) === 'played' : false;
      
      // Only auto-play if the user used voice input AND auto-play is enabled AND it hasn't been played before
      if (autoPlay && !hasPlayed && voiceInput) {
        audioRef.current.play().catch(err => {
          console.error("Audio playback error:", err);
          // If autoplay fails (common on mobile), show controls so user can manually play
          setShowControls(true);
        });
        setIsPlaying(true);
        
        // Mark this audio as played in session storage
        if (audioId) {
          sessionStorage.setItem(audioId, 'played');
        }
      } else {
        // If already played or autoplay disabled, just show controls
        setShowControls(true);
      }
    }
  }, [audioData, autoPlay, voiceInput]);

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(err => console.error("Audio playback error:", err));
        
        // Mark as played when manually played too
        const audioId = getAudioId();
        if (audioId) {
          sessionStorage.setItem(audioId, 'played');
        }
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="speak-text-container relative">
      <div className="speak-text-content mb-1">
        {text}
      </div>
      {audioData && (
        <div className="absolute right-0 top-0 -mr-12">
          <button 
            onClick={togglePlayback}
            className="flex items-center justify-center rounded-full bg-gray-700 text-gray-200 hover:bg-gray-600 p-2 transition-colors"
            aria-label={isPlaying ? "Pause audio" : "Play audio"}
          >
            {isPlaying ? (
              <FaPauseCircle className="w-5 h-5 text-blue-500 animate-pulse" />
            ) : (
              <FaPlayCircle className="w-5 h-5" />
            )}
          </button>
        </div>
      )}
      {audioData && (
        <audio 
          ref={audioRef}
          onEnded={() => setIsPlaying(false)}
          onError={() => {
            setIsPlaying(false);
            setShowControls(true);
          }}
          controls={false}
          className="hidden"
        />
      )}
    </div>
  );
} 