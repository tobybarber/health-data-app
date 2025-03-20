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
    const response = await fetch('/api/whisper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio: audioBase64 }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Error transcribing audio');
    }

    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error('Error in transcription:', error);
    throw error;
  }
}; 