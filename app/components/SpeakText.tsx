'use client';

import { useEffect, useRef, useState } from 'react';

interface SpeakTextProps {
  text: string;
  audioData?: string; // Base64 encoded audio
  autoPlay?: boolean;
}

export default function SpeakText({ text, audioData, autoPlay = true }: SpeakTextProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    if (audioData && audioRef.current) {
      const audioSrc = `data:audio/mp3;base64,${audioData}`;
      audioRef.current.src = audioSrc;
      
      if (autoPlay) {
        audioRef.current.play().catch(err => {
          console.error("Audio playback error:", err);
          // If autoplay fails (common on mobile), show controls so user can manually play
          setShowControls(true);
        });
        setIsPlaying(true);
      } else {
        setShowControls(true);
      }
    }
  }, [audioData, autoPlay]);

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(err => console.error("Audio playback error:", err));
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="speak-text-container relative">
      <div className="speak-text-content">
        {text}
      </div>
      {audioData && (
        <>
          <audio 
            ref={audioRef}
            onEnded={() => setIsPlaying(false)}
            onError={() => {
              setIsPlaying(false);
              setShowControls(true);
            }}
            controls={showControls}
            className={showControls ? "mt-2 w-full max-w-md" : "hidden"}
          />
          {!showControls && (
            <button 
              onClick={togglePlayback}
              className={`absolute top-0 right-0 p-2 rounded-full ${isPlaying ? 'text-blue-500' : 'text-gray-500'}`}
              aria-label={isPlaying ? "Pause audio" : "Play audio"}
            >
              {isPlaying ? (
                <span className="flex items-center">
                  <span className="animate-pulse">🔊</span>
                </span>
              ) : (
                <span>🔈</span>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
} 