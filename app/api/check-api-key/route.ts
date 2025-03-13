import { NextRequest, NextResponse } from 'next/server';
import { isApiKeyValid } from '../../lib/openai-server';

export async function GET(request: NextRequest) {
  try {
    const keyStatus = await isApiKeyValid();
    return NextResponse.json({ 
      valid: keyStatus.valid, 
      message: keyStatus.message 
    });
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