'use client';

/**
 * Convert a Blob to base64 format
 */
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Check if running on iOS
 */
export const isIOS = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

/**
 * Get the best supported audio type for the current browser
 * Instead of using 'audio/mp4' for iOS which has compatibility issues with Whisper API,
 * we specifically use 'audio/wav' which is more widely compatible
 */
export const getBestAudioMimeType = (): string => {
  // Always prefer WAV format for better Whisper API compatibility, especially on iOS
  return 'audio/wav';
};

/**
 * Get audio stream from the user's microphone
 */
export const getMicrophoneStream = async (): Promise<MediaStream> => {
  try {
    // Request access to the microphone
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    console.error('Error accessing microphone:', error);
    throw new Error(`Microphone access denied: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Transcribe audio using the Whisper API
 */
export const transcribeAudio = async (audioBase64: string): Promise<string> => {
  try {
    console.log('Starting transcription request, audio length:', 
      audioBase64 ? `${Math.round(audioBase64.length / 1024)} KB` : 'Empty');
    
    if (!audioBase64 || audioBase64.length < 1000) {
      console.error('Audio data is too short or empty');
      throw new Error('No audio detected. Please try speaking louder or check your microphone permissions.');
    }
    
    const response = await fetch('/api/whisper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        audio: audioBase64,
        isIOS: isIOS(), // Send flag to inform backend about iOS
        format: 'wav'   // Explicitly specify WAV format for better compatibility
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Transcription API error:', errorData);
      
      // More informative error messages based on common issues
      if (errorData.message && errorData.message.includes('file format')) {
        throw new Error('Audio format not compatible. Please try a shorter recording or restart the app.');
      } else if (errorData.message && errorData.message.includes('too short')) {
        throw new Error('Recording is too short. Please speak for at least 2 seconds.');
      } else {
        throw new Error(errorData.message || 'Error transcribing audio');
      }
    }

    const data = await response.json();
    
    if (!data.text || data.text.trim() === '') {
      console.warn('Received empty transcription result');
      throw new Error('No speech detected. Please try speaking more clearly into the microphone.');
    }
    
    console.log('Transcription complete, received text:', data.text.length > 0);
    return data.text;
  } catch (error) {
    console.error('Error in transcription:', error);
    throw error;
  }
}; 