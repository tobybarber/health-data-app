'use client';

import { useState, useEffect, useRef } from 'react';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { FaMicrophone, FaSpinner, FaStop } from 'react-icons/fa';
import { isIOS } from '../lib/voice-utils';

interface MicrophoneButtonProps {
  onTranscription: (text: string) => void;
  className?: string;
}

export default function MicrophoneButton({ onTranscription, className = '' }: MicrophoneButtonProps) {
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const { isRecording, isProcessing, error, startRecording, stopRecording } = useVoiceInput({
    onTranscription,
  });

  // Handle errors
  const [displayError, setDisplayError] = useState<string | null>(null);
  const [isiOSDevice, setIsIOSDevice] = useState(false);
  
  // Timer ref for cleanup
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Check if iOS device on client side
  useEffect(() => {
    setIsIOSDevice(isIOS());
  }, []);

  // Show error for 3 seconds then clear it
  useEffect(() => {
    if (error && error !== displayError) {
      setDisplayError(error);
      const timer = setTimeout(() => setDisplayError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [error, displayError]);
  
  // Safety cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop any ongoing recording if component unmounts
      if (isRecording) {
        console.log('Component unmounting, stopping recording');
        stopRecording();
      }
      
      // Clear any pending timers
      if (recordingTimerRef.current) {
        clearTimeout(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    };
  }, [isRecording, stopRecording]);

  // Toggle recording on/off
  const toggleRecording = () => {
    if (isProcessing) return; // Don't do anything while processing
    
    if (isRecording) {
      // Stop recording if already recording
      stopRecording();
      setRecordingStartTime(null);
      
      // Clear any existing timers
      if (recordingTimerRef.current) {
        clearTimeout(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    } else {
      // Start recording
      setRecordingStartTime(Date.now());
      startRecording();
    }
  };
  
  // Auto-stop recording after 30 seconds as a safety measure
  useEffect(() => {
    if (isRecording && !isProcessing) {
      const safetyTimeout = setTimeout(() => {
        console.log('Safety timeout reached - stopping recording after 30s');
        stopRecording();
        setRecordingStartTime(null);
      }, 30000);
      
      return () => clearTimeout(safetyTimeout);
    }
  }, [isRecording, isProcessing, stopRecording]);

  return (
    <div className="relative">
      <button
        type="button"
        className={`flex items-center justify-center rounded-full p-2 ${
          isRecording
            ? 'bg-red-500 text-white animate-pulse'
            : isProcessing
            ? 'bg-yellow-500 text-white'
            : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
        } transition-colors ${className}`}
        onClick={toggleRecording}
        disabled={isProcessing}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {isProcessing ? (
          <FaSpinner className="w-5 h-5 animate-spin" />
        ) : isRecording ? (
          <FaStop className="w-5 h-5" />
        ) : (
          <FaMicrophone className="w-5 h-5" />
        )}
      </button>

      {isiOSDevice && (
        <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white text-xs py-1 px-2 rounded whitespace-nowrap max-w-xs text-center">
          iOS: Click once to start, again to stop
        </div>
      )}

      {displayError && (
        <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-red-500 text-white text-xs py-1 px-2 rounded whitespace-nowrap max-w-xs text-center">
          {displayError}
        </div>
      )}
    </div>
  );
} 