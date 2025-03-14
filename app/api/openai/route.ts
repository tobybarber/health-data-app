import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

// Initialize OpenAI client server-side
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Available server-side
});

export async function POST(request: NextRequest) {
  try {
    const { prompt, systemPrompt } = await request.json(); // Expect a prompt and optional systemPrompt from the client
    
    const messages = [];
    
    // Add system message if provided
    if (systemPrompt) {
      messages.push({ role: 'system' as const, content: systemPrompt });
    }
    
    // Add user message
    messages.push({ role: 'user' as const, content: prompt });
    
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // Or your preferred model
      messages: messages,
    });
    return NextResponse.json({ result: response.choices[0].message.content });
  } catch (error) {
    console.error('OpenAI API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 