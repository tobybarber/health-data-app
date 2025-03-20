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
      body: JSON.stringify({ audio: audioBase64 }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Transcription API error:', errorData);
      throw new Error(errorData.message || 'Error transcribing audio');
    }

    const data = await response.json();
    
    if (!data.text || data.text.trim() === '') {
      console.warn('Received empty transcription result');
      throw new Error('No speech detected. Please try speaking more clearly.');
    }
    
    console.log('Transcription complete, received text:', data.text.length > 0);
    return data.text;
  } catch (error) {
    console.error('Error in transcription:', error);
    throw error;
  }
}; 