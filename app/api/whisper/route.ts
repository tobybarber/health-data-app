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
    const { audio, isIOS } = body;

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

    // Determine file format based on data URL prefix or isIOS flag
    let mimeType = 'audio/webm';
    let fileExtension = 'webm';
    
    if (isIOS) {
      mimeType = 'audio/mp4';
      fileExtension = 'm4a';
    } else if (dataUrlParts.length > 1) {
      // Try to extract MIME type from the data URL
      const mimeMatch = dataUrlParts[0].match(/data:(.*?);/);
      if (mimeMatch && mimeMatch[1]) {
        mimeType = mimeMatch[1];
        
        // Derive extension from MIME type
        if (mimeType.includes('mp4')) {
          fileExtension = 'm4a';
        } else if (mimeType.includes('mp3')) {
          fileExtension = 'mp3';
        } else if (mimeType.includes('wav')) {
          fileExtension = 'wav';
        }
      }
    }
    
    console.log(`Processing audio as ${mimeType}, using extension .${fileExtension}`);

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
          errorMessage = 'Recording is too short. Please speak for at least 1 second.';
        } else if (errMsg.includes('no speech')) {
          errorMessage = 'No speech detected. Please speak clearly and check your microphone.';
        } else if (errMsg.includes('invalid file format') || errMsg.includes('unsupported media type')) {
          errorMessage = `Invalid file format. This device may not support audio recording in a compatible format.`;
          statusCode = 400; // Use 400 for format issues
          
          // Log additional details for debugging
          console.error('Audio format details:', {
            isIOS,
            mimeType,
            fileExtension,
            bufferSize: audioBuffer.length
          });
        } else {
          errorMessage = transcriptionError.message;
        }
      }
      
      return NextResponse.json({ 
        success: false, 
        message: errorMessage
      }, { status: statusCode });
    }
  } catch (error) {
    console.error('Error processing audio data:', error);
    return NextResponse.json({ 
      success: false, 
      message: `Error processing audio data: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 });
  }
} 