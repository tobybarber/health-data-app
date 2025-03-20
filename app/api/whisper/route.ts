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

    // Check if the audio data is too small (likely no actual speech)
    const base64Data = audio.split(',')[1];
    if (!base64Data || base64Data.length < 1000) {
      console.warn('Audio data is too small or empty:', base64Data ? base64Data.length : 0);
      return NextResponse.json({ 
        success: false, 
        message: 'Audio data is too short. Please speak longer and more clearly.' 
      }, { status: 400 });
    }

    // Convert base64 audio to a buffer
    const audioBuffer = Buffer.from(base64Data, 'base64');
    console.log(`Audio buffer size: ${audioBuffer.length} bytes`);

    // Check if buffer is sufficient size
    if (audioBuffer.length < 500) {
      console.warn('Audio buffer is too small:', audioBuffer.length);
      return NextResponse.json({ 
        success: false, 
        message: 'Audio recording is too short. Please speak longer and more clearly.' 
      }, { status: 400 });
    }

    // Create a temporary file for the audio data
    const response = await fetch('data:audio/webm;base64,' + base64Data);
    const audioBlob = await response.blob();
    
    console.log(`Audio blob size: ${audioBlob.size} bytes`);

    try {
      // Call the OpenAI Whisper API
      const transcription = await openai.audio.transcriptions.create({
        file: new File([audioBlob], 'audio.webm', { type: 'audio/webm' }),
        model: 'whisper-1',
      });

      console.log('Transcription successful, text length:', transcription.text.length);

      return NextResponse.json({ 
        success: true, 
        text: transcription.text || '' 
      });
    } catch (transcriptionError) {
      console.error('Error transcribing audio:', transcriptionError);
      
      // Provide more helpful error messages based on the error
      let errorMessage = 'Error transcribing audio.';
      
      if (transcriptionError instanceof Error) {
        const errMsg = transcriptionError.message.toLowerCase();
        
        if (errMsg.includes('too short')) {
          errorMessage = 'Recording is too short. Please speak for at least 1 second.';
        } else if (errMsg.includes('no speech')) {
          errorMessage = 'No speech detected. Please speak clearly and check your microphone.';
        } else {
          errorMessage = transcriptionError.message;
        }
      }
      
      return NextResponse.json({ 
        success: false, 
        message: errorMessage
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