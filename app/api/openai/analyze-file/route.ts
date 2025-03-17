import { NextRequest, NextResponse } from 'next/server';

/**
 * Analyze a file using OpenAI
 * 
 * This endpoint redirects to the /api/openai/analyze endpoint for backward compatibility.
 * 
 * @param request The incoming request object
 * @returns A JSON response with the analysis results
 */
export async function POST(request: NextRequest) {
  try {
    // Forward the request to the analyze endpoint
    const body = await request.json();
    
    console.log('Redirecting request from /api/openai/analyze-file to /api/openai/analyze');
    
    // Make a new request to the analyze endpoint
    const response = await fetch(new URL('/api/openai/analyze', request.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    // Return the response from the analyze endpoint
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('Error redirecting to analyze endpoint:', error);
    
    return NextResponse.json({ 
      error: 'Error redirecting to analyze endpoint', 
      message: error.message 
    }, { status: 500 });
  }
} 