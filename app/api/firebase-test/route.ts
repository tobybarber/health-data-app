import { NextResponse } from 'next/server';
import admin from 'firebase-admin';

// Check if Firebase Admin has already been initialized
if (!admin.apps.length) {
  try {
    // Initialize Firebase Admin SDK with minimal configuration
    admin.initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
    console.log('Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
  }
}

export async function GET() {
  try {
    // Try to access Firestore to test if the SDK is working
    const db = admin.firestore();
    const testDoc = await db.collection('test').doc('test').get();
    
    return NextResponse.json({ 
      status: 'ok', 
      message: 'Firebase Admin SDK is working',
      firebaseInitialized: admin.apps.length > 0,
      testDocExists: testDoc.exists,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error in Firebase test API:', error);
    return NextResponse.json({ 
      status: 'error', 
      message: `Firebase Admin SDK error: ${error.message || String(error)}`,
      firebaseInitialized: admin.apps.length > 0,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 