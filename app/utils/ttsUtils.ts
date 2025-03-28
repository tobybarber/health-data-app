import { Readable } from 'stream';

/**
 * Generate speech from text using OpenAI's TTS API
 * @param text The text to convert to speech
 * @param voice The voice to use (alloy, echo, fable, onyx, nova, shimmer)
 * @returns A Promise resolving to an ArrayBuffer containing the audio data
 */
export async function generateSpeech(text: string, voice: string = 'alloy'): Promise<ArrayBuffer> {
  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: voice,
        response_format: 'mp3'
      })
    });

    if (!response.ok) {
      throw new Error(`TTS API error: ${response.status}`);
    }

    return await response.arrayBuffer();
  } catch (error) {
    console.error('Error generating speech:', error);
    throw error;
  }
}

/**
 * Generate streaming speech from text using OpenAI's TTS API
 * This is useful for longer text where you want to start playing before the entire audio is generated
 * @param text The text to convert to speech
 * @param voice The voice to use (alloy, echo, fable, onyx, nova, shimmer)
 * @returns A Promise resolving to a ReadableStream of audio chunks
 */
export async function generateStreamingSpeech(text: string, voice: string = 'alloy'): Promise<ReadableStream> {
  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: voice,
        response_format: 'opus', // Use opus format for better streaming
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`TTS streaming API error: ${response.status}`);
    }

    return response.body!;
  } catch (error) {
    console.error('Error generating streaming speech:', error);
    throw error;
  }
}

/**
 * Calculate the approximate cost of TTS for a given text
 * @param text The text to estimate cost for
 * @returns The estimated cost in USD
 */
export function calculateTTSCost(text: string): number {
  const charCount = text.length;
  // TTS-1 costs $0.015 per 1,000 characters
  return (charCount / 1000) * 0.015;
} 