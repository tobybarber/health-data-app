import { NextRequest, NextResponse } from 'next/server';
import { db } from './firebase-admin';
import { getAuth } from 'firebase-admin/auth';

/**
 * Middleware to verify Firebase authentication token and ensure users can only access their own data
 * 
 * @param request The incoming request
 * @param requiredUserId Optional user ID that must match the authenticated user
 * @returns NextResponse with error or the original request to continue processing
 */
export async function verifyAuthToken(request: NextRequest, requiredUserId?: string) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    // Extract the token
    const token = authHeader.split('Bearer ')[1];
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing token' },
        { status: 401 }
      );
    }

    try {
      // Verify the token with Firebase Admin
      const decodedToken = await getAuth().verifyIdToken(token);
      
      // If a specific user ID is required, verify it matches
      if (requiredUserId && decodedToken.uid !== requiredUserId) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to access this resource' },
          { status: 403 }
        );
      }
      
      // Add the user ID to the request headers for downstream handlers
      const requestWithAuth = new NextRequest(request);
      requestWithAuth.headers.set('x-user-id', decodedToken.uid);
      
      return requestWithAuth;
    } catch (verifyError) {
      // Only log errors in development mode
      if (process.env.NODE_ENV === 'development') {
        console.error('Error verifying token:', verifyError);
      }
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token' },
        { status: 401 }
      );
    }
  } catch (error) {
    // Only log errors in development mode
    if (process.env.NODE_ENV === 'development') {
      console.error('Auth middleware error:', error);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 