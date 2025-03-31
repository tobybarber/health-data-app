'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FaVolumeUp, FaStop } from 'react-icons/fa';

export interface SpeakTextProps {
  text: string;
  audioData?: string;
  voiceInput?: boolean;
  iconOnly?: boolean;
  autoPlay?: boolean;
}

export default function SpeakText({ 
  text, 
  audioData, 
  voiceInput = false, 
  iconOnly = false,
  autoPlay = false
}: SpeakTextProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAutoPlayed, setHasAutoPlayed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioDataRef = useRef<string | undefined>(audioData);
  const autoPlayAttemptedRef = useRef<boolean>(false);
  
  // Only reset autoPlay tracking when audioData changes and it's actually different
  useEffect(() => {
    if (audioData !== audioDataRef.current) {
      console.log('Audio data actually changed, resetting hasAutoPlayed');
      audioDataRef.current = audioData;
      setHasAutoPlayed(false);
      autoPlayAttemptedRef.current = false;
    }
  }, [audioData]);

  // Function to create and setup audio element
  const createAudio = useCallback(() => {
    if (!audioData) return null;
    
    try {
      // Create a new audio element
      const audioSrc = audioData.startsWith('data:') 
        ? audioData 
        : `data:audio/mp3;base64,${audioData}`;
      
      const newAudio = new Audio(audioSrc);
      
      // Set preload attribute
      newAudio.preload = 'auto';
      
      // Add event listeners
      newAudio.addEventListener('ended', () => {
        console.log('Audio ended');
        setIsPlaying(false);
        audioRef.current = null;
      });
      
      newAudio.addEventListener('error', (e) => {
        console.error('Audio playback error:', e);
        setError('Failed to play audio');
        setIsPlaying(false);
        audioRef.current = null;
      });
      
      return newAudio;
    } catch (err) {
      console.error('Error creating audio:', err);
      setError('Failed to create audio player');
      return null;
    }
  }, [audioData]);

  // Function to stop audio playback
  const stopAudio = useCallback(() => {
    console.log('Stopping audio');
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
      } catch (error) {
        console.error('Error stopping audio:', error);
      }
    }
    // Always reset the audio reference
    audioRef.current = null;
  }, []);

  // Helper function to play audio with appropriate error handling
  const playAudio = useCallback(async (audio: HTMLAudioElement): Promise<boolean> => {
    try {
      // Give browser a moment to process user interaction
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        await playPromise;
        console.log('Audio playing successfully');
        setIsPlaying(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to play audio:', err);
      setError('Failed to play audio: ' + (err instanceof Error ? err.message : String(err)));
      setIsPlaying(false);
      audioRef.current = null;
      return false;
    }
  }, []);

  // Handle play/pause toggle
  const togglePlayback = useCallback(async () => {
    console.log('Toggle playback called, isPlaying:', isPlaying);
    try {
      // Clear any previous errors
      setError(null);
      
      // Check if we have audio data
      if (!audioData) {
        throw new Error('No audio data available');
      }

      // If already playing, stop the audio and return
      if (isPlaying && audioRef.current) {
        stopAudio();
        return;
      }

      // Stop any existing audio
      stopAudio();

      // Create a new audio element
      const newAudio = createAudio();
      if (!newAudio) {
        throw new Error('Failed to create audio element');
      }
      
      // Save the audio element reference
      audioRef.current = newAudio;
      
      // Try to play the audio
      console.log('Attempting to play audio via manual click');
      await playAudio(newAudio);
    } catch (err) {
      console.error('Toggle playback error:', err);
      setError(err instanceof Error ? err.message : 'Failed to play audio');
      setIsPlaying(false);
      audioRef.current = null;
    }
  }, [audioData, isPlaying, stopAudio, createAudio, playAudio]);

  // Auto-play audio - use a single-fire effect with a cleanup
  useEffect(() => {
    let mounted = true;
    
    const triggerAutoplay = async () => {
      // Only attempt autoplay once per audioData change
      if (autoPlayAttemptedRef.current) {
        return;
      }
      
      // Only autoplay if requested, we have audio data, and we're not already playing
      if (mounted && autoPlay && audioData && !isPlaying && !hasAutoPlayed) {
        console.log('Attempting autoplay with conditions - autoPlay:', autoPlay, 'audioData:', !!audioData, 'isPlaying:', isPlaying, 'hasAutoPlayed:', hasAutoPlayed);
        autoPlayAttemptedRef.current = true;
        
        try {
          // Mark as auto-played to prevent further attempts
          setHasAutoPlayed(true);
          
          // Create audio element
          const newAudio = createAudio();
          if (!newAudio || !mounted) return;
          
          // Set the reference
          audioRef.current = newAudio;
          
          // Directly play without relying on togglePlayback to avoid re-renders
          console.log('Starting actual autoplay attempt');
          setTimeout(() => {
            if (mounted && audioRef.current === newAudio) {
              newAudio.play()
                .then(() => {
                  if (mounted) {
                    console.log('Autoplay succeeded');
                    setIsPlaying(true);
                  }
                })
                .catch(err => {
                  console.error('Autoplay failed:', err);
                  if (mounted) {
                    setError('Autoplay blocked: Click play to listen');
                    setIsPlaying(false);
                    if (audioRef.current === newAudio) {
                      audioRef.current = null;
                    }
                  }
                });
            }
          }, 500);
        } catch (err) {
          console.error('Autoplay setup error:', err);
        }
      }
    };
    
    // Add a delay to ensure component is fully mounted
    const timeoutId = setTimeout(triggerAutoplay, 300);
    
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      
      // Don't stop audio on effect cleanup - let it continue playing
      // This fixes issues with remounts stopping audio
    };
  }, [autoPlay, audioData, isPlaying, hasAutoPlayed, createAudio]);

  // Clean up when component unmounts completely
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        } catch (e) {
          console.error('Final cleanup error:', e);
        }
        audioRef.current = null;
      }
    };
  }, []);

  return (
    <div className={`flex ${iconOnly ? '' : 'flex-col space-y-2'}`}>
      {!iconOnly && <div className="whitespace-pre-wrap">{text}</div>}
      {audioData && (
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Play button clicked');
              togglePlayback();
            }}
            className={`p-2 rounded-full ${
              isPlaying 
                ? 'bg-red-500 text-white hover:bg-red-600 shadow-md' 
                : iconOnly 
                  ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-md' 
                  : 'bg-blue-500 text-white hover:bg-blue-600'
            } focus:outline-none focus:ring-2 focus:ring-blue-300`}
            title={isPlaying ? 'Stop' : 'Play audio'}
            aria-label={isPlaying ? 'Stop audio playback' : 'Play audio'}
          >
            {isPlaying ? <FaStop /> : <FaVolumeUp />}
          </button>
          {voiceInput && !iconOnly && (
            <span className="text-sm text-gray-500">
              Voice input detected - audio response available
            </span>
          )}
        </div>
      )}
      {error && !iconOnly && (
        <div className="text-sm text-red-500">
          {error}
        </div>
      )}
    </div>
  );
}