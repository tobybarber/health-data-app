'use client';

import { useState, useRef, useEffect } from 'react';
import { blobToBase64, transcribeAudio, getBestAudioMimeType } from '../lib/voice-utils';

interface UseVoiceInputProps {
  onTranscription?: (text: string) => void;
  minRecordingTime?: number; // Minimum recording time in ms
}

export function useVoiceInput({ 
  onTranscription,
  minRecordingTime = 1000 // Default minimum recording time: 1 second
}: UseVoiceInputProps = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);

  // Clean up function to stop recording and release media stream
  const cleanup = () => {
    console.log('Cleaning up media resources');
    
    // Stop the MediaRecorder if it's still active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn('Error stopping MediaRecorder:', e);
      }
    }
    
    // Stop and release all media tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
          console.log(`Stopped track: ${track.kind}`);
        } catch (e) {
          console.warn(`Error stopping track ${track.kind}:`, e);
        }
      });
      streamRef.current = null;
    }
    
    setIsRecording(false);
    mediaRecorderRef.current = null;
    recordingStartTimeRef.current = null;
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
      
      // Always release previous stream before requesting a new one
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      streamRef.current = stream;
      
      // Clear previous audio chunks
      audioChunksRef.current = [];
      
      // Get the appropriate MIME type for this browser
      const mimeType = getBestAudioMimeType();
      
      // Create a new MediaRecorder instance with the appropriate MIME type
      let mediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(streamRef.current, { mimeType });
      } catch (e) {
        console.warn(`MediaRecorder does not support ${mimeType} on this browser, trying without specifying format`);
        mediaRecorder = new MediaRecorder(streamRef.current);
      }
      
      mediaRecorderRef.current = mediaRecorder;
      
      console.log(`Recording started with mime type: ${mediaRecorder.mimeType}`);
      
      // Setup event handlers
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        if (audioChunksRef.current.length === 0) {
          setError('No audio was recorded. Please try again.');
          cleanup(); // Make sure to clean up even if no audio was recorded
          return;
        }
        
        try {
          setIsProcessing(true);
          
          // Create audio blob with the format that was used for recording
          const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
          
          console.log(`Audio recorded as ${mediaRecorder.mimeType}, size: ${audioBlob.size} bytes`);
          
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
          // Make sure to release the microphone when processing is done
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
        }
      };
      
      // Set recording start time
      recordingStartTimeRef.current = Date.now();
      
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
    // Check if we're recording and have a recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      // Check if we've met the minimum recording time
      const now = Date.now();
      const elapsedTime = recordingStartTimeRef.current ? now - recordingStartTimeRef.current : 0;
      
      if (elapsedTime < minRecordingTime) {
        // If recording is too short, wait until minimum time is reached
        const timeToWait = minRecordingTime - elapsedTime;
        console.log(`Recording too short (${elapsedTime}ms), waiting ${timeToWait}ms more before stopping`);
        
        setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            console.log('Now stopping recorder after reaching minimum duration');
            mediaRecorderRef.current.stop();
            setIsRecording(false);
          } else {
            // If recorder is already inactive, make sure to clean up
            cleanup();
          }
        }, timeToWait);
        return;
      }
      
      // Check if we have any audio data before stopping
      if (audioChunksRef.current.length === 0) {
        console.log('No audio chunks recorded yet, continuing recording a bit longer...');
        // Give it a moment to collect data
        setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            console.log('Now stopping recorder with chunks:', audioChunksRef.current.length);
            mediaRecorderRef.current.stop();
            setIsRecording(false);
          } else {
            // If recorder is already inactive but we still have stream, clean up
            cleanup();
          }
        }, 500);
        return;
      }
      
      console.log('Stopping recorder with chunks:', audioChunksRef.current.length);
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    } else {
      // If there's no active recorder but we still have a stream, make sure to clean up
      cleanup();
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