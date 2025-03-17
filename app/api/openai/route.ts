import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

// Initialize OpenAI client server-side
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Available server-side
});

/**
 * Main OpenAI API endpoint for general text completions
 * 
 * This endpoint provides a simple interface to the OpenAI Chat Completions API.
 * It accepts a prompt and optional system prompt, and returns the generated response.
 * 
 * @param request The incoming request object
 * @returns A JSON response with the generated text
 */
export async function POST(request: NextRequest) {
  try {
    const { prompt, systemPrompt, model = 'gpt-4o', temperature = 0.7, max_tokens } = await request.json();
    
    if (!prompt) {
      return NextResponse.json({ error: 'Missing prompt parameter' }, { status: 400 });
    }
    
    const messages = [];
    
    // Add system message if provided
    if (systemPrompt) {
      messages.push({ role: 'system' as const, content: systemPrompt });
    }
    
    // Add user message
    messages.push({ role: 'user' as const, content: prompt });
    
    // Configure request parameters
    const requestParams: any = {
      model: model,
      messages: messages,
      temperature: temperature,
    };
    
    // Add max_tokens if provided
    if (max_tokens) {
      requestParams.max_tokens = max_tokens;
    }
    
    // Call OpenAI API
    const response = await openai.chat.completions.create(requestParams);
    
    // Return the response
    return NextResponse.json({ 
      result: response.choices[0].message.content,
      model: model,
      usage: response.usage
    });
  } catch (error: any) {
    console.error('OpenAI API error:', error);
    
    // Return a more detailed error response
    return NextResponse.json({ 
      error: 'OpenAI API error', 
      message: error.message,
      details: error.response?.data || error
    }, { status: 500 });
  }
} 