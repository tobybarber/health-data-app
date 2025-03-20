import { NextRequest, NextResponse } from 'next/server';
import openai, { isApiKeyValid } from '../../lib/openai-server';

// Use Node.js runtime for this API route
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    // Verify the OpenAI API key is valid
    const keyStatus = await isApiKeyValid();
    if (!keyStatus.valid) {
      console.error('Invalid or missing OpenAI API key:', keyStatus.message);
      return NextResponse.json(
        { 
          success: false, 
          message: `OpenAI API key is invalid or has insufficient permissions: ${keyStatus.message}`,
          error: 'OPENAI_API_KEY_INVALID'
        },
        { status: 500 }
      );
    }

    // Get the request body (audio file as base64)
    const body = await request.json();
    const { audio } = body;

    if (!audio) {
      return NextResponse.json({ 
        success: false, 
        message: 'Audio data is required' 
      }, { status: 400 });
    }

    // Convert base64 audio to a buffer
    const audioBuffer = Buffer.from(audio.split(',')[1], 'base64');

    // Create a temporary file for the audio data
    const response = await fetch('data:audio/webm;base64,' + audio.split(',')[1]);
    const audioBlob = await response.blob();

    try {
      // Create a FormData object to send to OpenAI
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', 'whisper-1');
      
      // Call the OpenAI Whisper API
      const transcription = await openai.audio.transcriptions.create({
        file: new File([audioBlob], 'audio.webm', { type: 'audio/webm' }),
        model: 'whisper-1',
      });

      return NextResponse.json({ 
        success: true, 
        text: transcription.text 
      });
    } catch (transcriptionError) {
      console.error('Error transcribing audio:', transcriptionError);
      return NextResponse.json({ 
        success: false, 
        message: `Error transcribing audio: ${transcriptionError instanceof Error ? transcriptionError.message : 'Unknown error'}` 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error processing audio data:', error);
    return NextResponse.json({ 
      success: false, 
      message: `Error processing audio data: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 });
  }
} 