import { NextRequest, NextResponse } from 'next/server';

// Simple GET handler to check if the API is accessible
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    message: 'Analysis Test API is running' 
  });
}

export async function POST(request: NextRequest) {
  console.log('API route /api/analyze-test POST handler called');
  
  try {
    // Parse request body
    const body = await request.json();
    console.log('Request body received:', JSON.stringify(body, null, 2));
    
    // Return a simple response
    return NextResponse.json({
      status: 'success',
      message: 'Analysis Test API route is working',
      receivedData: body
    });
    
  } catch (error: any) {
    console.error('Error in analyze-test API route:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
} 