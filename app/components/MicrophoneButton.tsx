'use client';

import { useState } from 'react';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { FaMicrophone, FaSpinner } from 'react-icons/fa';

interface MicrophoneButtonProps {
  onTranscription: (text: string) => void;
  className?: string;
}

export default function MicrophoneButton({ onTranscription, className = '' }: MicrophoneButtonProps) {
  const [isLongPress, setIsLongPress] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const { isRecording, isProcessing, error, startRecording, stopRecording } = useVoiceInput({
    onTranscription,
  });

  // Handle errors
  const [displayError, setDisplayError] = useState<string | null>(null);

  // Show error for 3 seconds then clear it
  if (error && error !== displayError) {
    setDisplayError(error);
    setTimeout(() => setDisplayError(null), 3000);
  }

  // Start recording with timestamp
  const handleStartRecording = () => {
    setIsLongPress(true);
    setRecordingStartTime(Date.now());
    startRecording();
  };

  // Stop recording with minimum duration check
  const handleStopRecording = () => {
    setIsLongPress(false);
    
    // Only stop recording if we've been recording for at least 1 second
    if (recordingStartTime && Date.now() - recordingStartTime < 1000) {
      const timeToWait = 1000 - (Date.now() - recordingStartTime);
      console.log(`Recording too short, waiting ${timeToWait}ms more before stopping`);
      
      // Wait until we reach 1 second minimum
      setTimeout(() => {
        stopRecording();
        setRecordingStartTime(null);
      }, timeToWait);
    } else {
      stopRecording();
      setRecordingStartTime(null);
    }
  };

  // Handle mouse events for desktop
  const handleMouseDown = () => {
    handleStartRecording();
  };

  const handleMouseUp = () => {
    handleStopRecording();
  };

  // Handle touch events for mobile
  const handleTouchStart = () => {
    handleStartRecording();
  };

  const handleTouchEnd = () => {
    handleStopRecording();
  };

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
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={isLongPress ? handleMouseUp : undefined}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={isLongPress ? handleTouchEnd : undefined}
        disabled={isProcessing}
        aria-label={isRecording ? 'Recording in progress' : 'Record voice'}
      >
        {isProcessing ? (
          <FaSpinner className="w-5 h-5 animate-spin" />
        ) : (
          <FaMicrophone className="w-5 h-5" />
        )}
      </button>

      {displayError && (
        <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-red-500 text-white text-xs py-1 px-2 rounded whitespace-nowrap">
          {displayError}
        </div>
      )}

      {isRecording && (
        <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs py-1 px-2 rounded whitespace-nowrap">
          Release to send <span className="animate-pulse">●</span>
        </div>
      )}
    </div>
  );
} 