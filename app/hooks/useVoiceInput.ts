'use client';

import { useState, useRef, useEffect } from 'react';
import { blobToBase64, transcribeAudio } from '../lib/voice-utils';

interface UseVoiceInputProps {
  onTranscription?: (text: string) => void;
}

export function useVoiceInput({ onTranscription }: UseVoiceInputProps = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Clean up function to stop recording and release media stream
  const cleanup = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsRecording(false);
    mediaRecorderRef.current = null;
  };

  // Setup effect to handle cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  // Function to start recording
  const startRecording = async () => {
    try {
      setError(null);
      
      // Request microphone access if we don't have it
      if (!streamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
      }
      
      // Clear previous audio chunks
      audioChunksRef.current = [];
      
      // Create a new MediaRecorder instance
      const mediaRecorder = new MediaRecorder(streamRef.current);
      mediaRecorderRef.current = mediaRecorder;
      
      // Setup event handlers
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        if (audioChunksRef.current.length === 0) return;
        
        try {
          setIsProcessing(true);
          
          // Create audio blob from chunks
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          // Convert to base64
          const base64Audio = await blobToBase64(audioBlob);
          
          // Send to Whisper API for transcription
          const text = await transcribeAudio(base64Audio);
          
          // Call the onTranscription callback with the transcribed text
          if (onTranscription && text) {
            onTranscription(text);
          }
        } catch (error) {
          console.error('Error processing audio:', error);
          setError(error instanceof Error ? error.message : 'Unknown error processing audio');
        } finally {
          setIsProcessing(false);
        }
      };
      
      // Start recording
      mediaRecorder.start(200); // Collect data every 200ms
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      setError(error instanceof Error ? error.message : 'Could not start recording');
      cleanup();
    }
  };

  // Function to stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return {
    isRecording,
    isProcessing,
    error,
    startRecording,
    stopRecording
  };
} 