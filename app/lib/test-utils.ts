/**
 * Utility functions for testing database connectivity and functionality
 * Only to be used in development mode
 */
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Tests if Firestore write access is working correctly
 * @param userId The user ID to test
 * @returns Promise that resolves when the test is complete
 */
export async function testFirestoreWrite(userId: string) {
  if (!userId || process.env.NODE_ENV !== 'development') {
    return;
  }
  
  try {
    const testDocRef = doc(db, `users/${userId}/test/firestore-test`);
    await setDoc(testDocRef, {
      timestamp: serverTimestamp(),
      message: 'This is a test document to verify Firestore write access',
      browser: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server',
      testId: Date.now().toString()
    });
    console.log('✅ Firestore write test successful');
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Error writing test document to Firestore:', err);
    }
  }
} 