import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function GET(request: NextRequest) {
  try {
    // Check if API key exists
    if (!process.env.OPENAI_API_KEY) {
      console.error('No OpenAI API key found in environment');
      return NextResponse.json({ 
        valid: false, 
        message: 'OpenAI API key is missing. Please add it to your .env.local file and restart the server.',
        error: 'OPENAI_API_KEY_MISSING'
      });
    }

    // Initialize OpenAI client
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    try {
      // Make a simple API call to test the key
      await openai.models.list();
      return NextResponse.json({ 
        valid: true, 
        message: 'OpenAI API key is valid' 
      });
    } catch (error: any) {
      console.error('OpenAI API key validation failed:', error);
      return NextResponse.json({ 
        valid: false, 
        message: 'OpenAI API key is invalid. Please check your key and ensure it has the necessary permissions.',
        error: 'OPENAI_API_KEY_INVALID',
        details: error.message
      });
    }
  } catch (error: any) {
    console.error('Error checking API key:', error);
    return NextResponse.json({ 
      valid: false, 
      message: 'Failed to check API key',
      error: 'API_CHECK_FAILED',
      details: error.message
    }, { status: 500 });
  }
} 