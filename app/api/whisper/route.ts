import { NextRequest, NextResponse } from 'next/server';
import openai, { validateOpenAIKey } from '../../lib/openai-server';

// Use Node.js runtime for this API route
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    // Verify the OpenAI API key is valid
    const keyStatus = await validateOpenAIKey();
    if (!keyStatus.success) {
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
    const { audio, isIOS, format } = body;

    if (!audio) {
      return NextResponse.json({ 
        success: false, 
        message: 'Audio data is required' 
      }, { status: 400 });
    }

    // Check if the audio data is too small (likely no actual speech)
    const dataUrlParts = audio.split(',');
    const base64Data = dataUrlParts[1] || audio;
    
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

    // Determine file format - explicitly use WAV for best compatibility
    let mimeType = 'audio/wav';
    let fileExtension = 'wav';
    
    // Log the format details for debugging
    console.log(`Processing audio with format preferences: isIOS=${isIOS}, format=${format}`);

    try {
      // Create a data URL if we don't have one
      const dataUrl = dataUrlParts.length > 1 
        ? audio 
        : `data:${mimeType};base64,${base64Data}`;
      
      // Create blob from data URL
      const response = await fetch(dataUrl);
      const audioBlob = await response.blob();
      
      console.log(`Audio blob size: ${audioBlob.size} bytes, type: ${audioBlob.type || mimeType}`);

      // Create a file with the appropriate extension
      const file = new File(
        [audioBlob], 
        `audio.${fileExtension}`, 
        { type: mimeType }
      );

      // Call the OpenAI Whisper API
      const transcription = await openai.audio.transcriptions.create({
        file,
        model: 'whisper-1',
        response_format: 'json',
        temperature: 0.2, // Lower temperature for more accurate transcriptions
        language: 'en'    // Default to English for better accuracy
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
      let statusCode = 500;
      
      if (transcriptionError instanceof Error) {
        const errMsg = transcriptionError.message.toLowerCase();
        
        if (errMsg.includes('too short')) {
          errorMessage = 'Recording is too short. Please speak for at least 2 seconds.';
        } else if (errMsg.includes('no speech')) {
          errorMessage = 'No speech detected. Please speak clearly and check your microphone.';
        } else if (errMsg.includes('invalid file format') || errMsg.includes('unsupported media type')) {
          errorMessage = `Invalid file format. This device may not support audio recording in a compatible format.`;
          statusCode = 400; // Use 400 for format issues
          
          // Log additional details for debugging
          console.error('Audio format details:', {
            isIOS,
            format,
            mimeType,
            fileExtension,
            bufferSize: audioBuffer.length,
            blobType: 'unknown' // We can't access audioBlob here
          });
        } else {
          errorMessage = transcriptionError.message;
        }
      }
      
      return NextResponse.json({ 
        success: false, 
        message: errorMessage,
        details: String(transcriptionError)
      }, { status: statusCode });
    }
  } catch (error) {
    console.error('Error processing audio data:', error);
    return NextResponse.json({ 
      success: false, 
      message: `Error processing audio data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: String(error)
    }, { status: 500 });
  }
} 