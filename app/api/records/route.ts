import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../lib/firebase-admin';
import { verifyAuthToken } from '../../lib/auth-middleware';

/**
 * GET handler for fetching user records
 * This endpoint ensures users can only access their own records
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication and get user ID
    const authRequest = await verifyAuthToken(request);
    
    // If authRequest is a NextResponse, it means there was an auth error
    if (authRequest instanceof NextResponse) {
      return authRequest;
    }
    
    // Get the authenticated user ID from the request headers
    const userId = authRequest.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized: User ID not found' },
        { status: 401 }
      );
    }
    
    // Fetch records for the authenticated user
    const recordsSnapshot = await db.collection('users').doc(userId).collection('records').get();
    
    // Convert the snapshot to an array of records
    const records = recordsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return NextResponse.json({ records });
  } catch (error) {
    // Only log errors in development mode
    if (process.env.NODE_ENV === 'development') {
      console.error('Error fetching records:', error);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST handler for creating a new record
 * This endpoint ensures users can only create records in their own collection
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication and get user ID
    const authRequest = await verifyAuthToken(request);
    
    // If authRequest is a NextResponse, it means there was an auth error
    if (authRequest instanceof NextResponse) {
      return authRequest;
    }
    
    // Get the authenticated user ID from the request headers
    const userId = authRequest.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized: User ID not found' },
        { status: 401 }
      );
    }
    
    // Parse the request body
    const recordData = await request.json();
    
    // Create the record in Firestore
    const docRef = await db.collection('users').doc(userId).collection('records').add({
      ...recordData,
      createdAt: new Date()
    });
    
    return NextResponse.json({ 
      success: true, 
      recordId: docRef.id 
    });
  } catch (error) {
    // Only log errors in development mode
    if (process.env.NODE_ENV === 'development') {
      console.error('Error creating record:', error);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 