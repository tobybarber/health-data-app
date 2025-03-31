import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { Message } from '../../types/chat';

// Initialize OpenAI client server-side
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Available server-side
});

/**
 * Chat API endpoint for handling conversations
 * 
 * This endpoint accepts a message, conversation history, and user ID,
 * and returns the AI's response.
 * 
 * @param request The incoming request object
 * @returns A JSON response with the generated message
 */
export async function POST(request: NextRequest) {
  try {
    const { message, history, userId, wasVoiceInput = false } = await request.json();
    
    if (!message) {
      return NextResponse.json({ error: 'Missing message parameter' }, { status: 400 });
    }
    
    // Format conversation history for OpenAI
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
    
    // Add system message
    messages.push({ 
      role: 'system', 
      content: 'You are a helpful health assistant. Provide concise and accurate information.' 
    });
    
    // Add conversation history
    if (history && history.length > 0) {
      history.forEach((entry: Message) => {
        if (entry.user) {
          messages.push({ role: 'user', content: entry.user });
        }
        if (entry.ai) {
          messages.push({ role: 'assistant', content: entry.ai });
        }
      });
    }
    
    // Add the current user message
    messages.push({ role: 'user', content: message });
    
    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
      temperature: 0.7,
    });
    
    const aiResponse = response.choices[0].message.content || '';
    const responseId = response.id;
    
    // Handle text-to-speech if the input was voice
    let audioData = null;
    if (wasVoiceInput) {
      try {
        const speechResponse = await openai.audio.speech.create({
          model: 'tts-1',
          voice: 'alloy',
          input: aiResponse,
        });
        
        const buffer = await speechResponse.arrayBuffer();
        audioData = Buffer.from(buffer).toString('base64');
      } catch (speechError) {
        console.error('Text-to-speech error:', speechError);
        // Continue without audio if TTS fails
      }
    }
    
    // Return the response
    return NextResponse.json({ 
      message: aiResponse,
      responseId: responseId,
      audioData: audioData
    });
  } catch (error: any) {
    console.error('Chat API error:', error);
    
    // Return a more detailed error response
    return NextResponse.json({ 
      error: 'Chat API error', 
      message: error.message,
      details: error.response?.data || error
    }, { status: 500 });
  }
} 